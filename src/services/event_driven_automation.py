"""
Event-Driven Automation Service for Velocity Brain.

This service provides event-driven automation capabilities,
triggering workflows based on external events and system changes.
"""

import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Callable, Set
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
import hashlib

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


class EventType(Enum):
    """Types of events."""
    ENTITY_CREATED = "entity_created"
    ENTITY_UPDATED = "entity_updated"
    ENTITY_DELETED = "entity_deleted"
    WORKFLOW_COMPLETED = "workflow_completed"
    WORKFLOW_FAILED = "workflow_failed"
    TASK_CREATED = "task_created"
    TASK_COMPLETED = "task_completed"
    API_CALLED = "api_called"
    EMAIL_RECEIVED = "email_received"
    WEBHOOK_RECEIVED = "webhook_received"
    SCHEDULE_TRIGGERED = "schedule_triggered"
    CUSTOM = "custom"


class EventStatus(Enum):
    """Event processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    IGNORED = "ignored"


class TriggerType(Enum):
    """Types of triggers."""
    EVENT = "event"
    WEBHOOK = "webhook"
    POLLING = "polling"
    SCHEDULE = "schedule"


@dataclass
class Event:
    """System event."""
    id: str
    event_type: EventType
    source: str
    data: Dict[str, Any]
    metadata: Dict[str, Any]
    timestamp: datetime
    processed: bool = False
    processing_attempts: int = 0


@dataclass
class EventTrigger:
    """Event trigger definition."""
    id: str
    name: str
    description: str
    trigger_type: TriggerType
    event_types: List[EventType]
    event_filters: Dict[str, Any]
    webhook_config: Dict[str, Any]
    polling_config: Dict[str, Any]
    workflow_id: Optional[str]
    action_config: Dict[str, Any]
    enabled: bool
    created_at: datetime
    updated_at: datetime
    created_by: str


@dataclass
class EventSubscription:
    """Event subscription for real-time processing."""
    id: str
    subscriber_id: str
    event_types: List[EventType]
    filters: Dict[str, Any]
    callback_url: Optional[str]
    webhook_secret: Optional[str]
    created_at: datetime


class EventDrivenAutomationService:
    """Advanced event-driven automation service."""
    
    def __init__(self):
        self.logger = get_logger('event_driven_automation')
        self.active_triggers = {}
        self.event_handlers = self._initialize_handlers()
        self.running_pollers = {}
        
    def _initialize_handlers(self) -> Dict[EventType, List[Callable]]:
        """Initialize event handlers for different event types."""
        return {
            EventType.ENTITY_CREATED: [self._handle_entity_created],
            EventType.ENTITY_UPDATED: [self._handle_entity_updated],
            EventType.ENTITY_DELETED: [self._handle_entity_deleted],
            EventType.WORKFLOW_COMPLETED: [self._handle_workflow_completed],
            EventType.WORKFLOW_FAILED: [self._handle_workflow_failed],
            EventType.TASK_CREATED: [self._handle_task_created],
            EventType.TASK_COMPLETED: [self._handle_task_completed],
            EventType.API_CALLED: [self._handle_api_called],
            EventType.EMAIL_RECEIVED: [self._handle_email_received],
            EventType.WEBHOOK_RECEIVED: [self._handle_webhook_received],
            EventType.SCHEDULE_TRIGGERED: [self._handle_schedule_triggered],
            EventType.CUSTOM: [self._handle_custom_event],
        }
    
    def create_event(self, event_data: Dict[str, Any]) -> Event:
        """Create a new system event."""
        try:
            event = Event(
                id=event_data.get('id', str(uuid.uuid4())),
                event_type=EventType(event_data.get('event_type', 'custom')),
                source=event_data.get('source', 'system'),
                data=event_data.get('data', {}),
                metadata=event_data.get('metadata', {}),
                timestamp=datetime.now(timezone.utc)
            )
            
            # Store event
            self._store_event(event)
            
            self.logger.info(f"Created event: {event.event_type.value} ({event.id})")
            return event
            
        except Exception as exc:
            self.logger.error(f"Failed to create event: {exc}")
            raise
    
    def create_trigger(self, trigger_data: Dict[str, Any], user: str) -> EventTrigger:
        """Create a new event trigger."""
        try:
            # Validate trigger data
            self._validate_trigger_data(trigger_data)
            
            # Create trigger
            trigger = EventTrigger(
                id=trigger_data.get('id', str(uuid.uuid4())),
                name=trigger_data.get('name', ''),
                description=trigger_data.get('description', ''),
                trigger_type=TriggerType(trigger_data.get('trigger_type', 'event')),
                event_types=[EventType(et) for et in trigger_data.get('event_types', [])],
                event_filters=trigger_data.get('event_filters', {}),
                webhook_config=trigger_data.get('webhook_config', {}),
                polling_config=trigger_data.get('polling_config', {}),
                workflow_id=trigger_data.get('workflow_id'),
                action_config=trigger_data.get('action_config', {}),
                enabled=trigger_data.get('enabled', True),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                created_by=user
            )
            
            # Store trigger
            self._store_trigger(trigger)
            
            # Activate trigger if enabled
            if trigger.enabled:
                self._activate_trigger(trigger)
            
            self.logger.info(f"Created trigger: {trigger.name} ({trigger.id})")
            return trigger
            
        except Exception as exc:
            self.logger.error(f"Failed to create trigger: {exc}")
            raise
    
    def _validate_trigger_data(self, trigger_data: Dict[str, Any]) -> None:
        """Validate trigger configuration."""
        trigger_type = trigger_data.get('trigger_type', 'event')
        
        if trigger_type == 'webhook':
            webhook_config = trigger_data.get('webhook_config', {})
            if not webhook_config.get('endpoint'):
                raise ValueError("Webhook endpoint is required for webhook triggers")
        
        elif trigger_type == 'polling':
            polling_config = trigger_data.get('polling_config', {})
            if not polling_config.get('url'):
                raise ValueError("Polling URL is required for polling triggers")
            if not polling_config.get('interval_seconds'):
                raise ValueError("Polling interval is required for polling triggers")
    
    def process_event(self, event: Event) -> List[Dict[str, Any]]:
        """Process an event through matching triggers."""
        try:
            # Mark event as processing
            event.processing_attempts += 1
            self._update_event(event)
            
            # Find matching triggers
            matching_triggers = self._find_matching_triggers(event)
            
            results = []
            for trigger in matching_triggers:
                try:
                    result = self._execute_trigger(trigger, event)
                    results.append(result)
                except Exception as exc:
                    self.logger.error(f"Failed to execute trigger {trigger.id}: {exc}")
                    results.append({
                        'trigger_id': trigger.id,
                        'status': 'failed',
                        'error': str(exc)
                    })
            
            # Mark event as processed
            event.processed = True
            self._update_event(event)
            
            self.logger.info(f"Processed event {event.id} through {len(matching_triggers)} triggers")
            return results
            
        except Exception as exc:
            self.logger.error(f"Failed to process event {event.id}: {exc}")
            raise
    
    def _find_matching_triggers(self, event: Event) -> List[EventTrigger]:
        """Find triggers that match the event."""
        try:
            # Load all enabled triggers
            triggers = self._load_enabled_triggers()
            
            matching_triggers = []
            for trigger in triggers:
                if self._event_matches_trigger(event, trigger):
                    matching_triggers.append(trigger)
            
            return matching_triggers
            
        except Exception as exc:
            self.logger.error(f"Failed to find matching triggers: {exc}")
            return []
    
    def _event_matches_trigger(self, event: Event, trigger: EventTrigger) -> bool:
        """Check if event matches trigger conditions."""
        # Check event type
        if event.event_type not in trigger.event_types:
            return False
        
        # Check event filters
        for filter_key, filter_value in trigger.event_filters.items():
            event_value = self._get_nested_value(event.data, filter_key)
            
            if not self._matches_filter(event_value, filter_value):
                return False
        
        return True
    
    def _get_nested_value(self, data: Dict[str, Any], key: str) -> Any:
        """Get nested value from dictionary using dot notation."""
        keys = key.split('.')
        value = data
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return None
        
        return value
    
    def _matches_filter(self, event_value: Any, filter_value: Any) -> bool:
        """Check if event value matches filter."""
        if isinstance(filter_value, dict):
            # Complex filter with operators
            operator = filter_value.get('operator', 'equals')
            value = filter_value.get('value')
            
            if operator == 'equals':
                return event_value == value
            elif operator == 'not_equals':
                return event_value != value
            elif operator == 'contains':
                return value in str(event_value) if event_value else False
            elif operator == 'not_contains':
                return value not in str(event_value) if event_value else True
            elif operator == 'greater_than':
                try:
                    return float(event_value) > float(value)
                except (TypeError, ValueError):
                    return False
            elif operator == 'less_than':
                try:
                    return float(event_value) < float(value)
                except (TypeError, ValueError):
                    return False
            elif operator == 'in':
                return event_value in value if isinstance(value, (list, tuple, set)) else False
            elif operator == 'not_in':
                return event_value not in value if isinstance(value, (list, tuple, set)) else True
        else:
            # Simple equality check
            return event_value == filter_value
        
        return False
    
    def _execute_trigger(self, trigger: EventTrigger, event: Event) -> Dict[str, Any]:
        """Execute trigger action."""
        try:
            if trigger.workflow_id:
                # Execute workflow
                return self._execute_workflow_trigger(trigger, event)
            elif trigger.action_config:
                # Execute custom action
                return self._execute_custom_action(trigger, event)
            else:
                raise ValueError("Trigger must have either workflow_id or action_config")
                
        except Exception as exc:
            self.logger.error(f"Failed to execute trigger {trigger.id}: {exc}")
            raise
    
    def _execute_workflow_trigger(self, trigger: EventTrigger, event: Event) -> Dict[str, Any]:
        """Execute workflow trigger."""
        # Import here to avoid circular imports
        from src.services.visual_workflow import visual_workflow
        
        # Prepare workflow context with event data
        context = {
            'event_id': event.id,
            'event_type': event.event_type.value,
            'event_source': event.source,
            'event_data': event.data,
            'event_metadata': event.metadata,
            'event_timestamp': event.timestamp.isoformat()
        }
        
        # Execute workflow
        workflow_execution = visual_workflow.execute_workflow(trigger.workflow_id, context)
        
        return {
            'trigger_id': trigger.id,
            'workflow_id': trigger.workflow_id,
            'workflow_execution_id': workflow_execution.execution_id,
            'status': workflow_execution.status,
            'result': workflow_execution.variables
        }
    
    def _execute_custom_action(self, trigger: EventTrigger, event: Event) -> Dict[str, Any]:
        """Execute custom action."""
        action_type = trigger.action_config.get('type', 'webhook')
        
        if action_type == 'webhook':
            return self._execute_webhook_action(trigger, event)
        elif action_type == 'email':
            return self._execute_email_action(trigger, event)
        elif action_type == 'api_call':
            return self._execute_api_call_action(trigger, event)
        elif action_type == 'script':
            return self._execute_script_action(trigger, event)
        else:
            raise ValueError(f"Unknown action type: {action_type}")
    
    def _execute_webhook_action(self, trigger: EventTrigger, event: Event) -> Dict[str, Any]:
        """Execute webhook action."""
        webhook_config = trigger.action_config.get('webhook_config', {})
        url = webhook_config.get('url')
        method = webhook_config.get('method', 'POST')
        headers = webhook_config.get('headers', {})
        
        # Prepare payload
        payload = {
            'trigger_id': trigger.id,
            'event': {
                'id': event.id,
                'type': event.event_type.value,
                'source': event.source,
                'data': event.data,
                'metadata': event.metadata,
                'timestamp': event.timestamp.isoformat()
            }
        }
        
        # Simulate webhook call
        return {
            'trigger_id': trigger.id,
            'action_type': 'webhook',
            'url': url,
            'method': method,
            'status': 'success',
            'sent_at': datetime.now(timezone.utc).isoformat(),
            'payload': payload
        }
    
    def _execute_email_action(self, trigger: EventTrigger, event: Event) -> Dict[str, Any]:
        """Execute email action."""
        email_config = trigger.action_config.get('email_config', {})
        to = email_config.get('to', [])
        subject = email_config.get('subject', f"Event: {event.event_type.value}")
        body = email_config.get('body_template', 'Event occurred: {event_type}')
        
        # Format body with event data
        body = body.format(
            event_type=event.event_type.value,
            event_source=event.source,
            event_timestamp=event.timestamp.isoformat(),
            event_data=json.dumps(event.data, indent=2)
        )
        
        # Simulate email sending
        return {
            'trigger_id': trigger.id,
            'action_type': 'email',
            'to': to,
            'subject': subject,
            'status': 'sent',
            'sent_at': datetime.now(timezone.utc).isoformat()
        }
    
    def _execute_api_call_action(self, trigger: EventTrigger, event: Event) -> Dict[str, Any]:
        """Execute API call action."""
        api_config = trigger.action_config.get('api_config', {})
        url = api_config.get('url')
        method = api_config.get('method', 'POST')
        headers = api_config.get('headers', {})
        
        # Prepare payload with event data
        payload = {
            'trigger_id': trigger.id,
            'event': event.__dict__
        }
        
        # Simulate API call
        return {
            'trigger_id': trigger.id,
            'action_type': 'api_call',
            'url': url,
            'method': method,
            'status': 'success',
            'response': {'message': 'API call executed'},
            'executed_at': datetime.now(timezone.utc).isoformat()
        }
    
    def _execute_script_action(self, trigger: EventTrigger, event: Event) -> Dict[str, Any]:
        """Execute script action."""
        script_config = trigger.action_config.get('script_config', {})
        script_path = script_config.get('script_path', '')
        script_content = script_config.get('script_content', '')
        
        # Simulate script execution
        return {
            'trigger_id': trigger.id,
            'action_type': 'script',
            'script_path': script_path,
            'status': 'executed',
            'executed_at': datetime.now(timezone.utc).isoformat(),
            'output': {'message': 'Script executed', 'event_data': event.data}
        }
    
    def _activate_trigger(self, trigger: EventTrigger) -> None:
        """Activate a trigger."""
        try:
            if trigger.trigger_type == TriggerType.WEBHOOK:
                self._activate_webhook_trigger(trigger)
            elif trigger.trigger_type == TriggerType.POLLING:
                self._activate_polling_trigger(trigger)
            
            self.active_triggers[trigger.id] = trigger
            self.logger.info(f"Activated trigger: {trigger.name} ({trigger.id})")
            
        except Exception as exc:
            self.logger.error(f"Failed to activate trigger {trigger.id}: {exc}")
    
    def _activate_webhook_trigger(self, trigger: EventTrigger) -> None:
        """Activate webhook trigger."""
        # Webhook triggers are activated via API endpoints
        # This method would register the webhook endpoint
        webhook_config = trigger.webhook_config
        endpoint = webhook_config.get('endpoint', f'/webhook/{trigger.id}')
        
        self.logger.info(f"Webhook trigger activated at endpoint: {endpoint}")
    
    def _activate_polling_trigger(self, trigger: EventTrigger) -> None:
        """Activate polling trigger."""
        import asyncio
        
        polling_config = trigger.polling_config
        interval_seconds = polling_config.get('interval_seconds', 60)
        
        async def poll():
            while trigger.id in self.active_triggers:
                try:
                    # Simulate polling
                    await asyncio.sleep(interval_seconds)
                    
                    # This would make actual HTTP request to polling URL
                    self.logger.debug(f"Polling trigger {trigger.id}")
                    
                except Exception as exc:
                    self.logger.error(f"Polling error for trigger {trigger.id}: {exc}")
        
        # Start polling task
        task = asyncio.create_task(poll())
        self.running_pollers[trigger.id] = task
        
        self.logger.info(f"Polling trigger activated with interval: {interval_seconds}s")
    
    def _handle_entity_created(self, event: Event) -> None:
        """Handle entity created event."""
        self.logger.info(f"Entity created: {event.data}")
    
    def _handle_entity_updated(self, event: Event) -> None:
        """Handle entity updated event."""
        self.logger.info(f"Entity updated: {event.data}")
    
    def _handle_entity_deleted(self, event: Event) -> None:
        """Handle entity deleted event."""
        self.logger.info(f"Entity deleted: {event.data}")
    
    def _handle_workflow_completed(self, event: Event) -> None:
        """Handle workflow completed event."""
        self.logger.info(f"Workflow completed: {event.data}")
    
    def _handle_workflow_failed(self, event: Event) -> None:
        """Handle workflow failed event."""
        self.logger.info(f"Workflow failed: {event.data}")
    
    def _handle_task_created(self, event: Event) -> None:
        """Handle task created event."""
        self.logger.info(f"Task created: {event.data}")
    
    def _handle_task_completed(self, event: Event) -> None:
        """Handle task completed event."""
        self.logger.info(f"Task completed: {event.data}")
    
    def _handle_api_called(self, event: Event) -> None:
        """Handle API called event."""
        self.logger.info(f"API called: {event.data}")
    
    def _handle_email_received(self, event: Event) -> None:
        """Handle email received event."""
        self.logger.info(f"Email received: {event.data}")
    
    def _handle_webhook_received(self, event: Event) -> None:
        """Handle webhook received event."""
        self.logger.info(f"Webhook received: {event.data}")
    
    def _handle_schedule_triggered(self, event: Event) -> None:
        """Handle schedule triggered event."""
        self.logger.info(f"Schedule triggered: {event.data}")
    
    def _handle_custom_event(self, event: Event) -> None:
        """Handle custom event."""
        self.logger.info(f"Custom event: {event.data}")
    
    def _store_event(self, event: Event) -> None:
        """Store event in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO events 
                            (id, event_type, source, data, metadata, timestamp, processed, processing_attempts)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        event.id,
                        event.event_type.value,
                        event.source,
                        json.dumps(event.data, default=str),
                        json.dumps(event.metadata, default=str),
                        event.timestamp,
                        event.processed,
                        event.processing_attempts
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to store event: {exc}")
            raise
    
    def _update_event(self, event: Event) -> None:
        """Update event in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE events 
                        SET processed = %s, processing_attempts = %s
                        WHERE id = %s
                    """, (
                        event.processed,
                        event.processing_attempts,
                        event.id
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to update event: {exc}")
    
    def _store_trigger(self, trigger: EventTrigger) -> None:
        """Store trigger in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO event_triggers 
                            (id, name, description, trigger_type, event_types, event_filters, 
                             webhook_config, polling_config, workflow_id, action_config, 
                             enabled, created_at, updated_at, created_by)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        trigger.id,
                        trigger.name,
                        trigger.description,
                        trigger.trigger_type.value,
                        json.dumps([et.value for et in trigger.event_types]),
                        json.dumps(trigger.event_filters, default=str),
                        json.dumps(trigger.webhook_config, default=str),
                        json.dumps(trigger.polling_config, default=str),
                        trigger.workflow_id,
                        json.dumps(trigger.action_config, default=str),
                        trigger.enabled,
                        trigger.created_at,
                        trigger.updated_at,
                        trigger.created_by
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to store trigger: {exc}")
            raise
    
    def _load_enabled_triggers(self) -> List[EventTrigger]:
        """Load all enabled triggers."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM event_triggers WHERE enabled = true ORDER BY created_at ASC
                    """)
                    
                    results = cur.fetchall()
                    triggers = []
                    
                    for result in results:
                        trigger = EventTrigger(
                            id=result['id'],
                            name=result['name'],
                            description=result['description'],
                            trigger_type=TriggerType(result['trigger_type']),
                            event_types=[EventType(et) for et in json.loads(result['event_types'])],
                            event_filters=json.loads(result['event_filters']),
                            webhook_config=json.loads(result['webhook_config']),
                            polling_config=json.loads(result['polling_config']),
                            workflow_id=result['workflow_id'],
                            action_config=json.loads(result['action_config']),
                            enabled=result['enabled'],
                            created_at=result['created_at'],
                            updated_at=result['updated_at'],
                            created_by=result['created_by']
                        )
                        triggers.append(trigger)
                    
                    return triggers
                    
        except Exception as exc:
            self.logger.error(f"Failed to load enabled triggers: {exc}")
            return []
    
    def get_unprocessed_events(self) -> List[Event]:
        """Get all unprocessed events."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM events 
                        WHERE processed = false 
                        ORDER BY timestamp ASC 
                        LIMIT 100
                    """)
                    
                    results = cur.fetchall()
                    events = []
                    
                    for result in results:
                        event = Event(
                            id=result['id'],
                            event_type=EventType(result['event_type']),
                            source=result['source'],
                            data=json.loads(result['data']),
                            metadata=json.loads(result['metadata']),
                            timestamp=result['timestamp'],
                            processed=result['processed'],
                            processing_attempts=result['processing_attempts']
                        )
                        events.append(event)
                    
                    return events
                    
        except Exception as exc:
            self.logger.error(f"Failed to get unprocessed events: {exc}")
            return []
    
    def process_events(self) -> int:
        """Process all unprocessed events."""
        processed_count = 0
        
        try:
            events = self.get_unprocessed_events()
            
            for event in events:
                try:
                    self.process_event(event)
                    processed_count += 1
                except Exception as exc:
                    self.logger.error(f"Failed to process event {event.id}: {exc}")
            
            self.logger.info(f"Processed {processed_count} events")
            return processed_count
            
        except Exception as exc:
            self.logger.error(f"Failed to process events: {exc}")
            return 0


# Global instance
event_driven_automation = EventDrivenAutomationService()
