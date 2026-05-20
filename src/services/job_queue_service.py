import json
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from psycopg.types.json import Json

from src.core.config import settings
from src.core.db import get_conn
from src.core.logging_config import get_logger


class JobQueueService:
    _memory_jobs: list[dict[str, Any]] = []
    _memory_lock = threading.RLock()

    def __init__(self):
        self.logger = get_logger('job_queue')
        self.persistence_backend = (getattr(settings, 'job_queue_backend', None) or 'database').strip().lower()
        self.persistence_required = getattr(settings, 'job_queue_require_persistence', settings.env in {'prod', 'production'})
        self.default_timeout_seconds = getattr(settings, 'job_timeout_seconds', 300)
        self._schema_ready = False

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _ensure_schema(self) -> None:
        if self.persistence_backend != 'database' or self._schema_ready:
            return
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS execution_jobs (
                      job_id TEXT PRIMARY KEY,
                      kind TEXT NOT NULL,
                      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                      status TEXT NOT NULL,
                      attempts INTEGER NOT NULL DEFAULT 0,
                      max_retries INTEGER NOT NULL DEFAULT 3,
                      timeout_seconds INTEGER NOT NULL DEFAULT 300,
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      started_at TIMESTAMPTZ,
                      completed_at TIMESTAMPTZ,
                      lease_expires_at TIMESTAMPTZ,
                      last_error TEXT,
                      result JSONB,
                      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_execution_jobs_status_created ON execution_jobs(status, created_at DESC)")
                conn.commit()
        self._schema_ready = True

    def _with_backend_fallback(self, fn: Callable[[], Any], memory_fn: Callable[[], Any]) -> Any:
        if self.persistence_backend != 'database':
            return memory_fn()
        try:
            self._ensure_schema()
            return fn()
        except Exception as exc:
            if self.persistence_required:
                raise
            self.logger.warning('Job queue database unavailable, falling back to in-memory mode: %s', exc)
            self.persistence_backend = 'memory'
            return memory_fn()

    def _memory_enqueue(self, kind: str, payload: dict[str, Any], max_retries: int, timeout_seconds: int, metadata: dict[str, Any] | None) -> dict[str, Any]:
        with self._memory_lock:
            job = {
                'job_id': str(uuid.uuid4()),
                'kind': kind,
                'payload': payload,
                'status': 'queued',
                'attempts': 0,
                'max_retries': max_retries,
                'timeout_seconds': timeout_seconds,
                'created_at': self._now(),
                'updated_at': self._now(),
                'started_at': None,
                'completed_at': None,
                'lease_expires_at': None,
                'last_error': None,
                'result': None,
                'metadata': metadata or {},
            }
            self._memory_jobs.append(job)
            return dict(job)

    def enqueue(
        self,
        kind: str,
        payload: dict[str, Any],
        max_retries: int = 3,
        timeout_seconds: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        timeout_value = int(timeout_seconds or self.default_timeout_seconds)

        def _db_enqueue():
            job_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            job = {
                'job_id': job_id,
                'kind': kind,
                'payload': payload,
                'status': 'queued',
                'attempts': 0,
                'max_retries': max_retries,
                'timeout_seconds': timeout_value,
                'created_at': now.isoformat(),
                'updated_at': now.isoformat(),
                'started_at': None,
                'completed_at': None,
                'lease_expires_at': None,
                'last_error': None,
                'result': None,
                'metadata': metadata or {},
            }
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO execution_jobs
                            (job_id, kind, payload, status, attempts, max_retries, timeout_seconds, created_at, updated_at, metadata)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            job_id,
                            kind,
                            Json(payload),
                            'queued',
                            0,
                            max_retries,
                            timeout_value,
                            now,
                            now,
                            Json(metadata or {}),
                        ),
                    )
                    conn.commit()
            return job

        return self._with_backend_fallback(
            _db_enqueue,
            lambda: self._memory_enqueue(kind, payload, max_retries, timeout_value, metadata),
        )

    def _memory_claim_next_job(self) -> dict[str, Any] | None:
        with self._memory_lock:
            now = datetime.now(timezone.utc)
            for job in self._memory_jobs:
                lease_expired = job.get('lease_expires_at') and datetime.fromisoformat(job['lease_expires_at']) <= now
                if job['status'] not in {'queued', 'retry'} and not lease_expired:
                    continue
                job['status'] = 'running'
                job['attempts'] = int(job.get('attempts', 0)) + 1
                job['started_at'] = job.get('started_at') or now.isoformat()
                job['updated_at'] = now.isoformat()
                job['lease_expires_at'] = (now + timedelta(seconds=int(job.get('timeout_seconds', self.default_timeout_seconds)))).isoformat()
                return dict(job)
        return None

    def claim_next_job(self) -> dict[str, Any] | None:
        def _db_claim():
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT job_id
                        FROM execution_jobs
                        WHERE status IN ('queued', 'retry')
                           OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= NOW())
                        ORDER BY created_at ASC
                        FOR UPDATE SKIP LOCKED
                        LIMIT 1
                        """
                    )
                    row = cur.fetchone()
                    if not row:
                        conn.commit()
                        return None
                    cur.execute(
                        """
                        UPDATE execution_jobs
                        SET status = 'running',
                            attempts = attempts + 1,
                            started_at = COALESCE(started_at, NOW()),
                            updated_at = NOW(),
                            lease_expires_at = NOW() + make_interval(secs => timeout_seconds),
                            last_error = NULL
                        WHERE job_id = %s
                        RETURNING job_id, kind, payload, status, attempts, max_retries, timeout_seconds,
                                  created_at, updated_at, started_at, completed_at, lease_expires_at,
                                  last_error, result, metadata
                        """,
                        (row['job_id'],),
                    )
                    claimed = cur.fetchone()
                    conn.commit()
            return self._normalize_db_job(claimed)

        return self._with_backend_fallback(_db_claim, self._memory_claim_next_job)

    def _normalize_db_job(self, row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        return {
            'job_id': row['job_id'],
            'kind': row['kind'],
            'payload': row.get('payload') or {},
            'status': row['status'],
            'attempts': int(row.get('attempts', 0)),
            'max_retries': int(row.get('max_retries', 0)),
            'timeout_seconds': int(row.get('timeout_seconds', self.default_timeout_seconds)),
            'created_at': row['created_at'].isoformat() if row.get('created_at') else None,
            'updated_at': row['updated_at'].isoformat() if row.get('updated_at') else None,
            'started_at': row['started_at'].isoformat() if row.get('started_at') else None,
            'completed_at': row['completed_at'].isoformat() if row.get('completed_at') else None,
            'lease_expires_at': row['lease_expires_at'].isoformat() if row.get('lease_expires_at') else None,
            'last_error': row.get('last_error'),
            'result': row.get('result'),
            'metadata': row.get('metadata') or {},
        }

    def _memory_finish_job(self, job_id: str, *, status: str, result: dict[str, Any] | None = None, last_error: str | None = None) -> dict[str, Any] | None:
        with self._memory_lock:
            for job in self._memory_jobs:
                if job['job_id'] != job_id:
                    continue
                job['status'] = status
                job['updated_at'] = self._now()
                job['completed_at'] = self._now() if status in {'completed', 'failed'} else None
                job['lease_expires_at'] = None
                job['last_error'] = last_error
                job['result'] = result
                return dict(job)
        return None

    def complete_job(self, job_id: str, result: dict[str, Any]) -> dict[str, Any] | None:
        def _db_complete():
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE execution_jobs
                        SET status = 'completed',
                            result = %s,
                            updated_at = NOW(),
                            completed_at = NOW(),
                            lease_expires_at = NULL,
                            last_error = NULL
                        WHERE job_id = %s
                        RETURNING job_id, kind, payload, status, attempts, max_retries, timeout_seconds,
                                  created_at, updated_at, started_at, completed_at, lease_expires_at,
                                  last_error, result, metadata
                        """,
                        (Json(result), job_id),
                    )
                    row = cur.fetchone()
                    conn.commit()
            return self._normalize_db_job(row)

        return self._with_backend_fallback(
            _db_complete,
            lambda: self._memory_finish_job(job_id, status='completed', result=result),
        )

    def fail_job(self, job_id: str, error_message: str) -> dict[str, Any] | None:
        def _db_fail():
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT attempts, max_retries FROM execution_jobs WHERE job_id = %s", (job_id,))
                    row = cur.fetchone()
                    if not row:
                        conn.commit()
                        return None
                    next_status = 'failed' if int(row['attempts']) >= int(row['max_retries']) else 'retry'
                    cur.execute(
                        """
                        UPDATE execution_jobs
                        SET status = %s,
                            updated_at = NOW(),
                            completed_at = CASE WHEN %s = 'failed' THEN NOW() ELSE NULL END,
                            lease_expires_at = NULL,
                            last_error = %s
                        WHERE job_id = %s
                        RETURNING job_id, kind, payload, status, attempts, max_retries, timeout_seconds,
                                  created_at, updated_at, started_at, completed_at, lease_expires_at,
                                  last_error, result, metadata
                        """,
                        (next_status, next_status, error_message, job_id),
                    )
                    failed = cur.fetchone()
                    conn.commit()
            return self._normalize_db_job(failed)

        def _memory_fail():
            with self._memory_lock:
                for job in self._memory_jobs:
                    if job['job_id'] != job_id:
                        continue
                    next_status = 'failed' if int(job.get('attempts', 0)) >= int(job.get('max_retries', 0)) else 'retry'
                    return self._memory_finish_job(job_id, status=next_status, last_error=error_message)
            return None

        return self._with_backend_fallback(_db_fail, _memory_fail)

    def process_once(self, handlers: dict[str, Callable[[dict[str, Any]], Any]]) -> dict[str, Any]:
        job = self.claim_next_job()
        if not job:
            return {'status': 'idle'}

        handler = handlers.get(job['kind'])
        if handler is None:
            failed = self.fail_job(job['job_id'], f"no handler for kind={job['kind']}")
            return failed or {'status': 'failed', 'job_id': job['job_id']}

        try:
            result = handler(job['payload'])
            if not isinstance(result, dict):
                result = {'value': result}
            completed = self.complete_job(job['job_id'], result)
            return completed or {'status': 'completed', 'job_id': job['job_id'], 'result': result}
        except Exception as exc:
            failed = self.fail_job(job['job_id'], str(exc))
            return failed or {'status': 'failed', 'job_id': job['job_id'], 'last_error': str(exc)}

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        def _db_get():
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT job_id, kind, payload, status, attempts, max_retries, timeout_seconds,
                               created_at, updated_at, started_at, completed_at, lease_expires_at,
                               last_error, result, metadata
                        FROM execution_jobs
                        WHERE job_id = %s
                        """,
                        (job_id,),
                    )
                    row = cur.fetchone()
                    conn.commit()
            return self._normalize_db_job(row)

        def _memory_get():
            with self._memory_lock:
                for job in self._memory_jobs:
                    if job['job_id'] == job_id:
                        return dict(job)
            return None

        return self._with_backend_fallback(_db_get, _memory_get)

    def list_jobs(self, limit: int = 100) -> dict[str, Any]:
        capped_limit = max(1, min(int(limit), 500))

        def _db_list():
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT job_id, kind, payload, status, attempts, max_retries, timeout_seconds,
                               created_at, updated_at, started_at, completed_at, lease_expires_at,
                               last_error, result, metadata
                        FROM execution_jobs
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (capped_limit,),
                    )
                    rows = cur.fetchall()
                    cur.execute("SELECT COUNT(*) AS count FROM execution_jobs")
                    count_row = cur.fetchone()
                    conn.commit()
            jobs = [self._normalize_db_job(row) for row in rows]
            return {'count': int(count_row['count']), 'jobs': jobs}

        def _memory_list():
            with self._memory_lock:
                jobs = list(reversed(self._memory_jobs[-capped_limit:]))
                return {'count': len(self._memory_jobs), 'jobs': [dict(job) for job in jobs]}

        return self._with_backend_fallback(_db_list, _memory_list)
