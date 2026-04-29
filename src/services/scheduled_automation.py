"""
Scheduled Automation Service for Velocity Brain.

This service provides advanced cron-based scheduling with timezone support,
dependency management, and intelligent execution.
"""

import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
import pytz
from croniter import croniter

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


class ScheduleType(Enum):
    """Types of scheduling."""
    CRON = "cron"
    INTERVAL = "interval"
    ONCE = "once"
    EVENT_DRIVEN = "event_driven"


class ScheduleStatus(Enum):
    """Schedule execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class DependencyType(Enum):
    """Types of dependencies."""
    SUCCESS = "success"
    COMPLETION = "completion"
    FAILURE = "failure"
    TIMEOUT = "timeout"


@dataclass
class Schedule:
    """Scheduled task definition."""
    id: str
    name: str
    description: str
    schedule_type: ScheduleType
    cron_expression: Optional[str]
    interval_seconds: Optional[int]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    timezone: str
    workflow_id: Optional[str]
    action_config: Dict[str, Any]
    dependencies: List[Dict[str, Any]]
    retry_config: Dict[str, Any]
    enabled: bool
    created_at: datetime
    updated_at: datetime
    created_by: str


@dataclass
class ScheduleExecution:
    """Individual schedule execution."""
    execution_id: str
    schedule_id: str
    status: ScheduleStatus
    scheduled_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    retry_count: int
    next_retry_at: Optional[datetime]
    metadata: Dict[str, Any]


@dataclass
class Dependency:
    """Dependency between schedules."""
    id: str
    dependent_schedule_id: str
    dependency_schedule_id: str
    dependency_type: DependencyType
    timeout_minutes: int
    created_at: datetime


class ScheduledAutomationService:
    """Advanced scheduled automation service."""
    
    def __init__(self):
        self.logger = get_logger('scheduled_automation')
        self.running_schedules = {}
        self.execution_handlers = self._initialize_handlers()
        
    def _initialize_handlers(self) -> Dict[str, Callable]:
        """Initialize execution handlers for different action types."""
        return {
            'workflow': self._execute_workflow_action,
            'api_call': self._execute_api_call_action,
            'email': self._execute_email_action,
            'task': self._execute_task_action,
            'webhook': self._execute_webhook_action,
            'script': self._execute_script_action,
        }
    
    def create_schedule(self, schedule_data: Dict[str, Any], user: str) -> Schedule:
        """Create a new scheduled task."""
        try:
            # Validate schedule data
            self._validate_schedule_data(schedule_data)
            
            # Create schedule
            schedule = Schedule(
                id=schedule_data.get('id', str(uuid.uuid4())),
                name=schedule_data.get('name', ''),
                description=schedule_data.get('description', ''),
                schedule_type=ScheduleType(schedule_data.get('schedule_type', 'cron')),
                cron_expression=schedule_data.get('cron_expression'),
                interval_seconds=schedule_data.get('interval_seconds'),
                start_time=self._parse_datetime(schedule_data.get('start_time')),
                end_time=self._parse_datetime(schedule_data.get('end_time')),
                timezone=schedule_data.get('timezone', 'UTC'),
                workflow_id=schedule_data.get('workflow_id'),
                action_config=schedule_data.get('action_config', {}),
                dependencies=schedule_data.get('dependencies', []),
                retry_config=schedule_data.get('retry_config', {}),
                enabled=schedule_data.get('enabled', True),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                created_by=user
            )
            
            # Store schedule
            self._store_schedule(schedule)
            
            self.logger.info(f"Created schedule: {schedule.name} ({schedule.id})")
            return schedule
            
        except Exception as exc:
            self.logger.error(f"Failed to create schedule: {exc}")
            raise
    
    def _validate_schedule_data(self, schedule_data: Dict[str, Any]) -> None:
        """Validate schedule configuration."""
        schedule_type = schedule_data.get('schedule_type', 'cron')
        
        if schedule_type == 'cron':
            cron_expression = schedule_data.get('cron_expression')
            if not cron_expression:
                raise ValueError("Cron expression is required for cron schedules")
            
            # Validate cron expression
            try:
                croniter(cron_expression)
            except Exception as e:
                raise ValueError(f"Invalid cron expression: {e}")
        
        elif schedule_type == 'interval':
            interval_seconds = schedule_data.get('interval_seconds')
            if not interval_seconds or interval_seconds <= 0:
                raise ValueError("Interval seconds must be positive")
        
        # Validate timezone
        timezone_str = schedule_data.get('timezone', 'UTC')
        try:
            pytz.timezone(timezone_str)
        except Exception:
            raise ValueError(f"Invalid timezone: {timezone_str}")
    
    def _parse_datetime(self, datetime_str: Optional[str]) -> Optional[datetime]:
        """Parse datetime string to datetime object."""
        if not datetime_str:
            return None
        
        try:
            return datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
        except Exception:
            return None
    
    def get_next_execution_time(self, schedule: Schedule) -> Optional[datetime]:
        """Calculate next execution time for a schedule."""
        try:
            if not schedule.enabled:
                return None
            
            # Check if schedule has ended
            if schedule.end_time and schedule.end_time < datetime.now(timezone.utc):
                return None
            
            # Get current time in schedule's timezone
            tz = pytz.timezone(schedule.timezone)
            now = datetime.now(tz)
            
            if schedule.schedule_type == ScheduleType.CRON:
                if not schedule.cron_expression:
                    return None
                
                cron = croniter(schedule.cron_expression, now)
                next_time = cron.get_next(datetime)
                
                # Convert back to UTC
                return next_time.astimezone(timezone.utc)
            
            elif schedule.schedule_type == ScheduleType.INTERVAL:
                if not schedule.interval_seconds:
                    return None
                
                # Get last execution time
                last_execution = self._get_last_execution(schedule.id)
                if last_execution:
                    next_time = last_execution + timedelta(seconds=schedule.interval_seconds)
                else:
                    # First execution
                    next_time = now + timedelta(seconds=schedule.interval_seconds)
                
                return next_time.astimezone(timezone.utc)
            
            elif schedule.schedule_type == ScheduleType.ONCE:
                if schedule.start_time:
                    return schedule.start_time
                return None
            
            return None
            
        except Exception as exc:
            self.logger.error(f"Failed to calculate next execution time: {exc}")
            return None
    
    def execute_schedule(self, schedule_id: str) -> ScheduleExecution:
        """Execute a scheduled task."""
        try:
            # Load schedule
            schedule = self._load_schedule(schedule_id)
            if not schedule:
                raise ValueError(f"Schedule {schedule_id} not found")
            
            if not schedule.enabled:
                raise ValueError(f"Schedule {schedule_id} is disabled")
            
            # Check dependencies
            if not self._check_dependencies(schedule):
                self.logger.info(f"Skipping schedule {schedule_id} due to unmet dependencies")
                return self._create_skipped_execution(schedule_id, "Dependencies not met")
            
            # Create execution record
            execution = ScheduleExecution(
                execution_id=str(uuid.uuid4()),
                schedule_id=schedule_id,
                status=ScheduleStatus.RUNNING,
                scheduled_at=datetime.now(timezone.utc),
                started_at=datetime.now(timezone.utc),
                completed_at=None,
                result=None,
                error_message=None,
                retry_count=0,
                next_retry_at=None,
                metadata={}
            )
            
            # Store execution
            self._store_execution(execution)
            
            # Execute action
            try:
                action_type = schedule.action_config.get('type', 'workflow')
                handler = self.execution_handlers.get(action_type)
                
                if not handler:
                    raise ValueError(f"Unknown action type: {action_type}")
                
                result = handler(schedule.action_config, execution)
                
                # Update execution with success
                execution.status = ScheduleStatus.COMPLETED
                execution.result = result
                execution.completed_at = datetime.now(timezone.utc)
                
                self.logger.info(f"Successfully executed schedule {schedule_id}")
                
            except Exception as exc:
                # Update execution with error
                execution.status = ScheduleStatus.FAILED
                execution.error_message = str(exc)
                execution.completed_at = datetime.now(timezone.utc)
                
                self.logger.error(f"Failed to execute schedule {schedule_id}: {exc}")
                
                # Check if retry is needed
                if self._should_retry(schedule, execution):
                    execution.next_retry_at = self._calculate_retry_time(schedule, execution)
                    execution.status = ScheduleStatus.PENDING
            
            # Update execution
            self._update_execution(execution)
            
            return execution
            
        except Exception as exc:
            self.logger.error(f"Failed to execute schedule {schedule_id}: {exc}")
            raise
    
    def _check_dependencies(self, schedule: Schedule) -> bool:
        """Check if all dependencies are satisfied."""
        for dependency in schedule.dependencies:
            dependency_schedule_id = dependency.get('schedule_id')
            dependency_type = DependencyType(dependency.get('type', 'success'))
            
            # Get last execution of dependency
            last_execution = self._get_last_execution(dependency_schedule_id)
            if not last_execution:
                return False
            
            # Check dependency type
            if dependency_type == DependencyType.SUCCESS:
                if last_execution.status != ScheduleStatus.COMPLETED:
                    return False
            elif dependency_type == DependencyType.COMPLETION:
                if last_execution.status not in [ScheduleStatus.COMPLETED, ScheduleStatus.FAILED]:
                    return False
            elif dependency_type == DependencyType.FAILURE:
                if last_execution.status != ScheduleStatus.FAILED:
                    return False
            
            # Check timeout
            timeout_minutes = dependency.get('timeout_minutes', 60)
            if last_execution.completed_at:
                timeout_time = last_execution.completed_at + timedelta(minutes=timeout_minutes)
                if datetime.now(timezone.utc) > timeout_time:
                    return False
        
        return True
    
    def _create_skipped_execution(self, schedule_id: str, reason: str) -> ScheduleExecution:
        """Create a skipped execution record."""
        execution = ScheduleExecution(
            execution_id=str(uuid.uuid4()),
            schedule_id=schedule_id,
            status=ScheduleStatus.SKIPPED,
            scheduled_at=datetime.now(timezone.utc),
            started_at=None,
            completed_at=datetime.now(timezone.utc),
            result=None,
            error_message=reason,
            retry_count=0,
            next_retry_at=None,
            metadata={'skip_reason': reason}
        )
        
        self._store_execution(execution)
        return execution
    
    def _should_retry(self, schedule: Schedule, execution: ScheduleExecution) -> bool:
        """Check if execution should be retried."""
        retry_config = schedule.retry_config
        if not retry_config:
            return False
        
        max_retries = retry_config.get('max_retries', 0)
        if execution.retry_count >= max_retries:
            return False
        
        retry_on_status = retry_config.get('retry_on_status', ['failed'])
        if execution.status.value not in retry_on_status:
            return False
        
        return True
    
    def _calculate_retry_time(self, schedule: Schedule, execution: ScheduleExecution) -> datetime:
        """Calculate next retry time."""
        retry_config = schedule.retry_config
        retry_strategy = retry_config.get('strategy', 'exponential_backoff')
        base_delay = retry_config.get('base_delay_seconds', 60)
        max_delay = retry_config.get('max_delay_seconds', 3600)
        
        if retry_strategy == 'fixed':
            delay = base_delay
        elif retry_strategy == 'exponential_backoff':
            delay = min(base_delay * (2 ** execution.retry_count), max_delay)
        elif retry_strategy == 'linear_backoff':
            delay = min(base_delay * (execution.retry_count + 1), max_delay)
        else:
            delay = base_delay
        
        return datetime.now(timezone.utc) + timedelta(seconds=delay)
    
    def _execute_workflow_action(self, action_config: Dict[str, Any], execution: ScheduleExecution) -> Dict[str, Any]:
        """Execute workflow action."""
        workflow_id = action_config.get('workflow_id')
        if not workflow_id:
            raise ValueError("Workflow ID is required for workflow action")
        
        # Import here to avoid circular imports
        from src.services.visual_workflow import visual_workflow
        
        # Execute workflow
        workflow_execution = visual_workflow.execute_workflow(workflow_id, {
            'schedule_execution_id': execution.execution_id,
            'scheduled_at': execution.scheduled_at.isoformat()
        })
        
        return {
            'workflow_execution_id': workflow_execution.execution_id,
            'status': workflow_execution.status,
            'result': workflow_execution.variables
        }
    
    def _execute_api_call_action(self, action_config: Dict[str, Any], execution: ScheduleExecution) -> Dict[str, Any]:
        """Execute API call action."""
        url = action_config.get('url')
        method = action_config.get('method', 'GET')
        headers = action_config.get('headers', {})
        body = action_config.get('body', {})
        
        # Simulate API call
        return {
            'url': url,
            'method': method,
            'status': 'success',
            'response': {'message': 'API call executed', 'timestamp': datetime.now(timezone.utc).isoformat()}
        }
    
    def _execute_email_action(self, action_config: Dict[str, Any], execution: ScheduleExecution) -> Dict[str, Any]:
        """Execute email action."""
        to = action_config.get('to', [])
        subject = action_config.get('subject', '')
        body = action_config.get('body', '')
        
        # Simulate email sending
        return {
            'to': to,
            'subject': subject,
            'status': 'sent',
            'sent_at': datetime.now(timezone.utc).isoformat()
        }
    
    def _execute_task_action(self, action_config: Dict[str, Any], execution: ScheduleExecution) -> Dict[str, Any]:
        """Execute task creation action."""
        task_name = action_config.get('task_name', '')
        assignee = action_config.get('assignee', '')
        due_date = action_config.get('due_date')
        
        # Simulate task creation
        return {
            'task_name': task_name,
            'assignee': assignee,
            'due_date': due_date,
            'status': 'created',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    
    def _execute_webhook_action(self, action_config: Dict[str, Any], execution: ScheduleExecution) -> Dict[str, Any]:
        """Execute webhook action."""
        webhook_url = action_config.get('webhook_url', '')
        method = action_config.get('method', 'POST')
        payload = action_config.get('payload', {})
        
        # Simulate webhook call
        return {
            'webhook_url': webhook_url,
            'method': method,
            'payload': payload,
            'status': 'success',
            'executed_at': datetime.now(timezone.utc).isoformat()
        }
    
    def _execute_script_action(self, action_config: Dict[str, Any], execution: ScheduleExecution) -> Dict[str, Any]:
        """Execute script action."""
        script_path = action_config.get('script_path', '')
        script_content = action_config.get('script_content', '')
        parameters = action_config.get('parameters', {})
        
        # Simulate script execution
        return {
            'script_path': script_path,
            'parameters': parameters,
            'status': 'executed',
            'executed_at': datetime.now(timezone.utc).isoformat(),
            'output': {'message': 'Script executed successfully'}
        }
    
    def get_pending_executions(self) -> List[ScheduleExecution]:
        """Get all pending schedule executions."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM schedule_executions 
                        WHERE status IN ('pending', 'running')
                        ORDER BY scheduled_at ASC
                    """)
                    
                    results = cur.fetchall()
                    executions = []
                    
                    for result in results:
                        execution = ScheduleExecution(
                            execution_id=result['execution_id'],
                            schedule_id=result['schedule_id'],
                            status=ScheduleStatus(result['status']),
                            scheduled_at=result['scheduled_at'],
                            started_at=result['started_at'],
                            completed_at=result['completed_at'],
                            result=json.loads(result['result']) if result['result'] else None,
                            error_message=result['error_message'],
                            retry_count=result['retry_count'],
                            next_retry_at=result['next_retry_at'],
                            metadata=json.loads(result['metadata']) if result['metadata'] else {}
                        )
                        executions.append(execution)
                    
                    return executions
                    
        except Exception as exc:
            self.logger.error(f"Failed to get pending executions: {exc}")
            return []
    
    def process_scheduled_tasks(self) -> int:
        """Process all scheduled tasks that are due."""
        processed_count = 0
        
        try:
            # Get all enabled schedules
            schedules = self._load_enabled_schedules()
            
            for schedule in schedules:
                next_execution = self.get_next_execution_time(schedule)
                
                if next_execution and next_execution <= datetime.now(timezone.utc):
                    # Check if already executed at this time
                    if not self._is_already_executed(schedule.id, next_execution):
                        self.execute_schedule(schedule.id)
                        processed_count += 1
            
            self.logger.info(f"Processed {processed_count} scheduled tasks")
            return processed_count
            
        except Exception as exc:
            self.logger.error(f"Failed to process scheduled tasks: {exc}")
            return 0
    
    def _store_schedule(self, schedule: Schedule) -> None:
        """Store schedule in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO schedules 
                            (id, name, description, schedule_type, cron_expression, interval_seconds, 
                             start_time, end_time, timezone, workflow_id, action_config, dependencies, 
                             retry_config, enabled, created_at, updated_at, created_by)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        schedule.id,
                        schedule.name,
                        schedule.description,
                        schedule.schedule_type.value,
                        schedule.cron_expression,
                        schedule.interval_seconds,
                        schedule.start_time,
                        schedule.end_time,
                        schedule.timezone,
                        schedule.workflow_id,
                        json.dumps(schedule.action_config, default=str),
                        json.dumps(schedule.dependencies, default=str),
                        json.dumps(schedule.retry_config, default=str),
                        schedule.enabled,
                        schedule.created_at,
                        schedule.updated_at,
                        schedule.created_by
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to store schedule: {exc}")
            raise
    
    def _load_schedule(self, schedule_id: str) -> Optional[Schedule]:
        """Load schedule from database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM schedules WHERE id = %s
                    """, (schedule_id,))
                    
                    result = cur.fetchone()
                    if not result:
                        return None
                    
                    return Schedule(
                        id=result['id'],
                        name=result['name'],
                        description=result['description'],
                        schedule_type=ScheduleType(result['schedule_type']),
                        cron_expression=result['cron_expression'],
                        interval_seconds=result['interval_seconds'],
                        start_time=result['start_time'],
                        end_time=result['end_time'],
                        timezone=result['timezone'],
                        workflow_id=result['workflow_id'],
                        action_config=json.loads(result['action_config']),
                        dependencies=json.loads(result['dependencies']),
                        retry_config=json.loads(result['retry_config']),
                        enabled=result['enabled'],
                        created_at=result['created_at'],
                        updated_at=result['updated_at'],
                        created_by=result['created_by']
                    )
                    
        except Exception as exc:
            self.logger.error(f"Failed to load schedule {schedule_id}: {exc}")
            return None
    
    def _load_enabled_schedules(self) -> List[Schedule]:
        """Load all enabled schedules."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM schedules WHERE enabled = true ORDER BY created_at ASC
                    """)
                    
                    results = cur.fetchall()
                    schedules = []
                    
                    for result in results:
                        schedule = Schedule(
                            id=result['id'],
                            name=result['name'],
                            description=result['description'],
                            schedule_type=ScheduleType(result['schedule_type']),
                            cron_expression=result['cron_expression'],
                            interval_seconds=result['interval_seconds'],
                            start_time=result['start_time'],
                            end_time=result['end_time'],
                            timezone=result['timezone'],
                            workflow_id=result['workflow_id'],
                            action_config=json.loads(result['action_config']),
                            dependencies=json.loads(result['dependencies']),
                            retry_config=json.loads(result['retry_config']),
                            enabled=result['enabled'],
                            created_at=result['created_at'],
                            updated_at=result['updated_at'],
                            created_by=result['created_by']
                        )
                        schedules.append(schedule)
                    
                    return schedules
                    
        except Exception as exc:
            self.logger.error(f"Failed to load enabled schedules: {exc}")
            return []
    
    def _store_execution(self, execution: ScheduleExecution) -> None:
        """Store execution in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO schedule_executions 
                            (execution_id, schedule_id, status, scheduled_at, started_at, completed_at, 
                             result, error_message, retry_count, next_retry_at, metadata)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        execution.execution_id,
                        execution.schedule_id,
                        execution.status.value,
                        execution.scheduled_at,
                        execution.started_at,
                        execution.completed_at,
                        json.dumps(execution.result, default=str) if execution.result else None,
                        execution.error_message,
                        execution.retry_count,
                        execution.next_retry_at,
                        json.dumps(execution.metadata, default=str)
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to store execution: {exc}")
            raise
    
    def _update_execution(self, execution: ScheduleExecution) -> None:
        """Update execution in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE schedule_executions 
                        SET status = %s, started_at = %s, completed_at = %s, result = %s, 
                            error_message = %s, retry_count = %s, next_retry_at = %s, metadata = %s
                        WHERE execution_id = %s
                    """, (
                        execution.status.value,
                        execution.started_at,
                        execution.completed_at,
                        json.dumps(execution.result, default=str) if execution.result else None,
                        execution.error_message,
                        execution.retry_count,
                        execution.next_retry_at,
                        json.dumps(execution.metadata, default=str),
                        execution.execution_id
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to update execution: {exc}")
            raise
    
    def _get_last_execution(self, schedule_id: str) -> Optional[ScheduleExecution]:
        """Get last execution of a schedule."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM schedule_executions 
                        WHERE schedule_id = %s 
                        ORDER BY scheduled_at DESC 
                        LIMIT 1
                    """, (schedule_id,))
                    
                    result = cur.fetchone()
                    if not result:
                        return None
                    
                    return ScheduleExecution(
                        execution_id=result['execution_id'],
                        schedule_id=result['schedule_id'],
                        status=ScheduleStatus(result['status']),
                        scheduled_at=result['scheduled_at'],
                        started_at=result['started_at'],
                        completed_at=result['completed_at'],
                        result=json.loads(result['result']) if result['result'] else None,
                        error_message=result['error_message'],
                        retry_count=result['retry_count'],
                        next_retry_at=result['next_retry_at'],
                        metadata=json.loads(result['metadata']) if result['metadata'] else {}
                    )
                    
        except Exception as exc:
            self.logger.error(f"Failed to get last execution: {exc}")
            return None
    
    def _is_already_executed(self, schedule_id: str, execution_time: datetime) -> bool:
        """Check if schedule was already executed at the given time."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT COUNT(*) as count FROM schedule_executions 
                        WHERE schedule_id = %s AND scheduled_at = %s
                    """, (schedule_id, execution_time))
                    
                    result = cur.fetchone()
                    return result['count'] > 0
                    
        except Exception as exc:
            self.logger.error(f"Failed to check if already executed: {exc}")
            return False


# Global instance
scheduled_automation = ScheduledAutomationService()
