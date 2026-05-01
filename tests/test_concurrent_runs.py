from concurrent.futures import ThreadPoolExecutor

from src.services.reuse_service import ReuseService


def test_parallel_identical_tasks_stay_consistent():
    service = ReuseService()
    service.reset_state()
    metadata = {
        'workspace_id': 'parallel',
        'repo_id': 'velocitybrain',
        'context_paths': ['src/cli.py', 'README.md'],
        'file_hashes': {'src/cli.py': 'hash-a', 'readme.md': 'hash-b'},
    }

    def run_task(index: int) -> dict:
        return service.record_reuse_decision(
            run_id=f'parallel-{index}',
            task_text='Map the main architecture and likely edit surface for this repo.',
            response_text='Architecture summary with CLI and README.',
            artifact_kind='summary',
            metadata=metadata,
        )

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(run_task, range(12)))

    assert results[0]['reuse']['hit_type'] == 'none'
    assert all(result['reuse']['hit_type'] in {'none', 'exact'} for result in results)
    assert service.get_savings_overview()['run_count'] == 12


def test_parallel_variations_do_not_corrupt_blacklist_or_cache():
    service = ReuseService()
    service.reset_state()
    metadata = {
        'workspace_id': 'parallel',
        'repo_id': 'velocitybrain',
        'context_paths': ['src/core_api/auth.py', 'backend/server.js'],
        'file_hashes': {'src/core_api/auth.py': 'hash-auth', 'backend/server.js': 'hash-server'},
    }
    tasks = [
        'Map the hosted auth flow and API key validation.',
        'Summarize the auth path with API key validation.',
        'Which files change hosted auth without breaking API keys?',
    ]

    def run_task(index: int) -> dict:
        task = tasks[index % len(tasks)]
        return service.record_reuse_decision(
            run_id=f'variation-{index}',
            task_text=task,
            response_text='[src/core_api/auth.py] Auth summary.\n[backend/server.js] Backend validation and CLI flow.',
            artifact_kind='summary',
            metadata=metadata,
        )

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(run_task, range(18)))

    assert all(result['reuse']['reuse_confidence'] >= 0.0 for result in results)
    assert service.get_savings_overview()['failure_count'] == 0
