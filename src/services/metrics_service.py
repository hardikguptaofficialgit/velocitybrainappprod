import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.core.config import settings


class MetricsService:
    def __init__(self):
        self.root = Path(settings.local_storage_path)
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / 'metrics.json'

    def _default(self) -> dict[str, Any]:
        return {
            'counters': {},
            'timers': {},
            'last_updated': None,
        }

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return self._default()
        return json.loads(self.path.read_text(encoding='utf-8'))

    def _write(self, payload: dict[str, Any]) -> None:
        payload['last_updated'] = datetime.now(timezone.utc).isoformat()
        self.path.write_text(json.dumps(payload, indent=2), encoding='utf-8')

    def inc(self, name: str, value: int = 1) -> None:
        data = self._read()
        data['counters'][name] = int(data['counters'].get(name, 0)) + int(value)
        self._write(data)

    def observe_ms(self, name: str, value: float) -> None:
        data = self._read()
        bucket = data['timers'].setdefault(name, {'count': 0, 'sum_ms': 0.0, 'avg_ms': 0.0, 'max_ms': 0.0})
        bucket['count'] += 1
        bucket['sum_ms'] += float(value)
        bucket['avg_ms'] = round(bucket['sum_ms'] / max(1, bucket['count']), 3)
        bucket['max_ms'] = max(bucket.get('max_ms', 0.0), float(value))
        self._write(data)

    def snapshot(self) -> dict[str, Any]:
        return self._read()
