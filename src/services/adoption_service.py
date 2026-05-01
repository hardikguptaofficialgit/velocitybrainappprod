from __future__ import annotations

import json
import os
import subprocess
import uuid
import hashlib
from pathlib import Path
from typing import Any

from src.services.reuse_service import ReuseService


TEXT_EXTENSIONS = {
    '.py', '.js', '.ts', '.tsx', '.jsx', '.md', '.json', '.yaml', '.yml', '.toml', '.txt',
}
IGNORED_PATH_PARTS = {
    '.git', '.venv', '.venv-test', 'node_modules', '__pycache__', 'site-packages', 'dist', 'build',
}

STOPWORDS = {
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'what', 'which', 'when', 'where',
    'repo', 'project', 'codebase', 'main', 'their', 'your', 'will', 'would', 'should',
}


class AdoptionService:
    def __init__(self, state_dir: Path | None = None, repo_root: Path | None = None) -> None:
        configured_home = os.getenv('VELOCITYBRAIN_HOME')
        default_state_dir = Path(configured_home) if configured_home else (Path.home() / '.velocitybrain')
        self.state_dir = state_dir or default_state_dir
        self.repo_root = repo_root or Path.cwd()
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.state_dir / 'adoption_state.json'
        self.last_run_path = self.state_dir / 'last_run.json'
        self.reuse_service = ReuseService()

    def quickstart(self, *, repo_path: str | None = None, task: str | None = None) -> dict[str, Any]:
        repo = Path(repo_path).resolve() if repo_path else self.repo_root.resolve()
        selected_task = task or 'Map the main architecture and likely edit surface for this repo.'
        first_run = self.run_task(selected_task, repo_path=str(repo))
        second_run = self.run_task(selected_task, repo_path=str(repo))
        return {
            'mode': 'quickstart',
            'repo_path': str(repo),
            'task': selected_task,
            'first_run': first_run,
            'second_run': second_run,
            'truth_report': second_run['truth_report'],
            'reuse': second_run['reuse'],
            'savings': second_run['savings'],
            'selected_files': second_run['selected_files'],
        }

    def run_task(self, task: str, *, repo_path: str | None = None) -> dict[str, Any]:
        repo = Path(repo_path).resolve() if repo_path else self.repo_root.resolve()
        self._load_state()
        had_repo_artifacts = self.reuse_service.get_storage_summary().get('repo_counts', {}).get(repo.name, 0) > 0
        context_paths = self._select_context_paths(repo, task)
        artifact_text = self._build_artifact_text(repo, context_paths, task)
        full_context = self._build_full_context(repo, context_paths)
        metadata = {
            'workspace_id': f'user::{repo.name}',
            'repo_id': repo.name,
            'context_paths': context_paths,
            'file_hashes': self._build_file_hashes(repo, context_paths),
        }
        reuse_lookup = self.reuse_service.retrieve_reuse_context(task, metadata=metadata, include_debug=True)
        reused_text = reuse_lookup['artifacts'][0]['normalized_text'] if reuse_lookup['artifacts'] else full_context
        baseline_prompt = self.reuse_service.serialize_prompt(task_text=task, context_text=full_context, reused=False)
        actual_prompt = self.reuse_service.serialize_prompt(task_text=task, context_text=reused_text, reused=reuse_lookup['reused'])
        correct_reuse = True if reuse_lookup['hit_type'] == 'none' else self._is_correct_reuse(task, artifact_text, reused_text, context_paths)
        event = self.reuse_service.record_validation_run(
            run_id=f'run-{uuid.uuid4().hex[:10]}',
            task_text=task,
            artifact_text=artifact_text,
            baseline_prompt=baseline_prompt,
            actual_prompt=actual_prompt,
            reuse_lookup=reuse_lookup,
            metadata=metadata,
            artifact_kind='summary',
            correct_reuse=correct_reuse,
        )
        result = {
            'result': artifact_text,
            'task': task,
            'repo_path': str(repo),
            'reused': event['truth_report']['reused'],
            'reuse_confidence': event['reuse']['reuse_confidence'],
            'tokens_saved': event['truth_report']['tokens_saved'],
            'percent_saved': event['truth_report']['percent_saved'],
            'reuse': event['reuse'],
            'savings': event['savings'],
            'truth_report': event['truth_report'],
            'debug': event['debug'],
            'failures': event['failures'],
            'selected_files': context_paths,
            'run_id': event['run_id'],
        }
        if not had_repo_artifacts:
            self.reuse_service.store_artifact(
                task_text=f'bootstrap repo map for {repo.name}',
                artifact_text=self._build_repo_map_summary(context_paths),
                artifact_kind='repo_map',
                source_run_id=f"{event['run_id']}-bootstrap",
                metadata=metadata,
                quality_confidence=0.82,
            )
        self._save_state()
        self.last_run_path.write_text(json.dumps(result, indent=2), encoding='utf-8')
        return result

    def share_last_run(self) -> dict[str, Any]:
        if not self.last_run_path.exists():
            raise FileNotFoundError('No prior run found. Run `velocitybrain quickstart` or `velocitybrain run <task>` first.')
        return json.loads(self.last_run_path.read_text(encoding='utf-8'))

    def usage_summary(self) -> dict[str, Any]:
        self._load_state()
        overview = self.reuse_service.get_savings_overview()
        return {
            'runs_total': overview.get('run_count', 0),
            'reuse_hit_rate': overview.get('reuse_hit_rate', 0.0),
            'repeat_rate': overview.get('repeat_rate', 0.0),
            'avg_token_savings_percent': overview.get('average_saved_percent', 0.0),
            'avg_token_savings': overview.get('average_saved_tokens', 0.0),
            'saved_tokens_total': overview.get('total_saved_tokens', 0),
            'reuse_count': overview.get('reuse_count', 0),
            'repeat_usage_per_session': overview.get('repeat_usage_per_session', 0),
            'failure_count': overview.get('failure_count', 0),
            'top_failure_types': overview.get('top_failure_types', []),
            'top_failure_clusters': overview.get('top_failure_clusters', []),
            'blacklist_size': overview.get('blacklist_size', 0),
            'recent_runs': overview.get('recent_runs', []),
            'wedge_insights': self.reuse_service.get_wedge_insights(),
        }

    def _load_state(self) -> None:
        if not self.state_path.exists():
            self.reuse_service.reset_state()
            return
        snapshot = json.loads(self.state_path.read_text(encoding='utf-8'))
        self.reuse_service.restore_state(snapshot)

    def _save_state(self) -> None:
        snapshot = self.reuse_service.snapshot_state()
        self.state_path.write_text(json.dumps(snapshot, indent=2), encoding='utf-8')

    def _select_context_paths(self, repo: Path, task: str, limit: int = 4) -> list[str]:
        keywords = self._keywords(task)
        scored: list[tuple[int, str]] = []
        for path in self._candidate_files(repo):
            if path.suffix.lower() not in TEXT_EXTENSIONS:
                continue
            rel_path = path.relative_to(repo).as_posix()
            if path.stat().st_size > 250_000:
                continue
            try:
                content = path.read_text(encoding='utf-8', errors='ignore')
            except Exception:
                continue
            score = sum(content.lower().count(keyword) for keyword in keywords)
            score += sum(rel_path.lower().count(keyword) * 3 for keyword in keywords)
            if {'architecture', 'edit', 'surface'} & keywords:
                architecture_markers = ['readme', 'main.', 'app.', 'cli', 'server', 'package.json', 'pyproject.toml']
                score += sum(8 for marker in architecture_markers if marker in rel_path.lower())
            if score > 0:
                scored.append((score, rel_path))
        if not scored:
            fallbacks = []
            for candidate in ['README.md', 'src/cli.py', 'package.json', 'pyproject.toml']:
                if (repo / candidate).exists():
                    fallbacks.append(candidate)
            if fallbacks:
                return fallbacks[:limit]
            return [
                path.relative_to(repo).as_posix()
                for path in self._candidate_files(repo)
            ][:limit]
        scored.sort(key=lambda item: (item[0], -len(item[1])), reverse=True)
        return [rel_path for _, rel_path in scored[:limit]]

    def _candidate_files(self, repo: Path) -> list[Path]:
        git_dir = repo / '.git'
        if git_dir.exists():
            try:
                completed = subprocess.run(
                    ['git', '-C', str(repo), 'ls-files'],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                tracked = []
                for line in completed.stdout.splitlines():
                    path = repo / line.strip()
                    if path.is_file() and not any(part in IGNORED_PATH_PARTS for part in path.parts):
                        tracked.append(path)
                if tracked:
                    return tracked
            except Exception:
                pass
        paths: list[Path] = []
        for path in repo.rglob('*'):
            if not path.is_file():
                continue
            if any(part in IGNORED_PATH_PARTS for part in path.parts):
                continue
            paths.append(path)
        return paths

    def _build_full_context(self, repo: Path, context_paths: list[str]) -> str:
        chunks: list[str] = []
        for rel_path in context_paths:
            content = (repo / rel_path).read_text(encoding='utf-8', errors='ignore')
            chunks.append(f'FILE: {rel_path}\n{content[:12000]}')
        return '\n\n'.join(chunks)

    def _build_file_hashes(self, repo: Path, context_paths: list[str]) -> dict[str, str]:
        hashes: dict[str, str] = {}
        for rel_path in context_paths:
            content = (repo / rel_path).read_text(encoding='utf-8', errors='ignore')
            hashes[rel_path.lower()] = hashlib.sha256(content.encode('utf-8')).hexdigest()
        return hashes

    def _build_artifact_text(self, repo: Path, context_paths: list[str], task: str) -> str:
        keywords = self._keywords(task)
        sections: list[str] = []
        for rel_path in context_paths:
            lines = (repo / rel_path).read_text(encoding='utf-8', errors='ignore').splitlines()
            matched = [index for index, line in enumerate(lines) if any(keyword in line.lower() for keyword in keywords)]
            if not matched:
                matched = list(range(min(8, len(lines))))
            window_indexes: list[int] = []
            for index in matched[:6]:
                window_indexes.extend(range(max(0, index - 1), min(len(lines), index + 2)))
            unique = sorted(set(window_indexes))[:12]
            excerpt = '\n'.join(f'{idx + 1}: {lines[idx].strip()}' for idx in unique if lines[idx].strip())
            sections.append(f'[{rel_path}]\n{excerpt}')
        return '\n\n'.join(sections)

    def _build_repo_map_summary(self, context_paths: list[str]) -> str:
        sections = [f'[{path}]\nrole: reusable repo bootstrap context' for path in context_paths]
        return '\n\n'.join(sections)

    def _keywords(self, text: str) -> set[str]:
        return {
            word.lower()
            for word in ''.join(char if char.isalnum() else ' ' for char in text).split()
            if len(word) >= 4 and word.lower() not in STOPWORDS
        }

    def _is_correct_reuse(self, task: str, baseline_summary: str, reused_text: str, context_paths: list[str]) -> bool:
        required_paths = {f'[{path}]' for path in context_paths}
        path_coverage = (
            sum(1 for marker in required_paths if marker in reused_text) / len(required_paths)
            if required_paths else 1.0
        )
        baseline_keywords = self._keywords(task) | self._keywords(baseline_summary)
        reused_keywords = self._keywords(reused_text)
        keyword_coverage = len(baseline_keywords & reused_keywords) / len(baseline_keywords) if baseline_keywords else 1.0
        return path_coverage >= 0.5 and keyword_coverage >= 0.4
