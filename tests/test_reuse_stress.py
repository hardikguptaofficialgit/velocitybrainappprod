from src.services.reuse_validation import ReuseValidationService


def test_reuse_stress_repeated_runs_remain_stable():
    payload = ReuseValidationService().run_until_scenario('auth-repeat', repeat_count=100)
    report = payload['scenario_reports'][0]
    assert report['reuse_rate'] >= 99.0


def test_reuse_stress_variations_hold_reuse_rate():
    payload = ReuseValidationService().run_until_scenario('auth-variation', repeat_count=50)
    report = payload['scenario_reports'][0]
    assert report['reuse_rate'] >= 80.0


def test_reuse_stress_mixed_repo_tasks_keep_latency_bounded():
    validator = ReuseValidationService()
    validator.run_validation_suite(repeat_count=20)
    latency = validator.reuse_service.get_latency_summary()
    assert latency['p50_ms'] < 20.0
    assert latency['p95_ms'] < 80.0


def test_reuse_stress_storage_remains_bounded():
    validator = ReuseValidationService()
    validator.run_validation_suite(repeat_count=120)
    storage = validator.reuse_service.get_storage_summary()
    assert storage['artifact_count'] <= 500
    assert storage['compression_ratio'] > 0
