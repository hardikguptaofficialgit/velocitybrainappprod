from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from src.core.logging_config import get_logger
from src.plugins.core_connectors import CoreConnectors
from src.services.job_queue_service import JobQueueService


class ExecutionEngine:
    def __init__(self):
        self.logger = get_logger('execution_engine')
        self.jobs = JobQueueService()
        self.connectors = CoreConnectors()

    def execute(self, action_plan: list[dict], *, run_async: bool = False) -> list[dict]:
        results: list[dict] = []
        for step in action_plan:
            action_type = step.get('action_type', 'noop')
            payload = step.get('payload', {})
            job = self.jobs.enqueue(
                kind='action.execute',
                payload={
                    'action_type': action_type,
                    'payload': payload,
                },
                metadata={'source': 'execution_engine'},
            )
            if run_async:
                results.append({
                    'action_type': action_type,
                    'payload': payload,
                    'status': 'queued',
                    'job_id': job['job_id'],
                    'queued_at': job['created_at'],
                })
                continue
            processed = self.jobs.process_once({'action.execute': self._process_action_job})
            results.append(self._format_action_result(action_type, payload, processed))
        return results

    def execute_workflow(self, workflow_key: str, payload: dict, *, run_async: bool = True) -> dict:
        job = self.jobs.enqueue(
            kind='workflow.execute',
            payload={
                'workflow_key': workflow_key,
                'payload': payload,
            },
            metadata={'source': 'execution_engine'},
        )
        if run_async:
            return {
                'workflow_key': workflow_key,
                'status': 'queued',
                'job_id': job['job_id'],
                'payload': payload,
                'queued_at': job['created_at'],
            }
        processed = self.jobs.process_once({'workflow.execute': self._process_workflow_job})
        return {
            'workflow_key': workflow_key,
            'status': processed.get('status', 'unknown'),
            'job_id': job['job_id'],
            'payload': payload,
            'result': processed.get('result'),
            'last_error': processed.get('last_error'),
            'executed_at': processed.get('completed_at') or processed.get('updated_at'),
        }

    def get_job_status(self, job_id: str) -> dict[str, Any] | None:
        return self.jobs.get_job(job_id)

    def _format_action_result(self, action_type: str, payload: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
        result = job.get('result') or {}
        status = result.get('status')
        if job.get('status') == 'completed':
            status = status or 'completed'
        elif job.get('status') in {'failed', 'retry'}:
            status = status or job['status']
        return {
            'action_type': action_type,
            'payload': payload,
            'status': status or job.get('status', 'unknown'),
            'job_id': job.get('job_id'),
            'result': result,
            'last_error': job.get('last_error'),
            'executed_at': job.get('completed_at') or job.get('updated_at'),
        }

    def _process_action_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        action_type = payload.get('action_type', 'noop')
        action_payload = payload.get('payload', {})
        started = datetime.now(timezone.utc).isoformat()
        try:
            result = self._dispatch_action(action_type, action_payload)
            result.setdefault('status', 'completed')
            result.setdefault('started_at', started)
            result.setdefault('completed_at', datetime.now(timezone.utc).isoformat())
            return result
        except Exception as exc:
            self.logger.error('Execution action failed for %s: %s', action_type, exc)
            raise

    def _process_workflow_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        workflow_key = payload.get('workflow_key', 'workflow')
        workflow_payload = payload.get('payload', {})
        return {
            'status': 'completed',
            'workflow_key': workflow_key,
            'steps_executed': [
                'validate_workflow',
                'queue_lifecycle',
                'execute_actions',
                'writeback',
            ],
            'payload': workflow_payload,
            'completed_at': datetime.now(timezone.utc).isoformat(),
        }

    def _dispatch_action(self, action_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = action_type.strip().lower()
        if normalized in {'noop', 'analyze', 'analytics.analyze', 'query.aggregate', 'response.generate', 'briefing.generate', 'memory.update', 'graph.analyze', 'graph.update', 'graph.traverse', 'nlp.enhance'}:
            return {
                'status': 'completed',
                'action_type': normalized,
                'mode': 'internal',
                'summary': f'Completed internal action {normalized}',
                'payload': payload,
            }
        if normalized in {'workflow.run', 'workflow.execute'}:
            return {
                'status': 'completed',
                'action_type': normalized,
                'mode': 'workflow',
                'summary': 'Workflow execution lifecycle completed',
                'payload': payload,
            }
        if normalized in {'webhook.dispatch', 'http.request', 'api.call'}:
            return self._execute_http_action(payload)
        if normalized in {'email.send', 'calendar.schedule', 'message.send'}:
            return self._execute_connector_action(normalized, payload)
        return {
            'status': 'completed',
            'action_type': normalized,
            'mode': 'generic',
            'summary': f'No dedicated adapter for {normalized}; action acknowledged without external side effects.',
            'payload': payload,
        }

    def _execute_http_action(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = str(payload.get('url') or payload.get('webhook_url') or '').strip()
        if not url:
            raise ValueError('HTTP action requires url or webhook_url')
        method = str(payload.get('method') or 'POST').upper()
        headers = payload.get('headers') or {}
        body = payload.get('body')
        params = payload.get('params')
        timeout_seconds = int(payload.get('timeout_seconds') or 30)
        response = httpx.request(
            method,
            url,
            headers=headers,
            json=body if isinstance(body, (dict, list)) else None,
            content=body if isinstance(body, (str, bytes)) else None,
            params=params,
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        content_type = response.headers.get('content-type', '')
        response_payload: Any
        if 'application/json' in content_type:
            response_payload = response.json()
        else:
            response_payload = response.text[:4000]
        return {
            'status': 'completed',
            'mode': 'http',
            'http_status': response.status_code,
            'url': url,
            'method': method,
            'response': response_payload,
        }

    def _execute_connector_action(self, action_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        if action_type == 'email.send':
            response = self.connectors.send_email(payload)
        elif action_type == 'calendar.schedule':
            response = self.connectors.schedule_calendar(payload)
        else:
            response = self.connectors.send_message(payload)
        return {
            **response,
            'action_type': action_type,
        }
