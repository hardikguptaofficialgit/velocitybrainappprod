from pathlib import Path

from src.services.adoption_service import AdoptionService


def test_adoption_service_second_run_shows_visible_savings(tmp_path):
    state_dir = tmp_path / 'state'
    repo_root = Path.cwd()
    service = AdoptionService(state_dir=state_dir, repo_root=repo_root)
    task = 'Map the main architecture and likely edit surface for this repo.'

    first = service.run_task(task, repo_path=str(repo_root))
    second = service.run_task(task, repo_path=str(repo_root))

    assert first['truth_report']['reused'] is False
    assert second['truth_report']['reused'] is True
    assert second['truth_report']['tokens_saved'] > 0


def test_adoption_service_share_last_run(tmp_path):
    state_dir = tmp_path / 'state'
    repo_root = Path.cwd()
    service = AdoptionService(state_dir=state_dir, repo_root=repo_root)
    task = 'Map the main architecture and likely edit surface for this repo.'

    service.run_task(task, repo_path=str(repo_root))
    shared = service.share_last_run()

    assert shared['task'] == task
    assert 'truth_report' in shared
