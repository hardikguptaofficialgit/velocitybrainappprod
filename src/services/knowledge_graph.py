"""
Advanced Knowledge Graph Service for Velocity Brain.

This service provides enhanced relationship inference, entity resolution,
and graph-based knowledge representation for intelligent knowledge management.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from collections import defaultdict, deque

import networkx as nx
import numpy as np

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


@dataclass
class GraphNode:
    """Node in the knowledge graph."""
    entity_id: int
    slug: str
    type: str
    title: str
    properties: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    embedding: Optional[List[float]] = None


@dataclass
class GraphEdge:
    """Edge in the knowledge graph."""
    from_entity_id: int
    to_entity_id: int
    relationship_type: str
    strength: float
    confidence: float
    evidence: List[Dict[str, Any]]
    first_seen: datetime
    last_seen: datetime


@dataclass
class PathResult:
    """Result of path finding in knowledge graph."""
    source_entity: str
    target_entity: str
    path: List[str]
    path_length: int
    path_strength: float
    intermediate_entities: List[str]


class KnowledgeGraphService:
    """Advanced knowledge graph management and analysis."""
    
    def __init__(self):
        self.logger = get_logger('knowledge_graph')
        self.graph = nx.DiGraph()
        self._load_existing_graph()
        
    def _load_existing_graph(self):
        """Load existing relationships into the knowledge graph."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Load all existing relationships
                    cur.execute("""
                        SELECT 
                            e1.id as from_id, e1.slug as from_slug,
                            e2.id as to_id, e2.slug as to_slug,
                            r.relation_type, r.strength, r.evidence,
                            r.first_seen, r.last_seen
                        FROM relationships r
                        JOIN entities e1 ON r.from_entity_id = e1.id
                        JOIN entities e2 ON r.to_entity_id = e2.id
                    """)
                    
                    relationships = cur.fetchall()
                    
                    for rel in relationships:
                        # Add nodes
                        self.graph.add_node(
                            rel['from_id'],
                            slug=rel['from_slug'],
                            type='entity',
                            title=rel['from_slug'],
                            properties={},
                            created_at=datetime.now(timezone.utc),
                            updated_at=datetime.now(timezone.utc)
                        )
                        
                        self.graph.add_node(
                            rel['to_id'],
                            slug=rel['to_slug'],
                            type='entity',
                            title=rel['to_slug'],
                            properties={},
                            created_at=datetime.now(timezone.utc),
                            updated_at=datetime.now(timezone.utc)
                        )
                        
                        # Add edge
                        self.graph.add_edge(
                            rel['from_id'],
                            rel['to_id'],
                            relationship_type=rel['relation_type'],
                            strength=float(rel['strength']),
                            confidence=0.8,  # Default confidence
                            evidence=rel['evidence'],
                            first_seen=rel['first_seen'],
                            last_seen=rel['last_seen']
                        )
                    
                    self.logger.info(f"Loaded {len(relationships)} relationships into knowledge graph")
                    
        except Exception as exc:
            self.logger.error(f"Failed to load existing graph: {exc}")
    
    def infer_relationships(self, entity_id: int, context_window: int = 10) -> List[Dict[str, Any]]:
        """
        Infer new relationships based on context and existing graph structure.
        
        Uses graph algorithms and NLP to discover hidden relationships.
        """
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Get entity and recent context
                    cur.execute("""
                        SELECT slug, title, compiled_truth_md, metadata
                        FROM entities
                        WHERE id = %s
                    """, (entity_id,))
                    
                    entity = cur.fetchone()
                    if not entity:
                        return []
                    
                    # Get recent timeline events for context
                    cur.execute("""
                        SELECT event_md, event_payload
                        FROM timeline_events
                        WHERE entity_id = %s
                        ORDER BY event_ts DESC
                        LIMIT %s
                    """, (entity_id, context_window))
                    
                    events = cur.fetchall()
                    
                    # Extract entities from context
                    context_entities = self._extract_entities_from_context(entity, events)
                    
                    # Infer relationships using graph analysis
                    inferred_relationships = []
                    
                    # 1. Co-occurrence analysis
                    co_occurrence_relationships = self._analyze_co_occurrence(
                        entity, context_entities
                    )
                    inferred_relationships.extend(co_occurrence_relationships)
                    
                    # 2. Path-based inference
                    path_relationships = self._analyze_path_patterns(
                        entity, context_entities
                    )
                    inferred_relationships.extend(path_relationships)
                    
                    # 3. Semantic similarity inference
                    semantic_relationships = self._analyze_semantic_similarity(
                        entity, context_entities
                    )
                    inferred_relationships.extend(semantic_relationships)
                    
                    # Remove duplicates and rank by confidence
                    unique_relationships = self._deduplicate_relationships(inferred_relationships)
                    ranked_relationships = sorted(
                        unique_relationships,
                        key=lambda x: x['confidence'],
                        reverse=True
                    )
                    
                    return ranked_relationships[:5]  # Top 5 inferred relationships
                    
        except Exception as exc:
            self.logger.error(f"Relationship inference failed: {exc}")
            return []
    
    def _extract_entities_from_context(self, entity: Dict, events: List[Dict]) -> List[Dict]:
        """Extract entities from timeline context."""
        entities = []
        seen_entities = {entity['slug']}  # Start with the current entity
        
        for event in events:
            # Extract entities from event text
            event_text = event.get('event_md', '') + ' ' + json.dumps(event.get('event_payload', {}))
            
            # Simple entity extraction (can be enhanced with NLP)
            import re
            
            # Person names
            person_pattern = r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b'
            persons = re.findall(person_pattern, event_text)
            
            # Organizations
            org_pattern = r'\b([A-Z][a-zA-Z0-9& -]{2,50})\b'
            orgs = re.findall(org_pattern, event_text)
            
            # Add to entities list
            for person in persons:
                if person not in seen_entities:
                    entities.append({
                        'text': person,
                        'type': 'person',
                        'source': 'context_extraction'
                    })
                    seen_entities.add(person)
            
            for org in orgs:
                if org not in seen_entities:
                    entities.append({
                        'text': org,
                        'type': 'organization',
                        'source': 'context_extraction'
                    })
                    seen_entities.add(org)
        
        return entities
    
    def _analyze_co_occurrence(self, entity: Dict, context_entities: List[Dict]) -> List[Dict[str, Any]]:
        """Analyze co-occurrence patterns for relationship inference."""
        relationships = []
        
        # Count co-occurrences
        co_occurrence_counts = defaultdict(int)
        total_contexts = len(context_entities)
        
        for context_entity in context_entities:
            if context_entity['type'] == entity.get('type', ''):
                continue
            
            entity_key = context_entity['text']
            co_occurrence_counts[entity_key] += 1
        
        # Generate relationship suggestions based on co-occurrence
        for other_entity, count in co_occurrence_counts.items():
            if count >= 2:  # Co-occurred at least twice
                co_occurrence_ratio = count / total_contexts
                
                # Determine relationship type based on entity types
                relationship_type = self._infer_relationship_type_from_co_occurrence(
                    entity, other_entity
                )
                
                confidence = min(co_occurrence_ratio * 2, 1.0)  # Scale to confidence
                
                relationships.append({
                    'target_entity': other_entity,
                    'relationship_type': relationship_type,
                    'confidence': confidence,
                    'evidence': f"Co-occurred {count} times in context",
                    'method': 'co_occurrence_analysis',
                    'co_occurrence_ratio': co_occurrence_ratio
                })
        
        return relationships
    
    def _analyze_path_patterns(self, entity: Dict, context_entities: List[Dict]) -> List[Dict[str, Any]]:
        """Analyze path patterns in the knowledge graph."""
        relationships = []
        
        try:
            entity_slug = entity['slug']
            
            # Find potential intermediate entities
            for context_entity in context_entities:
                if context_entity['type'] != entity.get('type', ''):
                    continue
                
                other_slug = context_entity['text']
                
                # Check if there's a path through the graph
                if self.graph.has_node(other_slug):
                    try:
                        # Find shortest path
                        path = nx.shortest_path(
                            self.graph, 
                            source=entity_slug, 
                            target=other_slug
                        )
                        
                        if len(path) <= 4:  # Reasonable path length
                            # Analyze intermediate nodes
                            intermediate_entities = path[1:-1] if len(path) > 2 else []
                            
                            # Infer relationship type based on path
                            relationship_type = self._infer_relationship_from_path(
                                entity, context_entity, intermediate_entities
                            )
                            
                            confidence = 1.0 / len(path)  # Higher confidence for shorter paths
                            
                            relationships.append({
                                'target_entity': other_slug,
                                'relationship_type': relationship_type,
                                'confidence': confidence,
                                'evidence': f"Path found: {' -> '.join(path)}",
                                'method': 'path_analysis',
                                'path_length': len(path),
                                'intermediate_entities': intermediate_entities
                            })
                    
                    except nx.NetworkXNoPath:
                        continue  # No path exists
                        
        except Exception as exc:
            self.logger.error(f"Path analysis failed: {exc}")
        
        return relationships
    
    def _analyze_semantic_similarity(self, entity: Dict, context_entities: List[Dict]) -> List[Dict[str, Any]]:
        """Analyze semantic similarity for relationship inference."""
        relationships = []
        
        entity_text = entity.get('compiled_truth_md', '')
        if not entity_text:
            return relationships
        
        for context_entity in context_entities:
            if context_entity['type'] == entity.get('type', ''):
                continue
            
            context_text = context_entity.get('text', '')
            if not context_text:
                continue
            
            # Simple semantic similarity (can be enhanced with embeddings)
            similarity = self._calculate_text_similarity(entity_text, context_text)
            
            if similarity > 0.7:  # High similarity threshold
                relationship_type = self._infer_relationship_type_from_similarity(
                    entity, context_entity, similarity
                )
                
                relationships.append({
                    'target_entity': context_entity['text'],
                    'relationship_type': relationship_type,
                    'confidence': similarity,
                    'evidence': f"Semantic similarity: {similarity:.2f}",
                    'method': 'semantic_similarity',
                    'similarity_score': similarity
                })
        
        return relationships
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate semantic similarity between two texts."""
        # Simple Jaccard similarity (can be enhanced with embeddings)
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def _infer_relationship_type_from_co_occurrence(self, entity: Dict, other: Dict) -> str:
        """Infer relationship type from co-occurrence."""
        entity_type = entity.get('type', '')
        other_type = other.get('type', '')
        
        # Person-Person relationships
        if entity_type == 'person' and other_type == 'person':
            return 'knows'
        
        # Person-Organization relationships
        if entity_type == 'person' and other_type == 'organization':
            return 'works_for'
        
        # Organization-Person relationships
        if entity_type == 'organization' and other_type == 'person':
            return 'employs'
        
        return 'related_to'
    
    def _infer_relationship_type_from_path(self, entity: Dict, other: Dict, intermediates: List[str]) -> str:
        """Infer relationship type from path context."""
        entity_type = entity.get('type', '')
        other_type = other.get('type', '')
        
        # Analyze intermediate entities to understand context
        has_org_intermediate = any('org' in intermediate.lower() for intermediate in intermediates)
        has_project_intermediate = any('project' in intermediate.lower() for intermediate in intermediates)
        
        # Person-Person through organization
        if entity_type == 'person' and other_type == 'person' and has_org_intermediate:
            return 'colleague'
        
        # Person-Organization through project
        if entity_type == 'person' and other_type == 'organization' and has_project_intermediate:
            return 'works_for'
        
        return 'connected_to'
    
    def _infer_relationship_type_from_similarity(self, entity: Dict, other: Dict, similarity: float) -> str:
        """Infer relationship type from semantic similarity."""
        entity_type = entity.get('type', '')
        other_type = other.get('type', '')
        
        # High similarity between same entity types
        if entity_type == other_type and similarity > 0.8:
            if entity_type == 'person':
                return 'similar_to'
            elif entity_type == 'organization':
                return 'partner_with'
            else:
                return 'related_to'
        
        # Cross-type relationships
        if entity_type == 'person' and other_type == 'organization':
            return 'associated_with'
        
        return 'related_to'
    
    def _deduplicate_relationships(self, relationships: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate relationships and keep highest confidence."""
        seen = set()
        unique_relationships = []
        
        for rel in relationships:
            key = (rel['target_entity'], rel['relationship_type'])
            if key not in seen:
                seen.add(key)
                unique_relationships.append(rel)
            elif rel['confidence'] > unique_relationships[-1]['confidence']:
                # Replace with higher confidence version
                unique_relationships[-1] = rel
        
        return unique_relationships
    
    def find_shortest_path(self, source_slug: str, target_slug: str) -> Optional[PathResult]:
        """Find shortest path between two entities in the knowledge graph."""
        try:
            if not self.graph.has_node(source_slug) or not self.graph.has_node(target_slug):
                return None
            
            path = nx.shortest_path(self.graph, source=source_slug, target=target_slug)
            
            if not path:
                return None
            
            # Calculate path strength (average of edge strengths)
            total_strength = 0.0
            for i in range(len(path) - 1):
                edge_data = self.graph.get_edge_data(path[i], path[i + 1])
                if edge_data:
                    total_strength += edge_data.get('strength', 0.5)
            
            avg_strength = total_strength / (len(path) - 1) if len(path) > 1 else 0.0
            
            return PathResult(
                source_entity=source_slug,
                target_entity=target_slug,
                path=path,
                path_length=len(path),
                path_strength=avg_strength,
                intermediate_entities=path[1:-1] if len(path) > 2 else []
            )
            
        except nx.NetworkXNoPath:
            return None
        except Exception as exc:
            self.logger.error(f"Path finding failed: {exc}")
            return None
    
    def get_neighbors(self, entity_slug: str, depth: int = 2) -> List[Dict[str, Any]]:
        """Get neighboring entities in the knowledge graph."""
        try:
            if not self.graph.has_node(entity_slug):
                return []
            
            # Get neighbors using NetworkX
            neighbors = []
            for neighbor in nx.neighbors(self.graph, entity_slug):
                edge_data = self.graph.get_edge_data(entity_slug, neighbor)
                node_data = self.graph.nodes[neighbor]
                
                neighbors.append({
                    'slug': neighbor,
                    'title': node_data.get('title', neighbor),
                    'type': node_data.get('type', 'entity'),
                    'relationship_type': edge_data.get('relationship_type', 'related_to'),
                    'strength': edge_data.get('strength', 0.5),
                    'confidence': edge_data.get('confidence', 0.8),
                    'evidence': edge_data.get('evidence', [])
                })
            
            # Sort by strength
            neighbors.sort(key=lambda x: x['strength'], reverse=True)
            
            return neighbors[:10]  # Limit to top 10
            
        except Exception as exc:
            self.logger.error(f"Neighbor retrieval failed: {exc}")
            return []
    
    def get_central_entities(self) -> List[Dict[str, Any]]:
        """Find central entities in the knowledge graph using centrality measures."""
        try:
            # Calculate centrality measures
            centrality = nx.betweenness_centrality(self.graph)
            degree_centrality = nx.degree_centrality(self.graph)
            
            # Combine scores
            combined_scores = {}
            for node in self.graph.nodes():
                betweenness = centrality.get(node, 0)
                degree = degree_centrality.get(node, 0)
                
                # Normalize and combine
                combined_scores[node] = (
                    betweenness * 0.6 +  # Betweenness weighted more
                    (degree / max(degree_centrality.values())) * 0.4  # Normalized degree
                )
            
            # Get top central entities
            central_entities = sorted(
                combined_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]
            
            results = []
            for node, score in central_entities:
                node_data = self.graph.nodes[node]
                results.append({
                    'slug': node,
                    'title': node_data.get('title', node),
                    'type': node_data.get('type', 'entity'),
                    'centrality_score': score,
                    'betweenness_centrality': centrality.get(node, 0),
                    'degree_centrality': degree_centrality.get(node, 0),
                    'neighbors': list(nx.neighbors(self.graph, node))
                })
            
            return results
            
        except Exception as exc:
            self.logger.error(f"Centrality analysis failed: {exc}")
            return []
    
    def store_inferred_relationships(self, entity_id: int, relationships: List[Dict[str, Any]]) -> None:
        """Store inferred relationships in the database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    for rel in relationships:
                        # Find target entity ID
                        cur.execute("""
                            SELECT id FROM entities WHERE slug = %s
                        """, (rel['target_entity'],))
                        target_result = cur.fetchone()
                        
                        if target_result:
                            target_id = target_result['id']
                            
                            # Check if relationship already exists
                            cur.execute("""
                                SELECT id FROM relationships 
                                WHERE from_entity_id = %s AND to_entity_id = %s
                            """, (entity_id, target_id))
                            
                            if not cur.fetchone():
                                # Insert new relationship
                                cur.execute("""
                                    INSERT INTO relationships 
                                    (from_entity_id, to_entity_id, relation_type, strength, evidence, first_seen, last_seen)
                                    VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                                """, (
                                    entity_id, target_id,
                                    rel['relationship_type'],
                                    rel['confidence'],
                                    json.dumps([{
                                        'method': rel['method'],
                                        'evidence': rel['evidence'],
                                        'inferred_at': datetime.now(timezone.utc).isoformat()
                                    }]),
                                    rel.get('evidence', [])
                                ))
                    
                    conn.commit()
                    
            self.logger.info(f"Stored {len(relationships)} inferred relationships for entity {entity_id}")
            
        except Exception as exc:
            self.logger.error(f"Failed to store inferred relationships: {exc}")


# Global instance
knowledge_graph = KnowledgeGraphService()
