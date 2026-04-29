import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.core.config import settings
from src.services.org_ingest import OrgIngestService


class SyncService:
    def __init__(self):
        self.org = OrgIngestService()
        self.storage_dir = Path(settings.local_storage_path)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.registry_path = self.storage_dir / 'sync_registry.json'

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _workspace_root(self) -> Path:
        return Path(settings.workspace_root).resolve()

    def _safe_repo(self, repo: str) -> Path:
        p = Path(repo).expanduser().resolve()
        if settings.allow_unsafe_file_reads:
            return p
        root = self._workspace_root()
        if p != root and root not in p.parents:
            raise ValueError(f'repo path outside workspace root: {p}')
        return p

    def _read_registry(self) -> dict[str, Any]:
        if not self.registry_path.exists():
            return {'repos': {}, 'last_sync': None}
        return json.loads(self.registry_path.read_text(encoding='utf-8'))

    def _write_registry(self, payload: dict[str, Any]) -> None:
        self.registry_path.write_text(json.dumps(payload, indent=2), encoding='utf-8')

    def _discover_org(self, repo_path: Path) -> list[Path]:
        return [p for p in repo_path.rglob('*.org') if p.is_file()]

    def _plan(self, repos: list[str], include_org: bool = True) -> list[dict[str, Any]]:
        plan: list[dict[str, Any]] = []
        for repo in repos:
            safe_repo = self._safe_repo(repo)
            item: dict[str, Any] = {'repo': str(safe_repo), 'steps': []}
            if include_org:
                org_files = self._discover_org(safe_repo)
                item['steps'].append({'kind': 'org_scan', 'count': len(org_files), 'files': [str(f) for f in org_files[:50]]})
            plan.append(item)
        return plan

    def full_sync(self, repos: list[str], dry_run: bool = True, include_org: bool = True) -> dict[str, Any]:
        trace_id = f'sync-{datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")}-{len(repos)}'
        deduped = list(dict.fromkeys(repos))
        plan = self._plan(deduped, include_org=include_org)
        if dry_run:
            return {
                'mode': 'offline-first',
                'operation': 'full_sync',
                'dry_run': True,
                'status': 'planned',
                'at': self._now(),
                'plan': plan,
                'trace_id': trace_id,
            }

        ingested_total = 0
        registry = self._read_registry()
        for repo in deduped:
            safe_repo = self._safe_repo(repo)
            org_count = 0
            if include_org:
                for org_file in self._discover_org(safe_repo)[:1000]:
                    res = self.org.ingest_file(source=f'repo:{safe_repo.name}', path=str(org_file), access_level='private')
                    org_count += int(res.get('ingested', 0))
            ingested_total += org_count
            registry['repos'][str(safe_repo)] = {
                'last_sync': self._now(),
                'org_entities_ingested': org_count,
            }

        registry['last_sync'] = self._now()
        self._write_registry(registry)
        return {
            'mode': 'offline-first',
            'operation': 'full_sync',
            'dry_run': False,
            'status': 'completed',
            'repos': deduped,
            'ingested_entities': ingested_total,
            'at': self._now(),
            'plan': plan,
            'trace_id': trace_id,
        }

    def push(self, repos: list[str] | None = None, dry_run: bool = True) -> dict:
        repos = repos or [str(self._workspace_root())]
        return self.full_sync(repos=repos, dry_run=dry_run, include_org=True)

    def pull(self, repos: list[str] | None = None, dry_run: bool = True) -> dict:
        repos = repos or [str(self._workspace_root())]
        return self.full_sync(repos=repos, dry_run=dry_run, include_org=True)
