from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from src.services.adoption_service import AdoptionService


def main() -> int:
    parser = argparse.ArgumentParser(description='VelocityBrain YC demo runner.')
    parser.add_argument('--repo-path', default='.', help='Repository path to analyze.')
    args = parser.parse_args()

    repo_path = str(Path(args.repo_path).resolve())
    demo_state = Path.home() / '.velocitybrain' / 'demo-state'
    shutil.rmtree(demo_state, ignore_errors=True)
    service = AdoptionService(
        state_dir=demo_state,
        repo_root=Path(repo_path),
    )
    task = 'Map the main architecture and likely edit surface for this repo.'

    print('VelocityBrain Demo')
    print(f'repo: {repo_path}')
    print(f'task: {task}')
    print('')

    runs = [
        service.run_task(task, repo_path=repo_path),
        service.run_task(task, repo_path=repo_path),
        service.run_task(task, repo_path=repo_path),
    ]

    for index, run in enumerate(runs, start=1):
        truth = run['truth_report']
        savings = run['savings']
        print(f'run {index}')
        print(f"  reused: {truth['reused']}")
        print(f"  tokens_without_reuse: {savings['input_tokens_without_reuse']}")
        print(f"  tokens_with_reuse: {savings['input_tokens_actual']}")
        print(f"  tokens_saved: {truth['tokens_saved']}")
        print(f"  percent_saved: {truth['percent_saved']}")
        print('')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
