"""
Advanced Token Optimization and Context Compression System
Reduces token usage while preserving context quality through intelligent compression
"""

import asyncio
import json
import re
import hashlib
import math
from typing import Any, Dict, List, Set, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from collections import defaultdict, Counter

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.services.embedding_service import EmbeddingService


@dataclass
class CompressionStats:
    """Statistics about context compression"""
    original_tokens: int
    compressed_tokens: int
    compression_ratio: float
    compression_time_ms: float
    quality_score: float
    method_used: str
    metadata: Dict[str, Any]


@dataclass
class ContextChunk:
    """Represents a chunk of context that can be compressed"""
    id: str
    content: str
    importance_score: float
    semantic_hash: str
    compression_history: List[Dict[str, Any]]
    created_at: datetime
    
    def __post_init__(self):
        if self.compression_history is None:
            self.compression_history = []


class TokenOptimizer:
    """Advanced token optimization and context compression engine"""
    
    def __init__(self):
        self.logger = get_logger('token_optimizer')
        self.embedding_service = EmbeddingService()
        
        # Compression methods and their characteristics
        self.compression_methods = {
            'semantic_summarization': {'quality': 0.9, 'ratio': 0.3, 'speed': 'slow'},
            'keyword_extraction': {'quality': 0.7, 'ratio': 0.5, 'speed': 'fast'},
            'structure_preserving': {'quality': 0.8, 'ratio': 0.4, 'speed': 'medium'},
            'hierarchical_compression': {'quality': 0.85, 'ratio': 0.35, 'speed': 'medium'},
            'reference_based': {'quality': 0.95, 'ratio': 0.2, 'speed': 'fast'}
        }
        
        # Token counting patterns for different languages
        self.token_patterns = {
            'python': r'\w+|[^\w\s]',
            'javascript': r'\w+|[^\w\s]',
            'markdown': r'\w+|[^\w\s]',
            'general': r'\w+|[^\w\s]'
        }
        
        # Importance scoring weights
        self.importance_weights = {
            'keywords': 0.3,
            'structure': 0.25,
            'novelty': 0.2,
            'relevance': 0.15,
            'recency': 0.1
        }
        
        # Cache for compressed content
        self.compression_cache: Dict[str, Tuple[str, CompressionStats]] = {}
        self.max_cache_size = 5000
    
    async def optimize_context(self, content: str, target_tokens: Optional[int] = None,
                            compression_method: Optional[str] = None,
                            preserve_structure: bool = True) -> Tuple[str, CompressionStats]:
        """Main entry point for context optimization"""
        start_time = datetime.now(timezone.utc)
        
        try:
            # Count original tokens
            original_tokens = self._count_tokens(content)
            
            # Determine target tokens if not specified
            if target_tokens is None:
                target_tokens = max(100, int(original_tokens * 0.4))  # Default to 40% compression
            
            # Check if compression is needed
            if original_tokens <= target_tokens:
                stats = CompressionStats(
                    original_tokens=original_tokens,
                    compressed_tokens=original_tokens,
                    compression_ratio=1.0,
                    compression_time_ms=0,
                    quality_score=1.0,
                    method_used="none",
                    metadata={'reason': 'no_compression_needed'}
                )
                return content, stats
            
            # Select compression method
            if compression_method is None:
                compression_method = self._select_compression_method(content, target_tokens, original_tokens)
            
            # Check cache
            cache_key = self._generate_compression_cache_key(content, target_tokens, compression_method)
            if cache_key in self.compression_cache:
                cached_result, cached_stats = self.compression_cache[cache_key]
                self.logger.debug(f"Cache hit for compression method {compression_method}")
                return cached_result, cached_stats
            
            # Apply compression
            compressed_content = await self._apply_compression_method(
                content, target_tokens, compression_method, preserve_structure
            )
            
            # Calculate statistics
            compression_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            compressed_tokens = self._count_tokens(compressed_content)
            compression_ratio = compressed_tokens / original_tokens
            quality_score = await self._calculate_quality_score(content, compressed_content)
            
            stats = CompressionStats(
                original_tokens=original_tokens,
                compressed_tokens=compressed_tokens,
                compression_ratio=compression_ratio,
                compression_time_ms=compression_time,
                quality_score=quality_score,
                method_used=compression_method,
                metadata={
                    'target_tokens': target_tokens,
                    'preserve_structure': preserve_structure
                }
            )
            
            # Cache result
            self._cache_compression_result(cache_key, compressed_content, stats)
            
            self.logger.info(f"Context optimized: {original_tokens} -> {compressed_tokens} tokens "
                           f"({compression_ratio:.2f} ratio, {quality_score:.2f} quality)")
            
            return compressed_content, stats
            
        except Exception as e:
            self.logger.error(f"Context optimization failed: {e}")
            # Return original content with error stats
            return content, CompressionStats(
                original_tokens=self._count_tokens(content),
                compressed_tokens=self._count_tokens(content),
                compression_ratio=1.0,
                compression_time_ms=0,
                quality_score=0.0,
                method_used="error",
                metadata={'error': str(e)}
            )
    
    def _count_tokens(self, text: str, language: str = 'general') -> int:
        """Count tokens in text using appropriate patterns"""
        if not text:
            return 0
        
        pattern = self.token_patterns.get(language, self.token_patterns['general'])
        tokens = re.findall(pattern, text)
        return len(tokens)
    
    def _select_compression_method(self, content: str, target_tokens: int, original_tokens: int) -> str:
        """Select the best compression method based on content and requirements"""
        compression_ratio_needed = target_tokens / original_tokens
        
        # Analyze content characteristics
        content_length = len(content)
        has_code_blocks = bool(re.search(r'```[\s\S]*?```', content))
        has_structure = bool(re.search(r'^#+\s|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s', content, re.MULTILINE))
        is_technical = bool(re.search(r'\b(function|class|def|import|export)\b', content))
        
        # Method selection logic
        if compression_ratio_needed > 0.8:
            # Light compression needed
            return 'keyword_extraction'
        
        elif compression_ratio_needed > 0.6:
            # Moderate compression
            if has_structure:
                return 'structure_preserving'
            else:
                return 'keyword_extraction'
        
        elif compression_ratio_needed > 0.4:
            # Heavy compression
            if is_technical and has_code_blocks:
                return 'reference_based'
            elif has_structure:
                return 'hierarchical_compression'
            else:
                return 'semantic_summarization'
        
        else:
            # Very heavy compression
            if is_technical:
                return 'reference_based'
            else:
                return 'semantic_summarization'
    
    async def _apply_compression_method(self, content: str, target_tokens: int,
                                      method: str, preserve_structure: bool) -> str:
        """Apply specific compression method"""
        if method == 'semantic_summarization':
            return await self._semantic_summarization(content, target_tokens)
        elif method == 'keyword_extraction':
            return await self._keyword_extraction(content, target_tokens)
        elif method == 'structure_preserving':
            return await self._structure_preserving_compression(content, target_tokens)
        elif method == 'hierarchical_compression':
            return await self._hierarchical_compression(content, target_tokens)
        elif method == 'reference_based':
            return await self._reference_based_compression(content, target_tokens)
        else:
            self.logger.warning(f"Unknown compression method: {method}, falling back to keyword_extraction")
            return await self._keyword_extraction(content, target_tokens)
    
    async def _semantic_summarization(self, content: str, target_tokens: int) -> str:
        """Compress using semantic summarization"""
        try:
            # Split content into sentences
            sentences = self._split_into_sentences(content)
            
            if len(sentences) <= 3:
                return content  # Too short to summarize
            
            # Calculate sentence importance scores
            sentence_scores = await self._calculate_sentence_importance(sentences)
            
            # Select top sentences until target token count is reached
            selected_sentences = []
            current_tokens = 0
            
            # Sort by importance score
            sorted_sentences = sorted(
                zip(sentences, sentence_scores),
                key=lambda x: x[1],
                reverse=True
            )
            
            for sentence, score in sorted_sentences:
                sentence_tokens = self._count_tokens(sentence)
                if current_tokens + sentence_tokens <= target_tokens:
                    selected_sentences.append(sentence)
                    current_tokens += sentence_tokens
                else:
                    # Try to truncate the sentence if it's too long
                    remaining_tokens = target_tokens - current_tokens
                    if remaining_tokens > 10:  # Only if we have room for meaningful content
                        truncated = self._truncate_to_token_count(sentence, remaining_tokens)
                        if truncated:
                            selected_sentences.append(truncated)
                            break
                    break
            
            # Reconstruct summary maintaining original order where possible
            summary = self._reconstruct_summary(sentences, selected_sentences)
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Semantic summarization failed: {e}")
            return await self._keyword_extraction(content, target_tokens)
    
    async def _keyword_extraction(self, content: str, target_tokens: int) -> str:
        """Compress using keyword extraction"""
        try:
            # Extract important phrases and keywords
            keywords = await self._extract_keywords(content)
            
            # Extract key sentences that contain important keywords
            sentences = self._split_into_sentences(content)
            key_sentences = []
            
            for sentence in sentences:
                sentence_keywords = set(word.lower() for word in re.findall(r'\b\w+\b', sentence))
                important_keywords = sentence_keywords.intersection(set(kw.lower() for kw in keywords))
                
                if important_keywords:
                    score = len(important_keywords) / len(sentence_keywords) if sentence_keywords else 0
                    key_sentences.append((sentence, score))
            
            # Sort by importance and select until target tokens
            key_sentences.sort(key=lambda x: x[1], reverse=True)
            
            result_sentences = []
            current_tokens = 0
            
            for sentence, score in key_sentences:
                sentence_tokens = self._count_tokens(sentence)
                if current_tokens + sentence_tokens <= target_tokens:
                    result_sentences.append(sentence)
                    current_tokens += sentence_tokens
                else:
                    break
            
            return ' '.join(result_sentences)
            
        except Exception as e:
            self.logger.error(f"Keyword extraction failed: {e}")
            return self._simple_truncation(content, target_tokens)
    
    async def _structure_preserving_compression(self, content: str, target_tokens: int) -> str:
        """Compress while preserving document structure"""
        try:
            # Parse structure (headers, lists, code blocks)
            structure = self._parse_document_structure(content)
            
            # Compress each section
            compressed_sections = []
            current_tokens = 0
            
            for section in structure:
                section_type = section['type']
                section_content = section['content']
                
                if section_type in ['header', 'code_block']:
                    # Keep headers and code blocks mostly intact
                    section_tokens = self._count_tokens(section_content)
                    if current_tokens + section_tokens <= target_tokens:
                        compressed_sections.append(section_content)
                        current_tokens += section_tokens
                else:
                    # Compress paragraphs and lists
                    remaining_tokens = target_tokens - current_tokens
                    if remaining_tokens > 20:
                        compressed_section = await self._keyword_extraction(section_content, remaining_tokens)
                        if compressed_section.strip():
                            compressed_sections.append(compressed_section)
                            current_tokens = self._count_tokens(' '.join(compressed_sections))
                
                if current_tokens >= target_tokens:
                    break
            
            return '\n\n'.join(compressed_sections)
            
        except Exception as e:
            self.logger.error(f"Structure preserving compression failed: {e}")
            return await self._keyword_extraction(content, target_tokens)
    
    async def _hierarchical_compression(self, content: str, target_tokens: int) -> str:
        """Compress using hierarchical approach"""
        try:
            # Split content into logical sections
            sections = self._split_into_sections(content)
            
            # Calculate importance of each section
            section_importance = await self._calculate_section_importance(sections)
            
            # Distribute tokens based on importance
            total_importance = sum(section_importance.values())
            
            compressed_sections = []
            remaining_tokens = target_tokens
            
            for i, (section, importance) in enumerate(zip(sections, section_importance)):
                if remaining_tokens <= 0:
                    break
                
                # Allocate tokens proportionally to importance
                if total_importance > 0:
                    section_tokens = max(10, int((importance / total_importance) * remaining_tokens))
                else:
                    section_tokens = max(10, remaining_tokens // len(sections))
                
                # Compress the section
                compressed_section = await self._semantic_summarization(section, section_tokens)
                compressed_sections.append(compressed_section)
                
                remaining_tokens -= self._count_tokens(compressed_section)
            
            return '\n\n'.join(compressed_sections)
            
        except Exception as e:
            self.logger.error(f"Hierarchical compression failed: {e}")
            return await self._semantic_summarization(content, target_tokens)
    
    async def _reference_based_compression(self, content: str, target_tokens: int) -> str:
        """Compress using reference-based approach for technical content"""
        try:
            # Extract function/class definitions and their signatures
            definitions = self._extract_code_definitions(content)
            
            # Extract key documentation/comments
            documentation = self._extract_documentation(content)
            
            # Combine definitions and documentation
            compressed_parts = []
            current_tokens = 0
            
            # Add important definitions
            for definition in definitions:
                def_tokens = self._count_tokens(definition)
                if current_tokens + def_tokens <= target_tokens * 0.7:  # 70% for definitions
                    compressed_parts.append(definition)
                    current_tokens += def_tokens
            
            # Add documentation
            remaining_tokens = target_tokens - current_tokens
            if remaining_tokens > 20:
                compressed_docs = await self._keyword_extraction(documentation, remaining_tokens)
                if compressed_docs.strip():
                    compressed_parts.append(compressed_docs)
            
            return '\n\n'.join(compressed_parts)
            
        except Exception as e:
            self.logger.error(f"Reference-based compression failed: {e}")
            return await self._semantic_summarization(content, target_tokens)
    
    def _split_into_sentences(self, content: str) -> List[str]:
        """Split content into sentences"""
        # Simple sentence splitting - can be enhanced with NLP libraries
        sentences = re.split(r'[.!?]+', content)
        return [s.strip() for s in sentences if s.strip()]
    
    async def _calculate_sentence_importance(self, sentences: List[str]) -> List[float]:
        """Calculate importance scores for sentences"""
        try:
            # Get embeddings for all sentences
            embeddings = []
            for sentence in sentences:
                try:
                    embedding_result = self.embedding_service.embed_text(sentence)
                    embeddings.append(embedding_result['vector'])
                except:
                    embeddings.append([0.0] * 384)  # Fallback embedding
            
            # Calculate sentence importance based on:
            # 1. Position (first and last sentences are often important)
            # 2. Length (very short sentences are less important)
            # 3. Keyword density
            # 4. Centrality in embedding space
            
            importance_scores = []
            
            for i, sentence in enumerate(sentences):
                score = 0.0
                
                # Position score
                if i == 0 or i == len(sentences) - 1:
                    score += 0.3
                elif i < len(sentences) * 0.2 or i > len(sentences) * 0.8:
                    score += 0.15
                
                # Length score (prefer medium-length sentences)
                length = len(sentence.split())
                if 5 <= length <= 25:
                    score += 0.2
                elif length < 5:
                    score -= 0.1
                
                # Keyword density
                important_words = ['important', 'key', 'main', 'primary', 'essential', 'critical', 'significant']
                word_count = sentence.lower().split()
                keyword_density = sum(1 for word in word_count if word in important_words)
                score += min(keyword_density * 0.1, 0.3)
                
                importance_scores.append(score)
            
            # Normalize scores
            max_score = max(importance_scores) if importance_scores else 1.0
            return [score / max_score if max_score > 0 else 0.5 for score in importance_scores]
            
        except Exception as e:
            self.logger.error(f"Failed to calculate sentence importance: {e}")
            return [0.5] * len(sentences)
    
    async def _extract_keywords(self, content: str) -> List[str]:
        """Extract important keywords from content"""
        try:
            # Simple keyword extraction based on frequency and position
            words = re.findall(r'\b\w+\b', content.lower())
            
            # Filter out common stop words
            stop_words = {
                'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
                'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
            }
            
            filtered_words = [word for word in words if word not in stop_words and len(word) > 2]
            
            # Count frequency
            word_freq = Counter(filtered_words)
            
            # Get top keywords
            top_keywords = [word for word, count in word_freq.most_common(20)]
            
            return top_keywords
            
        except Exception as e:
            self.logger.error(f"Failed to extract keywords: {e}")
            return []
    
    def _parse_document_structure(self, content: str) -> List[Dict[str, Any]]:
        """Parse document into structural elements"""
        structure = []
        lines = content.split('\n')
        current_section = {'type': 'paragraph', 'content': ''}
        
        for line in lines:
            # Headers
            if re.match(r'^#{1,6}\s', line):
                if current_section['content'].strip():
                    structure.append(current_section)
                current_section = {
                    'type': 'header',
                    'content': line
                }
            
            # Code blocks
            elif line.strip().startswith('```'):
                if current_section['type'] == 'code_block':
                    current_section['content'] += '\n' + line
                    structure.append(current_section)
                    current_section = {'type': 'paragraph', 'content': ''}
                else:
                    if current_section['content'].strip():
                        structure.append(current_section)
                    current_section = {
                        'type': 'code_block',
                        'content': line
                    }
            
            # Lists
            elif re.match(r'^\s*[-*+]\s', line) or re.match(r'^\s*\d+\.\s', line):
                if current_section['type'] != 'list':
                    if current_section['content'].strip():
                        structure.append(current_section)
                    current_section = {
                        'type': 'list',
                        'content': line
                    }
                else:
                    current_section['content'] += '\n' + line
            
            else:
                if current_section['type'] == 'code_block':
                    current_section['content'] += '\n' + line
                else:
                    current_section['content'] += '\n' + line if current_section['content'] else line
        
        # Add last section
        if current_section['content'].strip():
            structure.append(current_section)
        
        return structure
    
    def _split_into_sections(self, content: str) -> List[str]:
        """Split content into logical sections"""
        # Split by headers
        sections = re.split(r'\n(?=#{1,6}\s)', content)
        return [section.strip() for section in sections if section.strip()]
    
    async def _calculate_section_importance(self, sections: List[str]) -> List[float]:
        """Calculate importance scores for sections"""
        importance_scores = []
        
        for section in sections:
            score = 0.0
            
            # Length score
            length = len(section.split())
            score += min(length / 100, 0.3)  # Cap at 0.3
            
            # Header presence
            if re.search(r'^#{1,6}\s', section, re.MULTILINE):
                score += 0.2
            
            # Code presence
            if '```' in section:
                score += 0.15
            
            # Keyword density
            keywords = await self._extract_keywords(section)
            score += min(len(keywords) / 20, 0.2)
            
            importance_scores.append(score)
        
        # Normalize
        max_score = max(importance_scores) if importance_scores else 1.0
        return [score / max_score if max_score > 0 else 0.5 for score in importance_scores]
    
    def _extract_code_definitions(self, content: str) -> List[str]:
        """Extract function/class definitions from code"""
        definitions = []
        
        # Python patterns
        python_patterns = [
            r'def\s+\w+\([^)]*\):.*?(?=\ndef|\nclass|\Z)',
            r'class\s+\w+\([^)]*\):.*?(?=\ndef|\nclass|\Z)'
        ]
        
        # JavaScript patterns
        js_patterns = [
            r'function\s+\w+\([^)]*\)\s*{.*?}',
            r'const\s+\w+\s*=\s*\([^)]*\)\s*=>.*?;',
            r'class\s+\w+\s*{.*?}'
        ]
        
        all_patterns = python_patterns + js_patterns
        
        for pattern in all_patterns:
            matches = re.findall(pattern, content, re.DOTALL | re.MULTILINE)
            definitions.extend(matches)
        
        return definitions
    
    def _extract_documentation(self, content: str) -> str:
        """Extract documentation and comments"""
        # Extract docstrings and comments
        doc_patterns = [
            r'""".*?"""',
            r"'''.*?'''",
            r'#.*',
            r'//.*'
        ]
        
        docs = []
        for pattern in doc_patterns:
            matches = re.findall(pattern, content, re.DOTALL)
            docs.extend(matches)
        
        return '\n'.join(docs)
    
    def _reconstruct_summary(self, original_sentences: List[str], selected_sentences: List[str]) -> str:
        """Reconstruct summary maintaining some original order"""
        # Create a mapping of selected sentences for quick lookup
        selected_set = set(selected_sentences)
        
        # Try to maintain original order where possible
        ordered_summary = []
        for sentence in original_sentences:
            if sentence in selected_set:
                ordered_summary.append(sentence)
        
        # Add any remaining selected sentences
        for sentence in selected_sentences:
            if sentence not in ordered_summary:
                ordered_summary.append(sentence)
        
        return ' '.join(ordered_summary)
    
    def _truncate_to_token_count(self, text: str, max_tokens: int) -> str:
        """Truncate text to specific token count"""
        words = text.split()
        if len(words) <= max_tokens:
            return text
        
        truncated = ' '.join(words[:max_tokens])
        return truncated + '...' if len(truncated) < len(text) else truncated
    
    def _simple_truncation(self, content: str, target_tokens: int) -> str:
        """Simple truncation as fallback"""
        words = content.split()
        if len(words) <= target_tokens:
            return content
        
        truncated = ' '.join(words[:target_tokens])
        return truncated + '...'
    
    async def _calculate_quality_score(self, original: str, compressed: str) -> float:
        """Calculate quality score for compressed content"""
        try:
            # Get embeddings
            original_embedding = self.embedding_service.embed_text(original)
            compressed_embedding = self.embedding_service.embed_text(compressed)
            
            # Calculate semantic similarity
            similarity = self._cosine_similarity(
                original_embedding['vector'],
                compressed_embedding['vector']
            )
            
            # Adjust for compression ratio
            original_tokens = self._count_tokens(original)
            compressed_tokens = self._count_tokens(compressed)
            compression_ratio = compressed_tokens / original_tokens
            
            # Quality score considers both semantic similarity and compression efficiency
            quality_score = similarity * (1.0 + (1.0 - compression_ratio) * 0.2)
            
            return min(quality_score, 1.0)
            
        except Exception as e:
            self.logger.error(f"Failed to calculate quality score: {e}")
            return 0.5  # Default medium quality
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            dot_product = sum(a * b for a, b in zip(vec1, vec2))
            magnitude1 = math.sqrt(sum(a * a for a in vec1))
            magnitude2 = math.sqrt(sum(b * b for b in vec2))
            
            if magnitude1 == 0 or magnitude2 == 0:
                return 0.0
            
            return dot_product / (magnitude1 * magnitude2)
            
        except Exception:
            return 0.0
    
    def _generate_compression_cache_key(self, content: str, target_tokens: int, method: str) -> str:
        """Generate cache key for compression"""
        content_hash = hashlib.md5(content.encode()).hexdigest()
        return f"{content_hash}_{target_tokens}_{method}"
    
    def _cache_compression_result(self, cache_key: str, compressed_content: str, stats: CompressionStats):
        """Cache compression result"""
        if len(self.compression_cache) >= self.max_cache_size:
            # Remove oldest entry
            oldest_key = next(iter(self.compression_cache))
            del self.compression_cache[oldest_key]
        
        self.compression_cache[cache_key] = (compressed_content, stats)
    
    async def batch_optimize(self, contents: List[str], target_tokens_per_item: Optional[int] = None) -> List[Tuple[str, CompressionStats]]:
        """Optimize multiple content items in batch"""
        results = []
        
        # Process in parallel with limited concurrency
        semaphore = asyncio.Semaphore(5)  # Limit concurrent operations
        
        async def optimize_single(content: str) -> Tuple[str, CompressionStats]:
            async with semaphore:
                return await self.optimize_context(content, target_tokens_per_item)
        
        tasks = [optimize_single(content) for content in contents]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                self.logger.error(f"Batch optimization failed for item {i}: {result}")
                # Return original content with error stats
                original_content = contents[i]
                error_stats = CompressionStats(
                    original_tokens=self._count_tokens(original_content),
                    compressed_tokens=self._count_tokens(original_content),
                    compression_ratio=1.0,
                    compression_time_ms=0,
                    quality_score=0.0,
                    method_used="error",
                    metadata={'error': str(result)}
                )
                processed_results.append((original_content, error_stats))
            else:
                processed_results.append(result)
        
        return processed_results
    
    def get_optimization_stats(self) -> Dict[str, Any]:
        """Get statistics about optimization performance"""
        if not self.compression_cache:
            return {
                'cache_size': 0,
                'total_compressions': 0,
                'average_compression_ratio': 0,
                'average_quality_score': 0,
                'method_usage': {}
            }
        
        compression_ratios = []
        quality_scores = []
        method_usage = defaultdict(int)
        
        for compressed_content, stats in self.compression_cache.values():
            compression_ratios.append(stats.compression_ratio)
            quality_scores.append(stats.quality_score)
            method_usage[stats.method_used] += 1
        
        return {
            'cache_size': len(self.compression_cache),
            'total_compressions': len(self.compression_cache),
            'average_compression_ratio': sum(compression_ratios) / len(compression_ratios) if compression_ratios else 0,
            'average_quality_score': sum(quality_scores) / len(quality_scores) if quality_scores else 0,
            'method_usage': dict(method_usage)
        }
    
    def clear_cache(self):
        """Clear compression cache"""
        self.compression_cache.clear()
        self.logger.info("Token optimizer cache cleared")


# Global token optimizer instance
token_optimizer = TokenOptimizer()
