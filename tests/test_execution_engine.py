from src.services.execution_engine import ExecutionEngine
from src.services.job_queue_service import JobQueueService


def test_execution_engine_executes_internal_actions_without_simulated_success(monkeypatch):
    monkeypatch.setattr('src.services.job_queue_service.settings.job_queue_backend', 'memory')
    monkeypatch.setattr('src.services.job_queue_service.settings.job_queue_require_persistence', False)
    JobQueueService._memory_jobs.clear()

    engine = ExecutionEngine()
    results = engine.execute([
        {'action_type': 'query.aggregate', 'payload': {'signal': 'auth'}},
        {'action_type': 'response.generate', 'payload': {'signal': 'auth'}},
    ])

    assert len(results) == 2
    assert all(result['status'] == 'completed' for result in results)
    assert all(result['job_id'] for result in results)
    assert all(result['status'] != 'simulated_success' for result in results)


def test_execution_engine_queues_async_workflow(monkeypatch):
    monkeypatch.setattr('src.services.job_queue_service.settings.job_queue_backend', 'memory')
    monkeypatch.setattr('src.services.job_queue_service.settings.job_queue_require_persistence', False)
    JobQueueService._memory_jobs.clear()

    engine = ExecutionEngine()
    result = engine.execute_workflow('test-workflow', {'signal': 'run'}, run_async=True)

    assert result['status'] == 'queued'
    saved = engine.get_job_status(result['job_id'])
    assert saved is not None
    assert saved['kind'] == 'workflow.execute'
