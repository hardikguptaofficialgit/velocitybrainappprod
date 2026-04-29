import hashlib
import json
from pathlib import Path
from typing import Any

from src.core.config import settings


class IdentitySpecService:
    """Runtime identity layer loaded from a JSON spec, independent of AGENTS.md."""

    def __init__(self, spec_path: str | None = None, agents_path: str = 'AGENTS.md'):
        self.spec_path = Path(spec_path or settings.identity_spec_path)
        self.agents_path = Path(agents_path)

    def _default_spec(self) -> dict[str, Any]:
        return {
            'name': 'velocitybrain-runtime',
            'version': '1.0',
            'persona': {
                'mission': 'Brain-first retrieval before action.',
                'tone': 'truthful, concise, helpful',
            },
            'runtime_policies': {
                'destructive_tools_require_approval': True,
                'allow_external_file_reads': False,
            },
            'capabilities': [
                'ingest_text',
                'query',
                'run_agent',
                'sync_brain',
            ],
        }

    def _agents_summary(self) -> dict[str, Any]:
        if not self.agents_path.exists():
            return {'present': False}
        data = self.agents_path.read_text(encoding='utf-8', errors='replace')
        digest = hashlib.sha256(data.encode('utf-8')).hexdigest()
        return {
            'present': True,
            'path': str(self.agents_path),
            'sha256': digest,
            'size': len(data),
        }

    def get(self) -> dict[str, Any]:
        spec = self._default_spec()
        if self.spec_path.exists():
            loaded = json.loads(self.spec_path.read_text(encoding='utf-8'))
            if isinstance(loaded, dict):
                spec.update(loaded)
        spec['agents_md'] = self._agents_summary()
        spec['source'] = str(self.spec_path)
        return spec
