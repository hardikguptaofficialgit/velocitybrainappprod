import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.core.config import settings
from src.core.db import get_conn


class BackupService:
    def __init__(self):
        self.root = Path(settings.local_storage_path)
        self.root.mkdir(parents=True, exist_ok=True)

    def export_snapshot(self, file_path: str | None = None, tables: list[str] | None = None) -> dict[str, Any]:
        tables = tables or ['entities', 'timeline_events', 'relationships', 'agent_runs', 'audit_events']
        payload: dict[str, Any] = {
            'created_at': datetime.now(timezone.utc).isoformat(),
            'tables': {},
        }
        with get_conn() as conn:
            with conn.cursor() as cur:
                for table in tables:
                    cur.execute(f'SELECT * FROM {table}')
                    payload['tables'][table] = cur.fetchall()

        out = Path(file_path) if file_path else self.root / f"snapshot_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
        out.write_text(json.dumps(payload, indent=2, default=str), encoding='utf-8')
        return {'ok': True, 'path': str(out), 'tables': list(payload['tables'].keys())}

    def import_snapshot(self, file_path: str) -> dict[str, Any]:
        data = json.loads(Path(file_path).read_text(encoding='utf-8'))
        inserted = 0
        failed = 0
        with get_conn() as conn:
            with conn.cursor() as cur:
                for table, rows in (data.get('tables') or {}).items():
                    for row in rows:
                        cols = [c for c in row.keys() if c != 'id']
                        vals = [row[c] for c in cols]
                        col_sql = ','.join(cols)
                        ph = ','.join(['%s'] * len(cols))
                        try:
                            cur.execute(f'INSERT INTO {table} ({col_sql}) VALUES ({ph}) ON CONFLICT DO NOTHING', vals)
                            inserted += 1
                        except Exception:
                            failed += 1
                conn.commit()
        return {'ok': True, 'inserted': inserted, 'failed': failed}
