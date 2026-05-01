from src.services.reuse_validation import ReuseValidationService


def test_same_task_reuse_converges_to_full_reuse():
    payload = ReuseValidationService().run_until_scenario('auth-repeat', repeat_count=10)
    report = payload['scenario_reports'][0]
    later_runs = report['runs'][1:]
    assert all(run['truth_report']['reused'] for run in later_runs)
    assert report['reuse_rate'] >= 90.0


def test_variations_keep_high_reuse_rate():
    payload = ReuseValidationService().run_until_scenario('auth-variation', repeat_count=10)
    report = payload['scenario_reports'][0]
    assert report['reuse_rate'] >= 80.0


def test_cross_task_same_repo_reuse_stays_high():
    validator = ReuseValidationService()
    full = validator.run_validation_suite(repeat_count=10)
    cross_task = next(report for report in full['scenario_reports'] if report['scenario_id'] == 'auth-change-plan')
    assert cross_task['reuse_rate'] >= 70.0
