from datetime import datetime, timedelta, timezone
from typing import Any

from src.core.db import get_conn


class ComplianceService:
    def log_event(self, event_type: str, actor: str, payload: dict[str, Any]) -> dict[str, Any]:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'INSERT INTO audit_events (event_type, actor, event_payload, created_at) VALUES (%s,%s,%s,NOW()) RETURNING id',
                    (event_type, actor, payload),
                )
                event_id = cur.fetchone()['id']
                conn.commit()
        return {'event_id': event_id, 'event_type': event_type, 'actor': actor}

    def retention_cleanup(self, retention_days: int = 90) -> dict[str, Any]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, retention_days))
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM audit_events WHERE created_at < %s RETURNING id', (cutoff,))
                deleted = cur.fetchall()
                conn.commit()
        return {'deleted': len(deleted), 'retention_days': retention_days}

    def recent_audit(self, limit: int = 100) -> dict[str, Any]:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT id, event_type, actor, created_at FROM audit_events ORDER BY created_at DESC LIMIT %s', (limit,))
                rows = cur.fetchall()
        return {'count': len(rows), 'events': rows}
