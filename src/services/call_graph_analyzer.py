"""
Advanced Call Graph Analyzer with Multi-Hop Context Expansion
Provides intelligent code relationship analysis and context discovery
"""

import asyncio
from typing import Any, Dict, List, Set, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timezone
from collections import defaultdict, deque
import networkx as nx
import json

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.services.codebase_indexer import codebase_indexer


@dataclass
class CallPath:
    """Represents a call path between functions"""
    source: str
    target: str
    path: List[str]
    depth: int
    confidence: float
    context: Dict[str, Any]


@dataclass
class ContextNode:
    """Represents a node in the expanded context graph"""
    element_id: str
    name: str
    type: str
    file_path: str
    relevance_score: float
    relationship_path: List[str]
    metadata: Dict[str, Any]


class CallGraphAnalyzer:
    """Advanced call graph analysis with multi-hop context expansion"""
    
    def __init__(self):
        self.logger = get_logger('call_graph_analyzer')
        self.call_graph = nx.DiGraph()
        self.reverse_call_graph = nx.DiGraph()
        self.inheritance_graph = nx.DiGraph()
        self.import_graph = nx.DiGraph()
        self.last_updated = None
        
    async def build_graphs(self, repo_path: Optional[str] = None):
        """Build all relationship graphs from indexed code"""
        self.logger.info("Building call graphs...")
        
        try:
            # Load all elements and relationships
            elements = await self._load_all_elements()
            relationships = await self._load_all_relationships()
            
            # Clear existing graphs
            self.call_graph.clear()
            self.reverse_call_graph.clear()
            self.inheritance_graph.clear()
            self.import_graph.clear()
            
            # Build graphs
            for element in elements:
                element_id = element['id']
                self.call_graph.add_node(element_id, **element)
                self.reverse_call_graph.add_node(element_id, **element)
                self.inheritance_graph.add_node(element_id, **element)
                self.import_graph.add_node(element_id, **element)
            
            for rel in relationships:
                source_id = rel['source_id']
                target_id = rel['target_id']
                rel_type = rel['relationship_type']
                confidence = rel.get('confidence', 1.0)
                
                edge_data = {
                    'relationship_type': rel_type,
                    'confidence': confidence,
                    'context': rel.get('context'),
                    'metadata': rel.get('metadata', {})
                }
                
                if rel_type in ['calls', 'invokes']:
                    self.call_graph.add_edge(source_id, target_id, **edge_data)
                    self.reverse_call_graph.add_edge(target_id, source_id, **edge_data)
                elif rel_type in ['inherits', 'extends', 'implements']:
                    self.inheritance_graph.add_edge(source_id, target_id, **edge_data)
                elif rel_type in ['imports', 'requires']:
                    self.import_graph.add_edge(source_id, target_id, **edge_data)
            
            self.last_updated = datetime.now(timezone.utc)
            self.logger.info(f"Built graphs: {self.call_graph.number_of_nodes()} nodes, {self.call_graph.number_of_edges()} edges")
            
        except Exception as e:
            self.logger.error(f"Failed to build graphs: {e}")
            raise
    
    async def _load_all_elements(self) -> List[Dict[str, Any]]:
        """Load all code elements from database"""
        sql = """
        SELECT id, name, type, language, file_path, start_line, end_line,
               docstring, signature, parent_id, children_ids, metadata
        FROM code_elements
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                    return cur.fetchall()
        except Exception as e:
            self.logger.error(f"Failed to load elements: {e}")
            return []
    
    async def _load_all_relationships(self) -> List[Dict[str, Any]]:
        """Load all code relationships from database"""
        sql = """
        SELECT source_id, target_id, relationship_type, context, confidence, metadata
        FROM code_relationships
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                    return cur.fetchall()
        except Exception as e:
            self.logger.error(f"Failed to load relationships: {e}")
            return []
    
    async def find_call_paths(self, source_id: str, target_id: str, max_depth: int = 5) -> List[CallPath]:
        """Find all call paths between two functions"""
        try:
            paths = []
            
            # Use NetworkX to find all simple paths up to max_depth
            for path in nx.all_simple_paths(self.call_graph, source_id, target_id, cutoff=max_depth):
                confidence = self._calculate_path_confidence(path)
                context = await self._get_path_context(path)
                
                call_path = CallPath(
                    source=source_id,
                    target=target_id,
                    path=path,
                    depth=len(path) - 1,
                    confidence=confidence,
                    context=context
                )
                paths.append(call_path)
            
            # Sort by confidence and depth
            paths.sort(key=lambda x: (x.confidence, -x.depth), reverse=True)
            return paths
            
        except nx.NetworkXNoPath:
            return []
        except Exception as e:
            self.logger.error(f"Failed to find call paths: {e}")
            return []
    
    async def get_callers(self, element_id: str, max_depth: int = 3) -> List[ContextNode]:
        """Get all functions that call the given element (upward traversal)"""
        try:
            context_nodes = []
            visited = set()
            queue = deque([(element_id, 0, [element_id])])
            
            while queue and len(context_nodes) < 100:  # Limit results
                current_id, depth, path = queue.popleft()
                
                if current_id in visited or depth > max_depth:
                    continue
                
                visited.add(current_id)
                
                # Get all callers (incoming edges in reverse graph)
                callers = list(self.reverse_call_graph.predecessors(current_id))
                
                for caller_id in callers:
                    if caller_id not in visited:
                        caller_data = self.call_graph.nodes[caller_id]
                        edge_data = self.reverse_call_graph.get_edge_data(caller_id, current_id, {})
                        
                        relevance_score = self._calculate_relevance_score(
                            caller_id, element_id, depth, edge_data
                        )
                        
                        context_node = ContextNode(
                            element_id=caller_id,
                            name=caller_data['name'],
                            type=caller_data['type'],
                            file_path=caller_data['file_path'],
                            relevance_score=relevance_score,
                            relationship_path=path + [caller_id],
                            metadata={
                                'depth': depth,
                                'relationship': edge_data.get('relationship_type'),
                                'confidence': edge_data.get('confidence', 1.0)
                            }
                        )
                        context_nodes.append(context_node)
                        
                        # Add to queue for further traversal
                        if depth < max_depth:
                            queue.append((caller_id, depth + 1, path + [caller_id]))
            
            # Sort by relevance score
            context_nodes.sort(key=lambda x: x.relevance_score, reverse=True)
            return context_nodes[:50]  # Return top 50
            
        except Exception as e:
            self.logger.error(f"Failed to get callers: {e}")
            return []
    
    async def get_callees(self, element_id: str, max_depth: int = 3) -> List[ContextNode]:
        """Get all functions called by the given element (downward traversal)"""
        try:
            context_nodes = []
            visited = set()
            queue = deque([(element_id, 0, [element_id])])
            
            while queue and len(context_nodes) < 100:
                current_id, depth, path = queue.popleft()
                
                if current_id in visited or depth > max_depth:
                    continue
                
                visited.add(current_id)
                
                # Get all callees (outgoing edges in call graph)
                callees = list(self.call_graph.successors(current_id))
                
                for callee_id in callees:
                    if callee_id not in visited:
                        callee_data = self.call_graph.nodes[callee_id]
                        edge_data = self.call_graph.get_edge_data(current_id, callee_id, {})
                        
                        relevance_score = self._calculate_relevance_score(
                            callee_id, element_id, depth, edge_data
                        )
                        
                        context_node = ContextNode(
                            element_id=callee_id,
                            name=callee_data['name'],
                            type=callee_data['type'],
                            file_path=callee_data['file_path'],
                            relevance_score=relevance_score,
                            relationship_path=path + [callee_id],
                            metadata={
                                'depth': depth,
                                'relationship': edge_data.get('relationship_type'),
                                'confidence': edge_data.get('confidence', 1.0)
                            }
                        )
                        context_nodes.append(context_node)
                        
                        # Add to queue for further traversal
                        if depth < max_depth:
                            queue.append((callee_id, depth + 1, path + [callee_id]))
            
            # Sort by relevance score
            context_nodes.sort(key=lambda x: x.relevance_score, reverse=True)
            return context_nodes[:50]
            
        except Exception as e:
            self.logger.error(f"Failed to get callees: {e}")
            return []
    
    async def get_related_context(self, element_id: str, max_hops: int = 5, 
                                 relationship_types: Optional[List[str]] = None) -> List[ContextNode]:
        """Get comprehensive context around an element with multi-hop expansion"""
        try:
            context_nodes = []
            visited = set()
            queue = deque([(element_id, 0, [element_id], 1.0)])  # (id, hops, path, confidence)
            
            # Default relationship types to consider
            if relationship_types is None:
                relationship_types = ['calls', 'inherits', 'imports', 'implements']
            
            while queue and len(context_nodes) < 200:
                current_id, hops, path, path_confidence = queue.popleft()
                
                if current_id in visited or hops > max_hops:
                    continue
                
                visited.add(current_id)
                
                # Skip the original element
                if current_id != element_id:
                    element_data = self.call_graph.nodes[current_id]
                    
                    context_node = ContextNode(
                        element_id=current_id,
                        name=element_data['name'],
                        type=element_data['type'],
                        file_path=element_data['file_path'],
                        relevance_score=path_confidence,
                        relationship_path=path,
                        metadata={
                            'hops': hops,
                            'path_confidence': path_confidence
                        }
                    )
                    context_nodes.append(context_node)
                
                # Expand to related elements
                related = await self._get_related_elements(current_id, relationship_types)
                
                for related_id, rel_type, confidence in related:
                    if related_id not in visited and related_id not in path:
                        # Calculate new path confidence (multiply edge confidences)
                        new_confidence = path_confidence * confidence
                        
                        # Apply decay based on hops and relationship type
                        hop_penalty = 0.8 ** hops
                        type_multiplier = self._get_relationship_multiplier(rel_type)
                        final_confidence = new_confidence * hop_penalty * type_multiplier
                        
                        queue.append((related_id, hops + 1, path + [related_id], final_confidence))
            
            # Sort by relevance score and remove duplicates
            unique_nodes = {}
            for node in context_nodes:
                key = node.element_id
                if key not in unique_nodes or node.relevance_score > unique_nodes[key].relevance_score:
                    unique_nodes[key] = node
            
            result = list(unique_nodes.values())
            result.sort(key=lambda x: x.relevance_score, reverse=True)
            return result[:100]  # Return top 100
            
        except Exception as e:
            self.logger.error(f"Failed to get related context: {e}")
            return []
    
    async def _get_related_elements(self, element_id: str, relationship_types: List[str]) -> List[Tuple[str, str, float]]:
        """Get related elements by relationship type"""
        related = []
        
        for rel_type in relationship_types:
            if rel_type in ['calls', 'invokes']:
                # Get both callers and callees
                for successor in self.call_graph.successors(element_id):
                    edge_data = self.call_graph.get_edge_data(element_id, successor, {})
                    confidence = edge_data.get('confidence', 1.0)
                    related.append((successor, rel_type, confidence))
                
                for predecessor in self.call_graph.predecessors(element_id):
                    edge_data = self.call_graph.get_edge_data(predecessor, element_id, {})
                    confidence = edge_data.get('confidence', 1.0)
                    related.append((predecessor, rel_type, confidence))
            
            elif rel_type in ['inherits', 'extends', 'implements']:
                # Get inheritance relationships
                for successor in self.inheritance_graph.successors(element_id):
                    edge_data = self.inheritance_graph.get_edge_data(element_id, successor, {})
                    confidence = edge_data.get('confidence', 1.0)
                    related.append((successor, rel_type, confidence))
                
                for predecessor in self.inheritance_graph.predecessors(element_id):
                    edge_data = self.inheritance_graph.get_edge_data(predecessor, element_id, {})
                    confidence = edge_data.get('confidence', 1.0)
                    related.append((predecessor, rel_type, confidence))
            
            elif rel_type in ['imports', 'requires']:
                # Get import relationships
                for successor in self.import_graph.successors(element_id):
                    edge_data = self.import_graph.get_edge_data(element_id, successor, {})
                    confidence = edge_data.get('confidence', 1.0)
                    related.append((successor, rel_type, confidence))
        
        return related
    
    def _calculate_path_confidence(self, path: List[str]) -> float:
        """Calculate confidence score for a call path"""
        if len(path) < 2:
            return 1.0
        
        total_confidence = 1.0
        for i in range(len(path) - 1):
            edge_data = self.call_graph.get_edge_data(path[i], path[i + 1], {})
            edge_confidence = edge_data.get('confidence', 1.0)
            total_confidence *= edge_confidence
        
        # Apply length penalty
        length_penalty = 0.9 ** (len(path) - 2)
        return total_confidence * length_penalty
    
    async def _get_path_context(self, path: List[str]) -> Dict[str, Any]:
        """Get context information for a call path"""
        context = {
            'functions': [],
            'files': set(),
            'total_lines': 0
        }
        
        for element_id in path:
            if element_id in self.call_graph.nodes:
                node_data = self.call_graph.nodes[element_id]
                context['functions'].append({
                    'id': element_id,
                    'name': node_data['name'],
                    'type': node_data['type'],
                    'file_path': node_data['file_path'],
                    'lines': f"{node_data['start_line']}-{node_data['end_line']}"
                })
                context['files'].add(node_data['file_path'])
                context['total_lines'] += (node_data['end_line'] - node_data['start_line'] + 1)
        
        context['files'] = list(context['files'])
        context['file_count'] = len(context['files'])
        context['function_count'] = len(context['functions'])
        
        return context
    
    def _calculate_relevance_score(self, element_id: str, target_id: str, 
                                 depth: int, edge_data: Dict[str, Any]) -> float:
        """Calculate relevance score for a context element"""
        base_confidence = edge_data.get('confidence', 1.0)
        relationship_type = edge_data.get('relationship_type', 'unknown')
        
        # Depth penalty
        depth_penalty = 0.7 ** depth
        
        # Relationship type multiplier
        type_multiplier = self._get_relationship_multiplier(relationship_type)
        
        # Direct call bonus
        direct_call_bonus = 1.5 if relationship_type in ['calls', 'invokes'] else 1.0
        
        return base_confidence * depth_penalty * type_multiplier * direct_call_bonus
    
    def _get_relationship_multiplier(self, relationship_type: str) -> float:
        """Get multiplier for different relationship types"""
        multipliers = {
            'calls': 1.0,
            'invokes': 1.0,
            'inherits': 0.8,
            'extends': 0.8,
            'implements': 0.8,
            'imports': 0.6,
            'requires': 0.6,
            'uses': 0.5
        }
        return multipliers.get(relationship_type, 0.5)
    
    async def analyze_function_complexity(self, element_id: str) -> Dict[str, Any]:
        """Analyze complexity metrics for a function"""
        try:
            if element_id not in self.call_graph.nodes:
                return {'error': 'Function not found'}
            
            node_data = self.call_graph.nodes[element_id]
            
            # Get cyclomatic complexity from metadata
            metadata = node_data.get('metadata', {})
            cyclomatic_complexity = metadata.get('complexity', 1)
            
            # Calculate call complexity
            callees = list(self.call_graph.successors(element_id))
            callers = list(self.call_graph.predecessors(element_id))
            
            # Calculate fan-in and fan-out
            fan_in = len(callers)
            fan_out = len(callees)
            
            # Calculate depth metrics
            max_call_depth = await self._calculate_max_call_depth(element_id)
            
            return {
                'function_id': element_id,
                'function_name': node_data['name'],
                'cyclomatic_complexity': cyclomatic_complexity,
                'fan_in': fan_in,
                'fan_out': fan_out,
                'max_call_depth': max_call_depth,
                'total_callees': fan_out,
                'total_callers': fan_in,
                'complexity_score': self._calculate_overall_complexity(
                    cyclomatic_complexity, fan_in, fan_out, max_call_depth
                )
            }
            
        except Exception as e:
            self.logger.error(f"Failed to analyze function complexity: {e}")
            return {'error': str(e)}
    
    async def _calculate_max_call_depth(self, element_id: str, visited: Optional[Set[str]] = None) -> int:
        """Calculate maximum call depth from a function"""
        if visited is None:
            visited = set()
        
        if element_id in visited:
            return 0  # Prevent infinite recursion
        
        visited.add(element_id)
        
        max_depth = 0
        for callee_id in self.call_graph.successors(element_id):
            if callee_id != element_id:  # Skip self-calls
                depth = 1 + await self._calculate_max_call_depth(callee_id, visited.copy())
                max_depth = max(max_depth, depth)
        
        return max_depth
    
    def _calculate_overall_complexity(self, cyclomatic: int, fan_in: int, 
                                    fan_out: int, call_depth: int) -> float:
        """Calculate overall complexity score"""
        # Weighted combination of different complexity metrics
        weights = {
            'cyclomatic': 0.3,
            'fan_in': 0.2,
            'fan_out': 0.3,
            'call_depth': 0.2
        }
        
        # Normalize values
        normalized_cyclomatic = min(cyclomatic / 10.0, 1.0)
        normalized_fan_in = min(fan_in / 5.0, 1.0)
        normalized_fan_out = min(fan_out / 10.0, 1.0)
        normalized_depth = min(call_depth / 5.0, 1.0)
        
        overall = (
            normalized_cyclomatic * weights['cyclomatic'] +
            normalized_fan_in * weights['fan_in'] +
            normalized_fan_out * weights['fan_out'] +
            normalized_depth * weights['call_depth']
        )
        
        return round(overall, 3)
    
    async def get_graph_statistics(self) -> Dict[str, Any]:
        """Get statistics about the call graphs"""
        try:
            stats = {
                'call_graph': {
                    'nodes': self.call_graph.number_of_nodes(),
                    'edges': self.call_graph.number_of_edges(),
                    'density': nx.density(self.call_graph),
                    'is_strongly_connected': nx.is_strongly_connected(self.call_graph),
                    'weakly_connected_components': nx.number_weakly_connected_components(self.call_graph)
                },
                'inheritance_graph': {
                    'nodes': self.inheritance_graph.number_of_nodes(),
                    'edges': self.inheritance_graph.number_of_edges(),
                    'density': nx.density(self.inheritance_graph)
                },
                'import_graph': {
                    'nodes': self.import_graph.number_of_nodes(),
                    'edges': self.import_graph.number_of_edges(),
                    'density': nx.density(self.import_graph)
                },
                'last_updated': self.last_updated.isoformat() if self.last_updated else None
            }
            
            # Calculate degree statistics
            if self.call_graph.number_of_nodes() > 0:
                in_degrees = [d for n, d in self.call_graph.in_degree()]
                out_degrees = [d for n, d in self.call_graph.out_degree()]
                
                stats['call_graph']['avg_in_degree'] = sum(in_degrees) / len(in_degrees)
                stats['call_graph']['avg_out_degree'] = sum(out_degrees) / len(out_degrees)
                stats['call_graph']['max_in_degree'] = max(in_degrees)
                stats['call_graph']['max_out_degree'] = max(out_degrees)
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Failed to get graph statistics: {e}")
            return {'error': str(e)}


# Global analyzer instance
call_graph_analyzer = CallGraphAnalyzer()
