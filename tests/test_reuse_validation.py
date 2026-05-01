from src.services.reuse_validation import ReuseValidationService


def test_reuse_validation_suite_increases_reuse_and_saves_tokens():
    payload = ReuseValidationService().run_validation_suite(repeat_count=3)

    assert payload['reuse_rate'] > 0
    assert payload['average_saved_percent'] > 0
    assert len(payload['scenario_reports']) == 3

    auth_repeat = next(report for report in payload['scenario_reports'] if report['scenario_id'] == 'auth-repeat')
    first_run, second_run = auth_repeat['runs'][0], auth_repeat['runs'][1]
    assert first_run['truth_report']['reused'] is False
    assert second_run['truth_report']['reused'] is True
    assert second_run['savings']['input_tokens_actual'] < first_run['savings']['input_tokens_actual']


def test_reuse_validation_suite_has_no_failures_for_default_scenarios():
    payload = ReuseValidationService().run_validation_suite(repeat_count=2)

    assert payload['failure_cases'] == []
    for report in payload['scenario_reports']:
        for run in report['runs']:
            assert run['truth_report']['correct_reuse'] is True
