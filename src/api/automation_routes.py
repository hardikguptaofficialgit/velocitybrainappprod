"""
Automation API Routes for Velocity Brain.

Provides endpoints for visual workflows, conditional logic,
scheduled automation, and event-driven automation.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import JSONResponse

from src.core.security import validator, token_manager, rate_limiter
from src.core.logging_config import get_logger, log_audit_event, log_error
from src.core.config import settings
from src.services.visual_workflow import visual_workflow
from src.services.conditional_logic import conditional_logic
from src.services.scheduled_automation import scheduled_automation
from src.services.event_driven_automation import event_driven_automation


router = APIRouter(prefix="/v2/automation", tags=["automation"])


# Visual Workflow Endpoints

@router.post("/workflows")
async def create_workflow(
    workflow_data: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Create a new visual workflow."""
    try:
        workflow = visual_workflow.create_workflow(workflow_data, user.actor)
        
        log_audit_event(
            "workflow_created",
            user.actor,
            {"workflow_id": workflow.id, "workflow_name": workflow.name}
        )
        
        return JSONResponse({
            "status": "success",
            "workflow": {
                "id": workflow.id,
                "name": workflow.name,
                "description": workflow.description,
                "version": workflow.version,
                "status": workflow.status,
                "node_count": len(workflow.nodes),
                "connection_count": len(workflow.connections),
                "created_at": workflow.created_at.isoformat()
            }
        })
        
    except Exception as exc:
        log_error(exc, {"workflow_data": workflow_data, "user": user.actor})
        raise HTTPException(status_code=500, detail="Workflow creation failed")


@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    trigger_data: Optional[Dict[str, Any]] = Body(None),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Execute a workflow."""
    try:
        workflow_id = validator.validate_slug(workflow_id)
        
        execution = visual_workflow.execute_workflow(workflow_id, trigger_data or {})
        
        log_audit_event(
            "workflow_executed",
            user.actor,
            {"workflow_id": workflow_id, "execution_id": execution.execution_id}
        )
        
        return JSONResponse({
            "status": "success",
            "execution": {
                "execution_id": execution.execution_id,
                "workflow_id": execution.workflow_id,
                "status": execution.status,
                "current_nodes": execution.current_nodes,
                "completed_nodes": execution.completed_nodes,
                "variables": execution.variables,
                "started_at": execution.started_at.isoformat(),
                "log_count": len(execution.logs)
            }
        })
        
    except Exception as exc:
        log_error(exc, {"workflow_id": workflow_id, "user": user.actor})
        raise HTTPException(status_code=500, detail="Workflow execution failed")


@router.get("/workflows/{workflow_id}/executions")
async def get_workflow_executions(
    workflow_id: str,
    limit: int = Query(50, description="Maximum number of executions to return"),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Get workflow execution history."""
    try:
        workflow_id = validator.validate_slug(workflow_id)
        limit = validator.validate_numeric_range(limit, 1, 200)
        
        # This would query the database for execution history
        # For now, return a mock response
        executions = []
        
        return JSONResponse({
            "status": "success",
            "workflow_id": workflow_id,
            "executions": executions,
            "total": len(executions),
            "limit": limit
        })
        
    except Exception as exc:
        log_error(exc, {"workflow_id": workflow_id, "user": user.actor})
        raise HTTPException(status_code=500, detail="Failed to get workflow executions")


# Conditional Logic Endpoints

@router.post("/rules")
async def create_rule(
    rule_data: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Create a new business rule."""
    try:
        rule = conditional_logic.create_rule(rule_data)
        
        log_audit_event(
            "rule_created",
            user.actor,
            {"rule_id": rule.id, "rule_name": rule.name}
        )
        
        return JSONResponse({
            "status": "success",
            "rule": {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "logical_operator": rule.logical_operator.value,
                "condition_count": len(rule.conditions),
                "action_count": len(rule.actions),
                "priority": rule.priority,
                "enabled": rule.enabled,
                "created_at": rule.created_at.isoformat()
            }
        })
        
    except Exception as exc:
        log_error(exc, {"rule_data": rule_data, "user": user.actor})
        raise HTTPException(status_code=500, detail="Rule creation failed")


@router.post("/rules/{rule_id}/evaluate")
async def evaluate_rule(
    rule_id: str,
    context: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Evaluate a rule against context."""
    try:
        rule_id = validator.validate_slug(rule_id)
        
        result = conditional_logic.evaluate_rule(rule_id, context)
        
        log_audit_event(
            "rule_evaluated",
            user.actor,
            {"rule_id": rule_id, "matched": result.matched, "confidence": result.confidence}
        )
        
        return JSONResponse({
            "status": "success",
            "rule_id": rule_id,
            "evaluation": {
                "matched": result.matched,
                "confidence": result.confidence,
                "actions": result.actions,
                "evaluation_time_ms": result.evaluation_time_ms,
                "variables_used": result.variables_used
            }
        })
        
    except Exception as exc:
        log_error(exc, {"rule_id": rule_id, "context": context, "user": user.actor})
        raise HTTPException(status_code=500, detail="Rule evaluation failed")


@router.post("/rules/evaluate")
async def evaluate_rules(
    context: Dict[str, Any] = Body(...),
    category: Optional[str] = Query(None, description="Rule category filter"),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Evaluate multiple rules against context."""
    try:
        results = conditional_logic.evaluate_rules(context, category)
        
        log_audit_event(
            "rules_evaluated",
            user.actor,
            {"context_keys": list(context.keys()), "category": category, "result_count": len(results)}
        )
        
        return JSONResponse({
            "status": "success",
            "context": context,
            "category": category,
            "results": [
                {
                    "rule_id": result.rule_id,
                    "matched": result.matched,
                    "confidence": result.confidence,
                    "actions": result.actions,
                    "evaluation_time_ms": result.evaluation_time_ms
                }
                for result in results
            ],
            "total": len(results)
        })
        
    except Exception as exc:
        log_error(exc, {"context": context, "category": category, "user": user.actor})
        raise HTTPException(status_code=500, detail="Rules evaluation failed")


@router.post("/decision-trees")
async def create_decision_tree(
    tree_data: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Create a new decision tree."""
    try:
        tree = conditional_logic.create_decision_tree(tree_data)
        
        log_audit_event(
            "decision_tree_created",
            user.actor,
            {"tree_id": tree.id, "tree_name": tree.name}
        )
        
        return JSONResponse({
            "status": "success",
            "decision_tree": {
                "id": tree.id,
                "name": tree.name,
                "variable_count": len(tree.variables),
                "created_at": tree.created_at.isoformat()
            }
        })
        
    except Exception as exc:
        log_error(exc, {"tree_data": tree_data, "user": user.actor})
        raise HTTPException(status_code=500, detail="Decision tree creation failed")


@router.post("/decision-trees/{tree_id}/evaluate")
async def evaluate_decision_tree(
    tree_id: str,
    context: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Evaluate a decision tree against context."""
    try:
        tree_id = validator.validate_slug(tree_id)
        
        result = conditional_logic.evaluate_decision_tree(tree_id, context)
        
        log_audit_event(
            "decision_tree_evaluated",
            user.actor,
            {"tree_id": tree_id, "result_type": result.get("type")}
        )
        
        return JSONResponse({
            "status": "success",
            "tree_id": tree_id,
            "context": context,
            "result": result
        })
        
    except Exception as exc:
        log_error(exc, {"tree_id": tree_id, "context": context, "user": user.actor})
        raise HTTPException(status_code=500, detail="Decision tree evaluation failed")


# Scheduled Automation Endpoints

@router.post("/schedules")
async def create_schedule(
    schedule_data: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Create a new scheduled task."""
    try:
        schedule = scheduled_automation.create_schedule(schedule_data, user.actor)
        
        log_audit_event(
            "schedule_created",
            user.actor,
            {"schedule_id": schedule.id, "schedule_name": schedule.name}
        )
        
        return JSONResponse({
            "status": "success",
            "schedule": {
                "id": schedule.id,
                "name": schedule.name,
                "description": schedule.description,
                "schedule_type": schedule.schedule_type.value,
                "cron_expression": schedule.cron_expression,
                "interval_seconds": schedule.interval_seconds,
                "timezone": schedule.timezone,
                "enabled": schedule.enabled,
                "created_at": schedule.created_at.isoformat()
            }
        })
        
    except Exception as exc:
        log_error(exc, {"schedule_data": schedule_data, "user": user.actor})
        raise HTTPException(status_code=500, detail="Schedule creation failed")


@router.post("/schedules/{schedule_id}/execute")
async def execute_schedule(
    schedule_id: str,
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Execute a scheduled task manually."""
    try:
        schedule_id = validator.validate_slug(schedule_id)
        
        execution = scheduled_automation.execute_schedule(schedule_id)
        
        log_audit_event(
            "schedule_executed",
            user.actor,
            {"schedule_id": schedule_id, "execution_id": execution.execution_id}
        )
        
        return JSONResponse({
            "status": "success",
            "execution": {
                "execution_id": execution.execution_id,
                "schedule_id": execution.schedule_id,
                "status": execution.status.value,
                "scheduled_at": execution.scheduled_at.isoformat(),
                "started_at": execution.started_at.isoformat() if execution.started_at else None,
                "retry_count": execution.retry_count
            }
        })
        
    except Exception as exc:
        log_error(exc, {"schedule_id": schedule_id, "user": user.actor})
        raise HTTPException(status_code=500, detail="Schedule execution failed")


@router.get("/schedules/{schedule_id}/next-execution")
async def get_next_execution_time(
    schedule_id: str,
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Get next execution time for a schedule."""
    try:
        schedule_id = validator.validate_slug(schedule_id)
        
        schedule = scheduled_automation._load_schedule(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        next_execution = scheduled_automation.get_next_execution_time(schedule)
        
        return JSONResponse({
            "status": "success",
            "schedule_id": schedule_id,
            "next_execution": next_execution.isoformat() if next_execution else None,
            "enabled": schedule.enabled
        })
        
    except HTTPException:
        raise
    except Exception as exc:
        log_error(exc, {"schedule_id": schedule_id, "user": user.actor})
        raise HTTPException(status_code=500, detail="Failed to get next execution time")


@router.get("/schedules/pending")
async def get_pending_executions(
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Get all pending schedule executions."""
    try:
        executions = scheduled_automation.get_pending_executions()
        
        return JSONResponse({
            "status": "success",
            "executions": [
                {
                    "execution_id": exec.execution_id,
                    "schedule_id": exec.schedule_id,
                    "status": exec.status.value,
                    "scheduled_at": exec.scheduled_at.isoformat(),
                    "started_at": exec.started_at.isoformat() if exec.started_at else None,
                    "retry_count": exec.retry_count,
                    "next_retry_at": exec.next_retry_at.isoformat() if exec.next_retry_at else None
                }
                for exec in executions
            ],
            "total": len(executions)
        })
        
    except Exception as exc:
        log_error(exc, {"user": user.actor})
        raise HTTPException(status_code=500, detail="Failed to get pending executions")


@router.post("/schedules/process")
async def process_scheduled_tasks(
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Process all scheduled tasks that are due."""
    try:
        processed_count = scheduled_automation.process_scheduled_tasks()
        
        log_audit_event(
            "scheduled_tasks_processed",
            user.actor,
            {"processed_count": processed_count}
        )
        
        return JSONResponse({
            "status": "success",
            "processed_count": processed_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as exc:
        log_error(exc, {"user": user.actor})
        raise HTTPException(status_code=500, detail="Failed to process scheduled tasks")


# Event-Driven Automation Endpoints

@router.post("/events")
async def create_event(
    event_data: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Create a new system event."""
    try:
        event = event_driven_automation.create_event(event_data)
        
        log_audit_event(
            "event_created",
            user.actor,
            {"event_id": event.id, "event_type": event.event_type.value}
        )
        
        return JSONResponse({
            "status": "success",
            "event": {
                "id": event.id,
                "event_type": event.event_type.value,
                "source": event.source,
                "timestamp": event.timestamp.isoformat(),
                "processed": event.processed
            }
        })
        
    except Exception as exc:
        log_error(exc, {"event_data": event_data, "user": user.actor})
        raise HTTPException(status_code=500, detail="Event creation failed")


@router.post("/triggers")
async def create_trigger(
    trigger_data: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Create a new event trigger."""
    try:
        trigger = event_driven_automation.create_trigger(trigger_data, user.actor)
        
        log_audit_event(
            "trigger_created",
            user.actor,
            {"trigger_id": trigger.id, "trigger_name": trigger.name}
        )
        
        return JSONResponse({
            "status": "success",
            "trigger": {
                "id": trigger.id,
                "name": trigger.name,
                "description": trigger.description,
                "trigger_type": trigger.trigger_type.value,
                "event_types": [et.value for et in trigger.event_types],
                "enabled": trigger.enabled,
                "created_at": trigger.created_at.isoformat()
            }
        })
        
    except Exception as exc:
        log_error(exc, {"trigger_data": trigger_data, "user": user.actor})
        raise HTTPException(status_code=500, detail="Trigger creation failed")


@router.post("/events/{event_id}/process")
async def process_event(
    event_id: str,
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Process an event through matching triggers."""
    try:
        event_id = validator.validate_slug(event_id)
        
        # Load event
        # This would load the event from database
        # For now, create a mock event
        event = type('Event', (), {
            'id': event_id,
            'event_type': type('EventType', (), {'value': 'custom'}),
            'source': 'api',
            'data': {},
            'metadata': {},
            'timestamp': datetime.now(timezone.utc)
        })()
        
        results = event_driven_automation.process_event(event)
        
        log_audit_event(
            "event_processed",
            user.actor,
            {"event_id": event_id, "trigger_count": len(results)}
        )
        
        return JSONResponse({
            "status": "success",
            "event_id": event_id,
            "results": results,
            "total": len(results)
        })
        
    except Exception as exc:
        log_error(exc, {"event_id": event_id, "user": user.actor})
        raise HTTPException(status_code=500, detail="Event processing failed")


@router.get("/events/unprocessed")
async def get_unprocessed_events(
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Get all unprocessed events."""
    try:
        events = event_driven_automation.get_unprocessed_events()
        
        return JSONResponse({
            "status": "success",
            "events": [
                {
                    "id": event.id,
                    "event_type": event.event_type.value,
                    "source": event.source,
                    "timestamp": event.timestamp.isoformat(),
                    "processing_attempts": event.processing_attempts
                }
                for event in events
            ],
            "total": len(events)
        })
        
    except Exception as exc:
        log_error(exc, {"user": user.actor})
        raise HTTPException(status_code=500, detail="Failed to get unprocessed events")


@router.post("/events/process")
async def process_events(
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Process all unprocessed events."""
    try:
        processed_count = event_driven_automation.process_events()
        
        log_audit_event(
            "events_processed",
            user.actor,
            {"processed_count": processed_count}
        )
        
        return JSONResponse({
            "status": "success",
            "processed_count": processed_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as exc:
        log_error(exc, {"user": user.actor})
        raise HTTPException(status_code=500, detail="Failed to process events")


# Webhook Endpoints

@router.post("/webhooks/{trigger_id}")
async def handle_webhook(
    trigger_id: str,
    webhook_data: Dict[str, Any] = Body(...),
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Handle incoming webhook for event trigger."""
    try:
        trigger_id = validator.validate_slug(trigger_id)
        
        # Create event from webhook data
        event_data = {
            "event_type": "webhook_received",
            "source": f"webhook_{trigger_id}",
            "data": webhook_data,
            "metadata": {
                "trigger_id": trigger_id,
                "webhook": True
            }
        }
        
        event = event_driven_automation.create_event(event_data)
        
        # Process event immediately
        results = event_driven_automation.process_event(event)
        
        log_audit_event(
            "webhook_received",
            user.actor,
            {"trigger_id": trigger_id, "event_id": event.id, "results_count": len(results)}
        )
        
        return JSONResponse({
            "status": "success",
            "event_id": event.id,
            "trigger_id": trigger_id,
            "processed": True,
            "results": results
        })
        
    except Exception as exc:
        log_error(exc, {"trigger_id": trigger_id, "webhook_data": webhook_data, "user": user.actor})
        raise HTTPException(status_code=500, detail="Webhook processing failed")


# Automation Status Endpoints

@router.get("/status")
async def get_automation_status(
    user: Any = Depends(token_manager.validate_token),
    _: Any = Depends(rate_limiter.is_allowed)
):
    """Get overall automation system status."""
    try:
        # Get counts from various automation systems
        pending_events = len(event_driven_automation.get_unprocessed_events())
        pending_executions = len(scheduled_automation.get_pending_executions())
        
        return JSONResponse({
            "status": "success",
            "automation_status": {
                "event_driven": {
                    "pending_events": pending_events,
                    "active_triggers": len(event_driven_automation.active_triggers)
                },
                "scheduled": {
                    "pending_executions": pending_executions,
                    "active_pollers": len(event_driven_automation.running_pollers)
                },
                "overall": {
                    "healthy": True,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
        })
        
    except Exception as exc:
        log_error(exc, {"user": user.actor})
        raise HTTPException(status_code=500, detail="Failed to get automation status")
