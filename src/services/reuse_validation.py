from __future__ import annotations

import json
import uuid
import hashlib
from dataclasses import dataclass
from itertools import cycle, islice
from pathlib import Path
from typing import Any

from src.services.reuse_service import ReuseService


STOPWORDS = {
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'what', 'which', 'into',
    'your', 'their', 'have', 'will', 'about', 'same', 'repo', 'codebase', 'hosted',
    'agent', 'agents', 'should', 'could', 'would', 'when', 'where', 'through',
}


@dataclass(frozen=True)
class ValidationScenario:
    scenario_id: str
    title: str
    description: str
    mode: str
    tasks: list[str]
    context_paths: list[str]
    artifact_kind: str
    expected_hit_types: list[str]


class ReuseValidationService:
    def __init__(self, reuse_service: ReuseService | None = None, repo_root: Path | None = None) -> None:
        self.reuse_service = reuse_service or ReuseService()
        self.repo_root = repo_root or Path(__file__).resolve().parents[2]
        self.failure_log_path = Path.home() / '.velocitybrain' / 'reuse_failures.jsonl'

    def scenario_catalog(self) -> list[ValidationScenario]:
        auth_context = [
            'README.md',
            'src/cli.py',
            'src/core_api/auth.py',
            'backend/server.js',
        ]
        return [
            ValidationScenario(
                scenario_id='auth-repeat',
                title='Same query repeated on same repo',
                description='Repeated auth/API-key mapping on the VelocityBrain repo.',
                mode='repeat',
                tasks=['Map the hosted auth and API key flow across this repo.'],
                context_paths=auth_context,
                artifact_kind='repo_map',
                expected_hit_types=['exact'],
            ),
            ValidationScenario(
                scenario_id='auth-variation',
                title='Slightly modified query on same repo',
                description='Auth/API-key mapping variations that should reuse repo context instead of full files.',
                mode='variation',
                tasks=[
                    'Map the hosted auth and API key flow, focusing on CLI login and backend validation.',
                    'Map the auth flow again but emphasize API key authorization and token issuance.',
                    'Explain the hosted auth path with emphasis on API key checks and CLI onboarding.',
                    'Summarize auth and API key handling in this repo, with focus on backend validation.',
                    'Review the same auth flow again, but call out where CLI config and API key checks connect.',
                ],
                context_paths=auth_context,
                artifact_kind='summary',
                expected_hit_types=['repo_context', 'exact'],
            ),
            ValidationScenario(
                scenario_id='auth-change-plan',
                title='Different query with same codebase context',
                description='Change-planning task on the same auth/API-key code paths.',
                mode='repeat',
                tasks=['Which files should I edit to change hosted auth without breaking API key validation?'],
                context_paths=auth_context,
                artifact_kind='plan',
                expected_hit_types=['repo_context', 'exact'],
            ),
        ]

    def run_validation_suite(self, repeat_count: int = 5) -> dict[str, Any]:
        self.reuse_service.reset_state()
        scenario_reports = [self.run_scenario(scenario, repeat_count=repeat_count) for scenario in self.scenario_catalog()]
        return self._suite_payload(scenario_reports, repeat_count)

    def run_until_scenario(self, scenario_id: str, repeat_count: int = 5) -> dict[str, Any]:
        self.reuse_service.reset_state()
        selected_reports: list[dict[str, Any]] = []
        for scenario in self.scenario_catalog():
            report = self.run_scenario(scenario, repeat_count=repeat_count)
            selected_reports.append(report)
            if scenario.scenario_id == scenario_id:
                return self._suite_payload([report], repeat_count)
        return self._suite_payload([], repeat_count)

    def _suite_payload(self, scenario_reports: list[dict[str, Any]], repeat_count: int) -> dict[str, Any]:
        all_runs = [run for report in scenario_reports for run in report['runs']]
        reuse_count = sum(1 for run in all_runs if run['truth_report']['reused'])
        avg_saved_percent = round(
            sum(float(run['truth_report']['percent_saved']) for run in all_runs) / len(all_runs),
            1,
        ) if all_runs else 0.0
        avg_tokens_saved = round(
            sum(float(run['truth_report']['tokens_saved']) for run in all_runs) / len(all_runs),
            1,
        ) if all_runs else 0.0
        return {
            'suite': 'real-usage-validation',
            'repo_id': 'velocitybrain',
            'repeat_count': repeat_count,
            'scenario_reports': scenario_reports,
            'failure_cases': self.reuse_service.get_failure_events(limit=100),
            'reuse_rate': round((reuse_count / len(all_runs)) * 100, 1) if all_runs else 0.0,
            'average_saved_percent': avg_saved_percent,
            'average_tokens_saved': avg_tokens_saved,
            'savings_overview': self.reuse_service.get_savings_overview(),
        }

    def run_scenario(self, scenario: ValidationScenario, repeat_count: int = 5) -> dict[str, Any]:
        tasks = self._scenario_tasks(scenario, repeat_count)
        runs: list[dict[str, Any]] = []
        for index, task in enumerate(tasks, start=1):
            runs.append(self._run_single_scenario_step(scenario, task=task, run_index=index))
        reuse_count = sum(1 for run in runs if run['truth_report']['reused'])
        return {
            'scenario_id': scenario.scenario_id,
            'title': scenario.title,
            'description': scenario.description,
            'runs': runs,
            'reuse_rate': round((reuse_count / len(runs)) * 100, 1) if runs else 0.0,
            'average_saved_percent': round(
                sum(float(run['truth_report']['percent_saved']) for run in runs) / len(runs),
                1,
            ) if runs else 0.0,
        }

    def _scenario_tasks(self, scenario: ValidationScenario, repeat_count: int) -> list[str]:
        if scenario.mode == 'variation':
            return list(islice(cycle(scenario.tasks), repeat_count))
        return [scenario.tasks[0] for _ in range(repeat_count)]

    def _run_single_scenario_step(self, scenario: ValidationScenario, *, task: str, run_index: int) -> dict[str, Any]:
        metadata = {
            'workspace_id': 'velocitybrain-validation',
            'repo_id': 'velocitybrain',
            'context_paths': scenario.context_paths,
            'file_hashes': self._build_file_hashes(scenario.context_paths),
        }
        full_context = self._load_full_context(scenario.context_paths)
        baseline_summary = self._build_artifact_text(task, scenario.context_paths)
        reuse_lookup = self.reuse_service.retrieve_reuse_context(task, metadata=metadata, include_debug=True)
        reused_artifact = reuse_lookup['artifacts'][0]['normalized_text'] if reuse_lookup['artifacts'] else ''

        baseline_prompt = self.reuse_service.serialize_prompt(task_text=task, context_text=full_context, reused=False)
        actual_prompt = self.reuse_service.serialize_prompt(
            task_text=task,
            context_text=reused_artifact or full_context,
            reused=reuse_lookup['reused'],
        )
        correct_reuse = True if not reused_artifact else self._is_correct_reuse(
            task=task,
            baseline_summary=baseline_summary,
            reused_artifact=reused_artifact,
            context_paths=scenario.context_paths,
        )

        event = self.reuse_service.record_validation_run(
            run_id=f'{scenario.scenario_id}-{run_index}-{uuid.uuid4().hex[:8]}',
            task_text=task,
            artifact_text=baseline_summary,
            baseline_prompt=baseline_prompt,
            actual_prompt=actual_prompt,
            reuse_lookup=reuse_lookup,
            metadata=metadata,
            artifact_kind=scenario.artifact_kind,
            expected_hit_types=scenario.expected_hit_types if run_index > 1 else [],
            correct_reuse=correct_reuse,
        )
        if event['failures']:
            self._append_failure_log({
                'scenario_id': scenario.scenario_id,
                'run_index': run_index,
                **event,
            })
        return {
            'scenario_id': scenario.scenario_id,
            'run_index': run_index,
            'task': task,
            'reuse': event['reuse'],
            'savings': event['savings'],
            'truth_report': event['truth_report'],
            'debug': event['debug'],
            'failures': event['failures'],
        }

    def _load_full_context(self, context_paths: list[str]) -> str:
        sections: list[str] = []
        for rel_path in context_paths:
            path = self.repo_root / rel_path
            content = path.read_text(encoding='utf-8', errors='ignore')
            sections.append(f'FILE: {rel_path}\n{content}')
        return '\n\n'.join(sections)

    def _build_artifact_text(self, task: str, context_paths: list[str]) -> str:
        keywords = self._keywords(task)
        sections: list[str] = []
        for rel_path in context_paths:
            path = self.repo_root / rel_path
            lines = path.read_text(encoding='utf-8', errors='ignore').splitlines()
            matched_indexes = [index for index, line in enumerate(lines) if any(keyword in line.lower() for keyword in keywords)]
            if not matched_indexes:
                matched_indexes = list(range(min(8, len(lines))))
            window_indexes: list[int] = []
            for index in matched_indexes[:6]:
                window_indexes.extend(range(max(0, index - 1), min(len(lines), index + 2)))
            unique_indexes = sorted(set(window_indexes))[:14]
            excerpt = '\n'.join(f'{idx + 1}: {lines[idx].strip()}' for idx in unique_indexes if lines[idx].strip())
            sections.append(f'[{rel_path}]\n{excerpt}')
        return '\n\n'.join(sections)

    def _build_file_hashes(self, context_paths: list[str]) -> dict[str, str]:
        hashes: dict[str, str] = {}
        for rel_path in context_paths:
            content = (self.repo_root / rel_path).read_text(encoding='utf-8', errors='ignore')
            hashes[rel_path.lower()] = hashlib.sha256(content.encode('utf-8')).hexdigest()
        return hashes

    def _keywords(self, text: str) -> set[str]:
        return {
            word.lower()
            for word in ''.join(char if char.isalnum() else ' ' for char in text).split()
            if len(word) >= 4 and word.lower() not in STOPWORDS
        }

    def _is_correct_reuse(
        self,
        *,
        task: str,
        baseline_summary: str,
        reused_artifact: str,
        context_paths: list[str],
    ) -> bool:
        required_paths = {f'[{path}]' for path in context_paths}
        path_coverage = (
            sum(1 for marker in required_paths if marker in reused_artifact) / len(required_paths)
            if required_paths else 1.0
        )

        baseline_keywords = self._keywords(task) | self._keywords(baseline_summary)
        reused_keywords = self._keywords(reused_artifact)
        keyword_coverage = len(baseline_keywords & reused_keywords) / len(baseline_keywords) if baseline_keywords else 1.0
        return path_coverage >= 0.5 and keyword_coverage >= 0.45

    def _append_failure_log(self, failure_event: dict[str, Any]) -> None:
        self.failure_log_path.parent.mkdir(parents=True, exist_ok=True)
        serialized = json.dumps(self._json_safe(failure_event), ensure_ascii=False)
        with self.failure_log_path.open('a', encoding='utf-8') as handle:
            handle.write(serialized + '\n')

    def _json_safe(self, payload: Any) -> Any:
        if isinstance(payload, dict):
            return {key: self._json_safe(value) for key, value in payload.items()}
        if isinstance(payload, list):
            return [self._json_safe(value) for value in payload]
        if isinstance(payload, set):
            return sorted(self._json_safe(value) for value in payload)
        return payload
