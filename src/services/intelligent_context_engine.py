"""
Intelligent Context Engine with Advanced Semantic Understanding
Combines code analysis, semantic search, and context expansion for AI agents
"""

import asyncio
import json
import hashlib
from typing import Any, Dict, List, Set, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from collections import defaultdict
import re
from enum import Enum

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.services.retrieval_engine import RetrievalEngine
from src.services.codebase_indexer import codebase_indexer
from src.services.call_graph_analyzer import call_graph_analyzer
from src.services.embedding_service import EmbeddingService


class ContextType(Enum):
    """Types of context that can be retrieved"""
    CODE = "code"
    DOCUMENTATION = "documentation"
    CONVERSATION = "conversation"
    ENTITY = "entity"
    RELATIONSHIP = "relationship"
    EXECUTION = "execution"
    ERROR = "error"


@dataclass
class ContextChunk:
    """Represents a chunk of contextual information"""
    id: str
    content: str
    context_type: ContextType
    source: str
    relevance_score: float
    metadata: Dict[str, Any]
    embeddings: Optional[List[float]] = None
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)


@dataclass
class ContextQuery:
    """Represents a context query with intent analysis"""
    query: str
    intent_type: str
    entities: List[str]
    context_types: List[ContextType]
    max_results: int
    max_hops: int
    include_code_context: bool
    include_semantic_search: bool
    metadata: Dict[str, Any]


@dataclass
class ContextResult:
    """Represents the result of a context query"""
    query: ContextQuery
    chunks: List[ContextChunk]
    total_found: int
    search_time_ms: float
    expansion_stats: Dict[str, Any]
    confidence_score: float


class IntelligentContextEngine:
    """Advanced context engine with multi-modal understanding and expansion"""
    
    def __init__(self):
        self.logger = get_logger('intelligent_context_engine')
        self.retrieval_engine = RetrievalEngine()
        self.embedding_service = EmbeddingService()
        
        # Context caches
        self.context_cache: Dict[str, ContextChunk] = {}
        self.query_cache: Dict[str, ContextResult] = {}
        
        # Configuration
        self.max_cache_size = 10000
        self.default_max_hops = 5
        self.context_expansion_threshold = 0.7
        
    async def query_context(self, query: str, **kwargs) -> ContextResult:
        """Main entry point for context queries"""
        start_time = datetime.now(timezone.utc)
        
        try:
            # Parse and analyze the query
            context_query = await self._analyze_query(query, **kwargs)
            
            # Check cache first
            cache_key = self._generate_cache_key(context_query)
            if cache_key in self.query_cache:
                self.logger.debug(f"Cache hit for query: {query[:50]}...")
                return self.query_cache[cache_key]
            
            # Execute multi-modal search
            chunks = await self._execute_search(context_query)
            
            # Expand context if needed
            expanded_chunks = await self._expand_context(chunks, context_query)
            
            # Rank and filter results
            final_chunks = await self._rank_and_filter(expanded_chunks, context_query)
            
            # Calculate metrics
            search_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            expansion_stats = self._calculate_expansion_stats(chunks, final_chunks)
            confidence_score = self._calculate_confidence_score(final_chunks, context_query)
            
            result = ContextResult(
                query=context_query,
                chunks=final_chunks,
                total_found=len(final_chunks),
                search_time_ms=search_time,
                expansion_stats=expansion_stats,
                confidence_score=confidence_score
            )
            
            # Cache the result
            self._cache_result(cache_key, result)
            
            self.logger.info(f"Context query completed: {len(final_chunks)} chunks in {search_time:.2f}ms")
            return result
            
        except Exception as e:
            self.logger.error(f"Context query failed: {e}")
            return ContextResult(
                query=ContextQuery(query, "error", [], [], 0, 0, False, False, {}),
                chunks=[],
                total_found=0,
                search_time_ms=0,
                expansion_stats={},
                confidence_score=0.0
            )
    
    async def _analyze_query(self, query: str, **kwargs) -> ContextQuery:
        """Analyze query to extract intent and entities"""
        try:
            # Basic intent classification
            intent_type = self._classify_intent(query)
            
            # Extract entities using NLP techniques
            entities = await self._extract_entities(query)
            
            # Determine relevant context types
            context_types = self._determine_context_types(query, intent_type, kwargs)
            
            # Set defaults and apply overrides
            max_results = kwargs.get('max_results', 50)
            max_hops = kwargs.get('max_hops', self.default_max_hops)
            include_code_context = kwargs.get('include_code_context', True)
            include_semantic_search = kwargs.get('include_semantic_search', True)
            
            return ContextQuery(
                query=query,
                intent_type=intent_type,
                entities=entities,
                context_types=context_types,
                max_results=max_results,
                max_hops=max_hops,
                include_code_context=include_code_context,
                include_semantic_search=include_semantic_search,
                metadata=kwargs
            )
            
        except Exception as e:
            self.logger.error(f"Query analysis failed: {e}")
            return ContextQuery(
                query=query,
                intent_type="error",
                entities=[],
                context_types=[ContextType.DOCUMENTATION],
                max_results=10,
                max_hops=1,
                include_code_context=False,
                include_semantic_search=True,
                metadata={}
            )
    
    def _classify_intent(self, query: str) -> str:
        """Classify the intent of the query"""
        query_lower = query.lower()
        
        # Code-related intents
        if any(word in query_lower for word in ['function', 'class', 'method', 'code', 'implement', 'fix']):
            if any(word in query_lower for word in ['how', 'implement', 'create', 'write']):
                return "code_generation"
            elif any(word in query_lower for word in ['bug', 'error', 'fix', 'issue']):
                return "debugging"
            elif any(word in query_lower for word in ['explain', 'what', 'how', 'why']):
                return "code_explanation"
            elif any(word in query_lower for word in ['refactor', 'improve', 'optimize']):
                return "code_improvement"
        
        # Search and retrieval intents
        if any(word in query_lower for word in ['find', 'search', 'where', 'locate']):
            return "search"
        
        # Entity-related intents
        if any(word in query_lower for word in ['what is', 'who is', 'tell me about']):
            return "entity_lookup"
        
        # Relationship intents
        if any(word in query_lower for word in ['relationship', 'connection', 'dependency', 'calls']):
            return "relationship_analysis"
        
        # General knowledge
        if any(word in query_lower for word in ['explain', 'describe', 'overview', 'summary']):
            return "knowledge_retrieval"
        
        return "general"
    
    async def _extract_entities(self, query: str) -> List[str]:
        """Extract entities from the query"""
        entities = []
        
        # Extract code identifiers (functions, classes, variables)
        code_patterns = [
            r'\b[A-Z][a-zA-Z0-9_]*\b',  # Class names
            r'\b[a-z_][a-z0-9_]*\(\)',  # Function calls
            r'\b[a-z_][a-z0-9_]*\b',    # General identifiers
        ]
        
        for pattern in code_patterns:
            matches = re.findall(pattern, query)
            entities.extend(matches)
        
        # Extract quoted strings (likely specific names)
        quoted_pattern = r'["\']([^"\']+)["\']'
        quoted_matches = re.findall(quoted_pattern, query)
        entities.extend(quoted_matches)
        
        # Remove duplicates and common words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        filtered_entities = list(set(
            entity for entity in entities 
            if entity.lower() not in stop_words and len(entity) > 1
        ))
        
        return filtered_entities[:10]  # Limit to 10 entities
    
    def _determine_context_types(self, query: str, intent_type: str, kwargs: Dict[str, Any]) -> List[ContextType]:
        """Determine which context types are relevant for the query"""
        context_types = []
        
        # Check explicit context type requests
        if 'context_types' in kwargs:
            for ct in kwargs['context_types']:
                if isinstance(ct, str):
                    try:
                        context_types.append(ContextType(ct))
                    except ValueError:
                        continue
                elif isinstance(ct, ContextType):
                    context_types.append(ct)
        
        # Auto-determine based on intent
        if intent_type in ['code_generation', 'debugging', 'code_explanation', 'code_improvement']:
            context_types.extend([ContextType.CODE, ContextType.DOCUMENTATION])
        elif intent_type == 'search':
            context_types.extend([ContextType.CODE, ContextType.ENTITY])
        elif intent_type == 'entity_lookup':
            context_types.extend([ContextType.ENTITY, ContextType.DOCUMENTATION])
        elif intent_type == 'relationship_analysis':
            context_types.extend([ContextType.RELATIONSHIP, ContextType.CODE])
        
        # Default to documentation if no types determined
        if not context_types:
            context_types = [ContextType.DOCUMENTATION, ContextType.ENTITY]
        
        return list(set(context_types))  # Remove duplicates
    
    async def _execute_search(self, context_query: ContextQuery) -> List[ContextChunk]:
        """Execute multi-modal search based on context types"""
        all_chunks = []
        
        # Semantic search for documentation and entities
        if context_query.include_semantic_search:
            semantic_chunks = await self._semantic_search(context_query)
            all_chunks.extend(semantic_chunks)
        
        # Code-specific search
        if context_query.include_code_context and ContextType.CODE in context_query.context_types:
            code_chunks = await self._code_search(context_query)
            all_chunks.extend(code_chunks)
        
        # Entity search
        if ContextType.ENTITY in context_query.context_types:
            entity_chunks = await self._entity_search(context_query)
            all_chunks.extend(entity_chunks)
        
        # Relationship search
        if ContextType.RELATIONSHIP in context_query.context_types:
            relationship_chunks = await self._relationship_search(context_query)
            all_chunks.extend(relationship_chunks)
        
        return all_chunks
    
    async def _semantic_search(self, context_query: ContextQuery) -> List[ContextChunk]:
        """Perform semantic search using embeddings"""
        try:
            # Use existing retrieval engine for hybrid search
            results = self.retrieval_engine.hybrid_search(
                context_query.query,
                limit=context_query.max_results
            )
            
            chunks = []
            for result in results:
                chunk = ContextChunk(
                    id=self._generate_chunk_id(result),
                    content=result.get('compiled_truth_md', ''),
                    context_type=ContextType.DOCUMENTATION,
                    source=f"entity:{result.get('slug', '')}",
                    relevance_score=float(result.get('confidence', 0.0)),
                    metadata=result
                )
                chunks.append(chunk)
            
            return chunks
            
        except Exception as e:
            self.logger.error(f"Semantic search failed: {e}")
            return []
    
    async def _code_search(self, context_query: ContextQuery) -> List[ContextChunk]:
        """Search for code elements"""
        try:
            # Search for code elements matching the query
            code_elements = await codebase_indexer.search_elements(
                context_query.query,
                limit=context_query.max_results
            )
            
            chunks = []
            for element in code_elements:
                # Get additional context from call graph
                related_context = await self._get_code_context(element['id'], context_query.max_hops)
                
                content = self._format_code_element(element, related_context)
                
                chunk = ContextChunk(
                    id=self._generate_chunk_id(element),
                    content=content,
                    context_type=ContextType.CODE,
                    source=f"code:{element['file_path']}:{element['start_line']}",
                    relevance_score=self._calculate_code_relevance(element, context_query),
                    metadata={
                        'element': element,
                        'related_context': related_context,
                        'language': element.get('language'),
                        'element_type': element.get('type')
                    }
                )
                chunks.append(chunk)
            
            return chunks
            
        except Exception as e:
            self.logger.error(f"Code search failed: {e}")
            return []
    
    async def _entity_search(self, context_query: ContextQuery) -> List[ContextChunk]:
        """Search for entities in the knowledge base"""
        try:
            # Use keyword search for entity matching
            results = self.retrieval_engine.keyword_search(
                context_query.query,
                limit=context_query.max_results
            )
            
            chunks = []
            for result in results:
                chunk = ContextChunk(
                    id=self._generate_chunk_id(result),
                    content=result.get('compiled_truth_md', ''),
                    context_type=ContextType.ENTITY,
                    source=f"entity:{result.get('slug', '')}",
                    relevance_score=float(result.get('confidence', 0.0)),
                    metadata=result
                )
                chunks.append(chunk)
            
            return chunks
            
        except Exception as e:
            self.logger.error(f"Entity search failed: {e}")
            return []
    
    async def _relationship_search(self, context_query: ContextQuery) -> List[ContextChunk]:
        """Search for relationships between elements"""
        try:
            # Extract entities from query and find relationships
            relationships = []
            
            for entity in context_query.entities:
                element_results = await codebase_indexer.search_elements(entity, limit=5)
                for element in element_results:
                    element_relationships = await codebase_indexer.get_element_relationships(element['id'])
                    relationships.extend(element_relationships)
            
            chunks = []
            for rel in relationships:
                content = self._format_relationship(rel)
                
                chunk = ContextChunk(
                    id=self._generate_chunk_id(rel),
                    content=content,
                    context_type=ContextType.RELATIONSHIP,
                    source=f"relationship:{rel['source_id']}->{rel['target_id']}",
                    relevance_score=float(rel.get('confidence', 0.0)),
                    metadata=rel
                )
                chunks.append(chunk)
            
            return chunks
            
        except Exception as e:
            self.logger.error(f"Relationship search failed: {e}")
            return []
    
    async def _get_code_context(self, element_id: str, max_hops: int) -> Dict[str, Any]:
        """Get code context using call graph analysis"""
        try:
            # Get callers and callees
            callers = await call_graph_analyzer.get_callers(element_id, max_hops)
            callees = await call_graph_analyzer.get_callees(element_id, max_hops)
            
            # Get related context
            related = await call_graph_analyzer.get_related_context(element_id, max_hops)
            
            return {
                'callers': [asdict(caller) for caller in callers[:10]],
                'callees': [asdict(callee) for callee in callees[:10]],
                'related': [asdict(rel) for rel in related[:20]]
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get code context: {e}")
            return {'callers': [], 'callees': [], 'related': []}
    
    def _format_code_element(self, element: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Format a code element with its context"""
        parts = []
        
        # Basic element info
        parts.append(f"## {element.get('name', 'Unknown')}")
        parts.append(f"**Type:** {element.get('type', 'unknown')}")
        parts.append(f"**Language:** {element.get('language', 'unknown')}")
        parts.append(f"**Location:** {element.get('file_path', '')}:{element.get('start_line', '')}")
        
        # Signature if available
        if element.get('signature'):
            parts.append(f"**Signature:** `{element['signature']}`")
        
        # Docstring if available
        if element.get('docstring'):
            parts.append(f"**Documentation:** {element['docstring']}")
        
        # Related context
        callers = context.get('callers', [])
        if callers:
            parts.append("\n**Called by:**")
            for caller in callers[:5]:
                parts.append(f"- {caller['name']} ({caller['file_path']}:{caller.get('metadata', {}).get('depth', 0)} hops)")
        
        callees = context.get('callees', [])
        if callees:
            parts.append("\n**Calls:**")
            for callee in callees[:5]:
                parts.append(f"- {callee['name']} ({callee['file_path']}:{callee.get('metadata', {}).get('depth', 0)} hops)")
        
        return "\n".join(parts)
    
    def _format_relationship(self, relationship: Dict[str, Any]) -> str:
        """Format a relationship for display"""
        rel_type = relationship.get('relationship_type', 'unknown')
        source_id = relationship.get('source_id', '')
        target_id = relationship.get('target_id', '')
        confidence = relationship.get('confidence', 0.0)
        context = relationship.get('context', '')
        
        return f"**Relationship:** {source_id} --[{rel_type}]--> {target_id}\n**Confidence:** {confidence:.2f}\n**Context:** {context}"
    
    def _calculate_code_relevance(self, element: Dict[str, Any], context_query: ContextQuery) -> float:
        """Calculate relevance score for a code element"""
        score = 0.0
        
        # Name matching
        element_name = element.get('name', '').lower()
        query_lower = context_query.query.lower()
        
        if element_name in query_lower:
            score += 0.5
        elif any(word in element_name for word in query_lower.split()):
            score += 0.3
        
        # Type matching
        element_type = element.get('type', '')
        if 'function' in query_lower and element_type == 'function':
            score += 0.3
        elif 'class' in query_lower and element_type == 'class':
            score += 0.3
        
        # Entity matching
        for entity in context_query.entities:
            if entity.lower() in element_name:
                score += 0.2
        
        return min(score, 1.0)
    
    async def _expand_context(self, chunks: List[ContextChunk], context_query: ContextQuery) -> List[ContextChunk]:
        """Expand context using call graph and relationships"""
        if not context_query.include_code_context:
            return chunks
        
        expanded_chunks = list(chunks)  # Start with original chunks
        
        # For code chunks, expand using call graph
        code_chunks = [c for c in chunks if c.context_type == ContextType.CODE]
        
        for chunk in code_chunks:
            element_id = chunk.metadata.get('element', {}).get('id')
            if element_id:
                # Get expanded context
                related_context = await call_graph_analyzer.get_related_context(
                    element_id, context_query.max_hops
                )
                
                # Create new chunks for related elements
                for related in related_context[:10]:  # Limit expansion
                    if related.relevance_score > self.context_expansion_threshold:
                        expanded_chunk = ContextChunk(
                            id=f"expanded_{related.element_id}",
                            content=f"Related: {related.name} ({related.type}) - {related.file_path}",
                            context_type=ContextType.CODE,
                            source=f"expanded:{related.element_id}",
                            relevance_score=related.relevance_score * 0.8,  # Discount expanded content
                            metadata={
                                'expanded_from': element_id,
                                'related_element': asdict(related)
                            }
                        )
                        expanded_chunks.append(expanded_chunk)
        
        return expanded_chunks
    
    async def _rank_and_filter(self, chunks: List[ContextChunk], context_query: ContextQuery) -> List[ContextChunk]:
        """Rank and filter chunks based on relevance and diversity"""
        if not chunks:
            return []
        
        # Sort by relevance score
        chunks.sort(key=lambda x: x.relevance_score, reverse=True)
        
        # Apply diversity filtering to avoid too many similar results
        filtered_chunks = []
        seen_sources = set()
        
        for chunk in chunks:
            source_type = chunk.source.split(':')[0]
            
            # Limit results from each source type
            source_count = sum(1 for c in filtered_chunks if c.source.split(':')[0] == source_type)
            if source_count >= context_query.max_results // 3:  # Max 1/3 from each source type
                continue
            
            filtered_chunks.append(chunk)
            seen_sources.add(source_type)
            
            if len(filtered_chunks) >= context_query.max_results:
                break
        
        return filtered_chunks
    
    def _calculate_expansion_stats(self, original_chunks: List[ContextChunk], final_chunks: List[ContextChunk]) -> Dict[str, Any]:
        """Calculate statistics about context expansion"""
        expanded_count = len(final_chunks) - len(original_chunks)
        
        context_type_counts = defaultdict(int)
        for chunk in final_chunks:
            context_type_counts[chunk.context_type.value] += 1
        
        return {
            'original_chunks': len(original_chunks),
            'final_chunks': len(final_chunks),
            'expanded_chunks': expanded_count,
            'expansion_ratio': expanded_count / max(len(original_chunks), 1),
            'context_type_distribution': dict(context_type_counts)
        }
    
    def _calculate_confidence_score(self, chunks: List[ContextChunk], context_query: ContextQuery) -> float:
        """Calculate overall confidence score for the result"""
        if not chunks:
            return 0.0
        
        # Average relevance score
        avg_relevance = sum(chunk.relevance_score for chunk in chunks) / len(chunks)
        
        # Diversity bonus
        context_types = set(chunk.context_type for chunk in chunks)
        diversity_bonus = min(len(context_types) / len(ContextType), 0.2)
        
        # Quantity penalty (too many results might indicate low precision)
        quantity_penalty = 1.0 if len(chunks) <= 20 else max(0.5, 1.0 - (len(chunks) - 20) * 0.02)
        
        confidence = avg_relevance + diversity_bonus
        confidence *= quantity_penalty
        
        return min(confidence, 1.0)
    
    def _generate_chunk_id(self, data: Dict[str, Any]) -> str:
        """Generate unique ID for a chunk"""
        content = json.dumps(data, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()
    
    def _generate_cache_key(self, context_query: ContextQuery) -> str:
        """Generate cache key for a query"""
        key_parts = [
            context_query.query,
            str(context_query.max_hops),
            str(context_query.include_code_context),
            str(context_query.include_semantic_search),
            ','.join(ct.value for ct in context_query.context_types)
        ]
        return hashlib.md5('|'.join(key_parts).encode()).hexdigest()
    
    def _cache_result(self, cache_key: str, result: ContextResult):
        """Cache a query result"""
        if len(self.query_cache) >= self.max_cache_size:
            # Remove oldest entry
            oldest_key = next(iter(self.query_cache))
            del self.query_cache[oldest_key]
        
        self.query_cache[cache_key] = result
    
    async def get_context_summary(self, query: str, max_length: int = 500) -> str:
        """Get a concise summary of context for a query"""
        try:
            result = await self.query_context(query, max_results=20)
            
            if not result.chunks:
                return "No relevant context found."
            
            # Sort by relevance and take top chunks
            top_chunks = sorted(result.chunks, key=lambda x: x.relevance_score, reverse=True)[:5]
            
            summary_parts = []
            current_length = 0
            
            for chunk in top_chunks:
                content = chunk.content
                
                # Truncate content if needed
                if current_length + len(content) > max_length:
                    remaining = max_length - current_length - 3
                    if remaining > 50:
                        content = content[:remaining] + "..."
                    else:
                        break
                
                summary_parts.append(content)
                current_length += len(content)
            
            return "\n\n".join(summary_parts)
            
        except Exception as e:
            self.logger.error(f"Failed to generate context summary: {e}")
            return f"Error generating summary: {e}"
    
    async def clear_cache(self):
        """Clear all caches"""
        self.context_cache.clear()
        self.query_cache.clear()
        self.logger.info("Context engine cache cleared")


# Global context engine instance
intelligent_context_engine = IntelligentContextEngine()
