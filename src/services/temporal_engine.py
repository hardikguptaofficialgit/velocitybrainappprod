from datetime import datetime, timedelta, timezone
from src.core.db import get_conn


class TemporalEngine:
    def changes_for_entity(self, slug: str, days: int = 30) -> dict:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT id, title, type FROM entities WHERE slug = %s', (slug,))
                entity = cur.fetchone()
                if not entity:
                    return {'entity': None, 'changes': []}
                cur.execute(
                    """
                    SELECT event_ts, source_type, source_ref, event_md
                    FROM timeline_events
                    WHERE entity_id = %s AND event_ts >= %s
                    ORDER BY event_ts DESC
                    """,
                    (entity['id'], since),
                )
                changes = cur.fetchall()
                cur.execute(
                    """
                    SELECT created_at, change_reason, previous_compiled_truth_md, next_compiled_truth_md
                    FROM entity_versions
                    WHERE entity_id = %s AND created_at >= %s
                    ORDER BY created_at DESC
                    """,
                    (entity['id'], since),
                )
                belief_changes = cur.fetchall()
                return {
                    'entity': entity,
                    'changes': changes,
                    'belief_changes': belief_changes,
                    'window_days': days,
                }
