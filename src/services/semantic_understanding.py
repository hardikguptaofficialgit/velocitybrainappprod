"""
Advanced Semantic Understanding Service for Velocity Brain.

This service provides intelligent semantic analysis beyond simple keyword matching,
including intent classification, entity extraction, and contextual understanding.
"""

import re
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


@dataclass
class SemanticAnalysis:
    """Result of semantic analysis."""
    intent: str
    confidence: float
    entities: List[Dict[str, Any]]
    key_phrases: List[str]
    sentiment: Optional[str]
    urgency: Optional[str]
    context_keywords: List[str]


@dataclass
class EntityExtraction:
    """Extracted entity with semantic context."""
    text: str
    label: str
    confidence: float
    start_pos: int
    end_pos: int
    context: str
    relationships: List[str]


class SemanticUnderstandingService:
    """Advanced semantic understanding using NLP models."""
    
    def __init__(self):
        self.logger = get_logger('semantic_understanding')
        self._initialize_models()
        
    def _initialize_models(self):
        """Initialize NLP models and transformers."""
        try:
            import spacy
            from sentence_transformers import SentenceTransformer

            # Load spaCy model for entity extraction and parsing
            self.nlp = spacy.load("en_core_web_sm")
            self.logger.info("Loaded spaCy model for NLP processing")
            
            # Load sentence transformer for semantic similarity
            self.sentence_transformer = SentenceTransformer('all-MiniLM-L6-v2')
            self.logger.info("Loaded sentence transformer for semantic analysis")
            
        except Exception as exc:
            self.logger.error(f"Failed to initialize NLP models: {exc}")
            # Fallback to basic processing
            self.nlp = None
            self.sentence_transformer = None
    
    def analyze_intent(self, text: str) -> SemanticAnalysis:
        """
        Advanced intent analysis using semantic understanding.
        
        Goes beyond simple keyword matching to understand user intent.
        """
        try:
            text_lower = text.lower().strip()
            
            # Use semantic model if available
            if self.sentence_transformer:
                return self._semantic_intent_analysis(text_lower)
            else:
                return self._rule_based_intent_analysis(text_lower)
                
        except Exception as exc:
            self.logger.error(f"Intent analysis failed: {exc}")
            return self._fallback_analysis(text)
    
    def _semantic_intent_analysis(self, text: str) -> SemanticAnalysis:
        """Use sentence transformer for semantic intent analysis."""
        from sklearn.metrics.pairwise import cosine_similarity

        # Pre-defined intent embeddings for comparison
        intent_embeddings = {
            'query': self.sentence_transformer.encode("search find information lookup"),
            'planning': self.sentence_transformer.encode("plan schedule organize prepare"),
            'execution': self.sentence_transformer.encode("execute perform run action"),
            'ingestion': self.sentence_transformer.encode("store save add input data"),
            'analysis': self.sentence_transformer.encode("analyze examine investigate"),
            'collaboration': self.sentence_transformer.encode("collaborate share work together"),
        }
        
        # Encode input text
        text_embedding = self.sentence_transformer.encode(text)
        
        # Calculate similarities
        similarities = {}
        for intent, embedding in intent_embeddings.items():
            similarity = cosine_similarity([text_embedding], [embedding])[0][0]
            similarities[intent] = similarity
        
        # Determine best match
        best_intent = max(similarities, key=similarities.get)
        confidence = similarities[best_intent]
        
        # Extract entities and context
        entities = self._extract_entities(text)
        key_phrases = self._extract_key_phrases(text)
        sentiment = self._analyze_sentiment(text)
        urgency = self._detect_urgency(text)
        context_keywords = self._extract_context_keywords(text)
        
        return SemanticAnalysis(
            intent=best_intent,
            confidence=float(confidence),
            entities=entities,
            key_phrases=key_phrases,
            sentiment=sentiment,
            urgency=urgency,
            context_keywords=context_keywords
        )
    
    def _rule_based_intent_analysis(self, text: str) -> SemanticAnalysis:
        """Fallback rule-based intent analysis."""
        intent_patterns = {
            'query': [r'\b(what|where|when|how|find|search|look up|tell me|show me)\b'],
            'planning': [r'\b(plan|schedule|organize|prepare|arrange|set up)\b'],
            'execution': [r'\b(execute|run|perform|do|start|begin|launch)\b'],
            'ingestion': [r'\b(add|store|save|input|ingest|create|new)\b'],
            'analysis': [r'\b(analyze|examine|investigate|review|audit|check)\b'],
            'collaboration': [r'\b(share|collaborate|work together|team|group)\b'],
        }
        
        intent_scores = {}
        for intent, patterns in intent_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches
            intent_scores[intent] = score
        
        if intent_scores:
            best_intent = max(intent_scores, key=intent_scores.get)
            confidence = min(intent_scores[best_intent] / 3.0, 1.0)
        else:
            best_intent = 'query'
            confidence = 0.5
        
        entities = self._extract_entities(text)
        key_phrases = self._extract_key_phrases(text)
        sentiment = self._analyze_sentiment(text)
        urgency = self._detect_urgency(text)
        context_keywords = self._extract_context_keywords(text)
        
        return SemanticAnalysis(
            intent=best_intent,
            confidence=confidence,
            entities=entities,
            key_phrases=key_phrases,
            sentiment=sentiment,
            urgency=urgency,
            context_keywords=context_keywords
        )
    
    def _extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract entities using spaCy NLP model."""
        if not self.nlp:
            return self._basic_entity_extraction(text)
        
        try:
            doc = self.nlp(text)
            entities = []
            
            for ent in doc.ents:
                entity_data = {
                    'text': ent.text,
                    'label': ent.label_,
                    'start': ent.start_char,
                    'end': ent.end_char,
                    'confidence': 0.8,  # spaCy doesn't provide confidence
                    'context': text[max(0, ent.start_char-20):ent.end_char+20],
                }
                entities.append(entity_data)
            
            return entities
            
        except Exception as exc:
            self.logger.error(f"Entity extraction failed: {exc}")
            return self._basic_entity_extraction(text)
    
    def _basic_entity_extraction(self, text: str) -> List[Dict[str, Any]]:
        """Basic entity extraction using regex patterns."""
        entity_patterns = {
            'PERSON': r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b',
            'EMAIL': r'\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b',
            'PHONE': r'\b(\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b',
            'DATE': r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})\b',
            'MONEY': r'\$(\d+(?:\.\d{2})?)\b',
            'ORG': r'\b([A-Z][a-zA-Z0-9& -]{2,50})\b',
        }
        
        entities = []
        for label, pattern in entity_patterns.items():
            matches = re.finditer(pattern, text)
            for match in matches:
                entity_data = {
                    'text': match.group(),
                    'label': label,
                    'start': match.start(),
                    'end': match.end(),
                    'confidence': 0.7,
                    'context': text[max(0, match.start()-20):match.end()+20],
                }
                entities.append(entity_data)
        
        return entities
    
    def _extract_key_phrases(self, text: str) -> List[str]:
        """Extract key phrases using TF-IDF-like approach."""
        # Simple keyword extraction (can be enhanced with TF-IDF)
        words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
        
        # Filter out common stop words
        stop_words = {
            'that', 'this', 'with', 'from', 'they', 'have', 'been', 'have', 'was', 'were',
            'will', 'would', 'could', 'should', 'may', 'might', 'can', 'has',
            'had', 'did', 'does', 'do', 'but', 'or', 'and', 'the', 'a', 'an'
        }
        
        key_phrases = [word for word in words if word not in stop_words and len(word) > 3]
        
        # Return top phrases by frequency
        from collections import Counter
        phrase_counts = Counter(key_phrases)
        return [phrase for phrase, _ in phrase_counts.most_common(5)]
    
    def _analyze_sentiment(self, text: str) -> Optional[str]:
        """Analyze sentiment of the text."""
        try:
            if self.nlp:
                doc = self.nlp(text)
                # Use spaCy's sentiment analysis if available
                if hasattr(doc, 'sentiment'):
                    sentiment_score = doc.sentiment
                    if sentiment_score > 0.1:
                        return 'positive'
                    elif sentiment_score < -0.1:
                        return 'negative'
                    else:
                        return 'neutral'
            
            # Fallback to simple keyword-based sentiment
            positive_words = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'wonderful']
            negative_words = ['bad', 'terrible', 'awful', 'hate', 'horrible', 'worst', 'disappointing']
            
            text_lower = text.lower()
            positive_count = sum(1 for word in positive_words if word in text_lower)
            negative_count = sum(1 for word in negative_words if word in text_lower)
            
            if positive_count > negative_count:
                return 'positive'
            elif negative_count > positive_count:
                return 'negative'
            else:
                return 'neutral'
                
        except Exception as exc:
            self.logger.error(f"Sentiment analysis failed: {exc}")
            return None
    
    def _detect_urgency(self, text: str) -> Optional[str]:
        """Detect urgency indicators in text."""
        urgency_patterns = {
            'high': [r'\b(urgent|asap|immediate|emergency|critical|now)\b'],
            'medium': [r'\b(soon|this week|priority|important|quickly)\b'],
            'low': [r'\b(when convenient|next week|eventually|sometime)\b'],
        }
        
        text_lower = text.lower()
        for urgency, patterns in urgency_patterns.items():
            if any(re.search(pattern, text_lower) for pattern in patterns):
                return urgency
        
        return None
    
    def _extract_context_keywords(self, text: str) -> List[str]:
        """Extract context-relevant keywords."""
        # Domain-specific keyword extraction
        business_keywords = [
            'meeting', 'project', 'deadline', 'budget', 'report', 'presentation',
            'client', 'customer', 'revenue', 'cost', 'timeline', 'milestone'
        ]
        
        technical_keywords = [
            'database', 'api', 'server', 'code', 'deploy', 'test', 'debug',
            'algorithm', 'model', 'training', 'performance', 'security'
        ]
        
        text_lower = text.lower()
        found_keywords = []
        
        for keyword in business_keywords + technical_keywords:
            if keyword in text_lower:
                found_keywords.append(keyword)
        
        return found_keywords
    
    def _fallback_analysis(self, text: str) -> SemanticAnalysis:
        """Fallback analysis when models fail."""
        return SemanticAnalysis(
            intent='query',
            confidence=0.5,
            entities=[],
            key_phrases=[],
            sentiment=None,
            urgency=None,
            context_keywords=[]
        )
    
    def semantic_search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Advanced semantic search using embeddings.
        
        Goes beyond keyword matching to find semantically similar content.
        """
        if not self.sentence_transformer:
            self.logger.warning("Semantic search not available without sentence transformer")
            return []
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Get all entities for semantic comparison
                    cur.execute("""
                        SELECT slug, title, compiled_truth_md, confidence, metadata
                        FROM entities
                        WHERE access_level IN ('public', 'restricted')
                        ORDER BY updated_at DESC
                        LIMIT 1000
                    """)
                    entities = cur.fetchall()
                    
                    if not entities:
                        return []
                    
                    # Encode query and all entities
                    query_embedding = self.sentence_transformer.encode(query)
                    
                    results = []
                    from sklearn.metrics.pairwise import cosine_similarity

                    for entity in entities:
                        # Encode entity content
                        content = entity['compiled_truth_md'][:500]  # Limit for performance
                        entity_embedding = self.sentence_transformer.encode(content)

                        # Calculate semantic similarity
                        similarity = cosine_similarity([query_embedding], [entity_embedding])[0][0]
                        
                        if similarity > 0.3:  # Threshold for relevance
                            results.append({
                                'slug': entity['slug'],
                                'title': entity['title'],
                                'content': entity['compiled_truth_md'][:200],
                                'confidence': float(entity['confidence']),
                                'semantic_similarity': float(similarity),
                                'metadata': entity['metadata'],
                            })
                    
                    # Sort by semantic similarity
                    results.sort(key=lambda x: x['semantic_similarity'], reverse=True)
                    
                    return results[:limit]
                    
        except Exception as exc:
            self.logger.error(f"Semantic search failed: {exc}")
            return []
    
    def analyze_entities_relationships(self, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze relationships between entities using semantic understanding.
        
        Identifies potential connections, hierarchies, and associations.
        """
        if not self.nlp:
            return []
        
        relationships = []
        
        try:
            for i, entity1 in enumerate(entities):
                for j, entity2 in enumerate(entities):
                    if i >= j:
                        continue
                    
                    # Compare entities for potential relationships
                    text1 = entity1.get('text', '')
                    text2 = entity2.get('text', '')
                    
                    if not text1 or not text2:
                        continue
                    
                    # Use semantic similarity to find relationships
                    doc1 = self.nlp(text1)
                    doc2 = self.nlp(text2)
                    
                    # Calculate similarity
                    similarity = doc1.similarity(doc2)
                    
                    if similarity > 0.7:  # High similarity threshold
                        relationship_type = self._infer_relationship_type(entity1, entity2)
                        
                        relationships.append({
                            'source_entity': entity1,
                            'target_entity': entity2,
                            'relationship_type': relationship_type,
                            'confidence': float(similarity),
                            'evidence': f"Semantic similarity: {similarity:.2f}",
                        })
            
            return relationships
            
        except Exception as exc:
            self.logger.error(f"Relationship analysis failed: {exc}")
            return []
    
    def _infer_relationship_type(self, entity1: Dict, entity2: Dict) -> str:
        """Infer relationship type between two entities."""
        label1 = entity1.get('label', '').upper()
        label2 = entity2.get('label', '').upper()
        
        # Define relationship rules
        if label1 == 'PERSON' and label2 == 'PERSON':
            return 'colleague'
        elif label1 == 'PERSON' and label2 == 'ORG':
            return 'works_for'
        elif label1 == 'ORG' and label2 == 'PERSON':
            return 'employs'
        elif label1 == 'PERSON' and label2 in ['DATE', 'TIME']:
            return 'has_event'
        elif label1 == 'ORG' and label2 == 'ORG':
            return 'partner_with'
        else:
            return 'related_to'
    
    def store_semantic_analysis(self, analysis: SemanticAnalysis, source: str = 'semantic_analysis') -> None:
        """Store semantic analysis results in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO timeline_events (entity_id, event_ts, source_type, source_ref, event_md, event_payload)
                        VALUES (
                            (SELECT id FROM entities WHERE slug = 'system' LIMIT 1),
                            NOW(),
                            %s,
                            %s,
                            %s,
                            %s
                        )
                    """, (
                        'semantic_analysis',
                        source,
                        f"Intent: {analysis.intent}, Confidence: {analysis.confidence:.2f}",
                        json.dumps({
                            'intent': analysis.intent,
                            'confidence': analysis.confidence,
                            'entities': analysis.entities,
                            'key_phrases': analysis.key_phrases,
                            'sentiment': analysis.sentiment,
                            'urgency': analysis.urgency,
                            'context_keywords': analysis.context_keywords,
                        }, default=str)
                    ))
                conn.commit()
                
            self.logger.info(f"Stored semantic analysis: {analysis.intent}")
            
        except Exception as exc:
            self.logger.error(f"Failed to store semantic analysis: {exc}")


# Global instance used by API routes
semantic_service = SemanticUnderstandingService()
