from datetime import datetime, timezone
from typing import Optional, Any, Dict, List
import uuid
from psycopg.types.json import Json
from src.core.db import get_conn
from src.services.memory_engine import MemoryEngine
from src.services.retrieval_engine import RetrievalEngine
from src.services.execution_engine import ExecutionEngine
from src.services.semantic_understanding import SemanticUnderstandingService
from src.services.predictive_analytics import PredictiveAnalyticsService
from src.services.knowledge_graph import KnowledgeGraphService
from src.services.business_intelligence import BusinessIntelligenceService
from src.core.logging_config import get_logger


class AgentLoop:
    def __init__(self):
        self.logger = get_logger('agent_loop')
        self.memory = MemoryEngine()
        self.retrieval = RetrievalEngine()
        self.execution = ExecutionEngine()
        self.semantic = SemanticUnderstandingService()
        self.predictive = PredictiveAnalyticsService()
        self.knowledge_graph = KnowledgeGraphService()
        self.business_intel = BusinessIntelligenceService()

    def _detect_intent(self, signal: str) -> str:
        """Enhanced intent detection using semantic understanding."""
        # Use semantic understanding for more accurate intent detection
        semantic_analysis = self.semantic.analyze_intent(signal)
        
        # Combine semantic analysis with rule-based detection
        rule_intent = self._rule_based_intent_detection(signal)
        
        # Trust semantic analysis more if confidence is high
        if semantic_analysis.confidence > 0.7:
            return semantic_analysis.intent
        
        # Fall back to rule-based detection
        return rule_intent
    
    def _rule_based_intent_detection(self, signal: str) -> str:
        """Original rule-based intent detection as fallback."""
        s = signal.lower()
        if any(k in s for k in ['prepare', 'meeting', 'brief']):
            return 'planning'
        if any(k in s for k in ['execute', 'send', 'schedule']):
            return 'execution'
        if any(k in s for k in ['what do i know', 'summarize', 'patterns']):
            return 'query'
        return 'ingestion'

    def _plan(self, intent: str, signal: str, context: list[dict]) -> list[dict]:
        """Enhanced planning with predictive analytics and knowledge graph insights."""
        plan: list[dict] = []
        context_entities = [{'slug': item['slug'], 'type': 'entity'} for item in context if 'slug' in item]

        if intent == 'execution':
            # Enhanced execution planning with predictive insights
            predictions = self.predictive.generate_forecast('task_completion_rate', horizon_days=7)
            insights = self.predictive.generate_business_insights()
            
            plan = [
                {'step': 'analyze_predictive_context', 'action_type': 'analytics.analyze', 'payload': {'predictions': predictions, 'insights': insights}},
                {'step': 'review_context', 'action_type': 'analyze', 'payload': {'context_hits': len(context)}},
                {'step': 'execute_workflow', 'action_type': 'workflow.run', 'payload': {'signal': signal}},
            ]
        
        elif intent == 'planning':
            # Enhanced planning with knowledge graph analysis
            # Infer relationships between entities
            if context_entities:
                entity_id = self._get_entity_id_from_context(context)
                if entity_id:
                    inferred_relationships = self.knowledge_graph.infer_relationships(entity_id)
                    plan.extend([
                        {'step': 'analyze_entity_relationships', 'action_type': 'graph.analyze', 'payload': {'relationships': inferred_relationships}},
                        {'step': 'update_knowledge_graph', 'action_type': 'graph.update', 'payload': {'relationships': inferred_relationships}}
                    ])
            
            plan.extend([
                {'step': 'collect_briefing_context', 'action_type': 'query.aggregate', 'payload': {'signal': signal}},
                {'step': 'create_briefing', 'action_type': 'briefing.generate', 'payload': {'signal': signal}},
            ])
        
        elif intent == 'query':
            # Enhanced query with semantic understanding and knowledge graph
            semantic_analysis = self.semantic.analyze_intent(signal)
            
            # Use semantic context for better retrieval
            enhanced_context = []
            for item in context:
                # Boost items with high semantic similarity
                item['semantic_relevance'] = semantic_analysis.confidence
                enhanced_context.append(item)
            
            # Find related entities using knowledge graph
            if context and context_entities:
                primary_entity = context[0]['slug'] if context else None
                if primary_entity:
                    related_entities = self.knowledge_graph.get_neighbors(primary_entity, depth=2)
                    enhanced_context.extend([
                        {'slug': rel['slug'], 'type': 'related_entity', 'relationship': rel['relationship_type']}
                        for rel in related_entities
                    ])
            
            plan.extend([
                {'step': 'semantic_enhancement', 'action_type': 'nlp.enhance', 'payload': {'semantic_analysis': semantic_analysis}},
                {'step': 'knowledge_graph_traversal', 'action_type': 'graph.traverse', 'payload': {'central_entities': self.knowledge_graph.get_central_entities()}},
                {'step': 'collect_enhanced_context', 'action_type': 'query.aggregate', 'payload': {'enhanced_context': enhanced_context}},
                {'step': 'generate_response', 'action_type': 'response.generate', 'payload': {'semantic_analysis': semantic_analysis}},
            ])
        
        else:  # ingestion and other intents
            plan.extend([
                {'step': 'memory_writeback', 'action_type': 'memory.update', 'payload': {'signal': signal}}
            ])
        
        return plan
    
    def _get_entity_id_from_context(self, context: list[dict]) -> Optional[int]:
        """Extract entity ID from context."""
        if context and 'slug' in context[0]:
            try:
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT id FROM entities WHERE slug = %s", (context[0]['slug'],))
                        result = cur.fetchone()
                        return result['id'] if result else None
            except Exception:
                return None
        return None

    def _attention_score(self, signal: str, context_hits: int) -> float:
        s = signal.lower()
        urgency_tokens = ['urgent', 'asap', 'today', 'deadline', 'risk']
        urgency = 0.15 if any(t in s for t in urgency_tokens) else 0.0
        base = 0.45 + min(0.35, context_hits * 0.04)
        return round(min(0.95, base + urgency), 3)

    def _persist_run(self, run: dict) -> None:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO agent_runs (run_id, signal, intent, plan, execution_log, status, confidence, created_at, completed_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
                    RETURNING id
                    """,
                    (
                        run['run_id'],
                        run['signal'],
                        run['intent'],
                        Json(run['plan']),
                        Json(run['actions']),
                        run['status'],
                        run['confidence'],
                    ),
                )
                run_pk = cur.fetchone()['id']
                for action in run['actions']:
                    cur.execute(
                        """
                        INSERT INTO execution_actions (run_id, action_type, action_payload, status, result)
                        VALUES (%s,%s,%s,%s,%s)
                        """,
                        (
                            run_pk,
                            action.get('action_type', 'unknown'),
                            Json(action.get('payload', {})),
                            action.get('status', 'unknown'),
                            Json(action),
                        ),
                    )
                conn.commit()

    def run(self, signal: str) -> dict:
        """Enhanced run method with AI-powered insights."""
        run_id = str(uuid.uuid4())
        trace_id = str(uuid.uuid4())
        
        # Enhanced intent detection using semantic understanding
        intent = self._detect_intent(signal)
        semantic_analysis = self.semantic.analyze_intent(signal)
        
        # Get context with enhanced retrieval
        try:
            context = self.retrieval.hybrid_search(signal, limit=8)
        except Exception as exc:
            return {
                'run_id': run_id,
                'signal': signal,
                'status': 'failed',
                'intent': intent,
                'plan': [],
                'actions': [],
                'memory_updates': [],
                'confidence': 0.0,
                'attention_score': 0.0,
                'reasoning_summary': (
                    'Agent run failed because the local database is not ready. '
                    'Run velocitybrain doctor after starting the DB (docker compose up db -d). '
                    f'error={exc}'
                ),
                'references': [],
                'insights': [],
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'trace_id': trace_id,
                'error': 'database_unavailable',
            }
        
        # Generate business insights for relevant signals
        insights = []
        if intent in ['planning', 'execution']:
            kpis = self.business_intel.calculate_kpis(days=7)
            insights = self.business_intel.generate_insights(kpis)
        
        # Enhanced planning with predictive analytics and knowledge graph
        plan = self._plan(intent, signal, context)
        
        # Execute with enhanced context
        actions = self.execution.execute(plan)

        memory_updates = []
        if intent in {'ingestion', 'planning', 'query'}:
            memory_updates.append(self.memory.upsert_from_text('agent-loop', signal))
        
        # Calculate attention score with enhanced factors
        attention = self._attention_score(signal, len(context))
        
        # Enhanced confidence calculation
        semantic_confidence = semantic_analysis.confidence if hasattr(semantic_analysis, 'confidence') else 0.5
        base_confidence = 0.6 if context else 0.45
        confidence = max(semantic_confidence, base_confidence)
        
        # Enhanced reasoning with insights
        reasoning = f'Intent={intent}. Enhanced analysis completed: semantic_confidence={semantic_confidence:.2f}, context_hits={len(context)}. Insights: {len(insights)}'
        
        # Extract entities for relationship analysis
        entities = []
        for item in context:
            entities.append({
                'type': 'entity',
                'slug': item.get('slug', ''),
                'title': item.get('title', ''),
                'confidence': item.get('confidence', 0.5)
            })
        
        # Store semantic analysis for learning
        if semantic_analysis and semantic_analysis.entities:
            self._store_semantic_analysis(semantic_analysis, signal)
        
        output = {
            'run_id': run_id,
            'signal': signal,
            'status': 'completed',
            'intent': intent,
            'semantic_analysis': {
                'intent': semantic_analysis.intent,
                'confidence': semantic_analysis.confidence,
                'entities': semantic_analysis.entities,
                'key_phrases': semantic_analysis.key_phrases,
                'sentiment': semantic_analysis.sentiment,
                'urgency': semantic_analysis.urgency,
                'context_keywords': semantic_analysis.context_keywords
            },
            'plan': plan,
            'actions': actions,
            'memory_updates': memory_updates,
            'confidence': confidence,
            'attention_score': attention,
            'reasoning_summary': reasoning,
            'references': entities,
            'insights': insights,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'trace_id': trace_id,
        }
        self._persist_run(output)
        return output
    
    def _store_semantic_analysis(self, analysis: Any, signal: str) -> None:
        """Store semantic analysis for continuous learning."""
        try:
            # Store in timeline events for analysis
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO timeline_events 
                            (entity_id, event_ts, source_type, source_ref, event_md, event_payload)
                        VALUES (
                            (SELECT id FROM entities WHERE slug = 'system' LIMIT 1),
                            NOW(),
                            'semantic_analysis',
                            %s,
                            %s,
                            %s
                        )
                    """, (
                        f"Semantic analysis for: {signal[:100]}",
                        f"Intent: {analysis.intent}, Confidence: {analysis.confidence}",
                        json.dumps({
                            'intent': analysis.intent,
                            'confidence': analysis.confidence,
                            'entities': analysis.entities,
                            'key_phrases': analysis.key_phrases,
                            'sentiment': analysis.sentiment,
                            'urgency': analysis.urgency,
                            'context_keywords': analysis.context_keywords
                        }, default=str)
                    ))
                conn.commit()
                    
        except Exception as exc:
            self.logger.error(f"Failed to store semantic analysis: {exc}")
    
    def _persist_run(self, run: dict) -> None:
        """Enhanced run persistence with additional metadata."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO agent_runs (run_id, signal, intent, plan, execution_log, status, confidence, created_at, completed_at)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
                            RETURNING id
                    """, (
                        run['run_id'],
                        run['signal'],
                        run['intent'],
                        Json(run['plan']),
                        Json(run['actions']),
                        run['status'],
                        run['confidence'],
                    ))
                    run_pk = cur.fetchone()['id']

                    for action in run['actions']:
                        cur.execute("""
                            INSERT INTO execution_actions (run_id, action_type, action_payload, status, result)
                                VALUES (%s,%s,%s,%s,%s)
                            """, (
                                run_pk,
                                action.get('action_type', 'unknown'),
                                Json(action.get('payload', {})),
                                action.get('status', 'unknown'),
                                Json(action),
                            ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to persist run: {exc}")
