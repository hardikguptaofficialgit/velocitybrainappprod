import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from src.core.config import settings


class JobQueueService:
    def __init__(self):
        self.root = Path(settings.local_storage_path)
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / 'jobs_queue.json'

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return {'jobs': []}
        return json.loads(self.path.read_text(encoding='utf-8'))

    def _write(self, payload: dict[str, Any]) -> None:
        self.path.write_text(json.dumps(payload, indent=2), encoding='utf-8')

    def enqueue(self, kind: str, payload: dict[str, Any], max_retries: int = 3) -> dict[str, Any]:
        data = self._read()
        job = {
            'job_id': str(uuid.uuid4()),
            'kind': kind,
            'payload': payload,
            'status': 'queued',
            'attempts': 0,
            'max_retries': max_retries,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'last_error': None,
        }
        data['jobs'].append(job)
        self._write(data)
        return job

    def process_once(self, handlers: dict[str, Callable[[dict[str, Any]], Any]]) -> dict[str, Any]:
        data = self._read()
        for job in data['jobs']:
            if job['status'] not in {'queued', 'retry'}:
                continue
            handler = handlers.get(job['kind'])
            if handler is None:
                job['status'] = 'failed'
                job['last_error'] = f"no handler for kind={job['kind']}"
                self._write(data)
                return job
            try:
                job['attempts'] += 1
                result = handler(job['payload'])
                job['status'] = 'completed'
                job['result'] = result
                job['completed_at'] = datetime.now(timezone.utc).isoformat()
                self._write(data)
                return job
            except Exception as exc:
                job['last_error'] = str(exc)
                if job['attempts'] >= job.get('max_retries', 3):
                    job['status'] = 'failed'
                else:
                    job['status'] = 'retry'
                self._write(data)
                return job
        return {'status': 'idle'}

    def list_jobs(self, limit: int = 100) -> dict[str, Any]:
        data = self._read()
        return {'count': len(data['jobs']), 'jobs': data['jobs'][-limit:]}
