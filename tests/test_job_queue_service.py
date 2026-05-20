from src.services.job_queue_service import JobQueueService


def test_job_queue_service_processes_job_lifecycle_in_memory(monkeypatch):
    monkeypatch.setattr('src.services.job_queue_service.settings.job_queue_backend', 'memory')
    monkeypatch.setattr('src.services.job_queue_service.settings.job_queue_require_persistence', False)

    queue = JobQueueService()
    JobQueueService._memory_jobs.clear()

    job = queue.enqueue('action.execute', {'value': 1}, max_retries=2)
    assert job['status'] == 'queued'

    processed = queue.process_once({'action.execute': lambda payload: {'status': 'completed', 'value': payload['value'] + 1}})
    assert processed['status'] == 'completed'
    assert processed['result']['value'] == 2

    saved = queue.get_job(job['job_id'])
    assert saved is not None
    assert saved['status'] == 'completed'


def test_job_queue_service_retries_then_fails_in_memory(monkeypatch):
    monkeypatch.setattr('src.services.job_queue_service.settings.job_queue_backend', 'memory')
    monkeypatch.setattr('src.services.job_queue_service.settings.job_queue_require_persistence', False)

    queue = JobQueueService()
    JobQueueService._memory_jobs.clear()

    job = queue.enqueue('action.execute', {'value': 1}, max_retries=1)
    processed = queue.process_once({'action.execute': lambda payload: (_ for _ in ()).throw(RuntimeError('boom'))})
    assert processed['status'] == 'failed'

    saved = queue.get_job(job['job_id'])
    assert saved is not None
    assert saved['status'] == 'failed'
    assert saved['last_error'] == 'boom'
