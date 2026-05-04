from pathlib import Path
import builtins
import json

from src import cli
from src.client.exceptions import AuthenticationError
from src.services.adoption_service import AdoptionService


def test_runtime_mode_auto_prefers_cloud_when_api_key_present(monkeypatch):
    monkeypatch.setenv('VELOCITYBRAIN_API_KEY', 'vb_test_key')
    monkeypatch.delenv('VELOCITYBRAIN_RUNTIME_MODE', raising=False)

    parser = cli.build_parser()
    args = parser.parse_args(['about'])

    assert cli._resolve_runtime_mode(args) == cli.RUNTIME_MODE_CLOUD


def test_login_persists_cloud_config(monkeypatch, tmp_path):
    config_dir = tmp_path / '.velocitybrain'
    config_path = config_dir / 'config.json'
    monkeypatch.setattr(cli, 'CONFIG_DIR', config_dir)
    monkeypatch.setattr(cli, 'CONFIG_PATH', config_path)

    parser = cli.build_parser()
    args = parser.parse_args(['login', '--api-key', 'vb_live_12345678', '--base-url', 'https://api.example.com'])

    exit_code = cli.cmd_login(args)

    assert exit_code == 0
    saved = cli._load_cli_config()
    assert saved['api_key'] == 'vb_live_12345678'
    assert saved['base_url'] == 'https://api.example.com'
    assert saved['runtime_mode'] == cli.RUNTIME_MODE_CLOUD


def test_handle_no_command_runs_cloud_onboarding(monkeypatch, tmp_path):
    config_dir = tmp_path / '.velocitybrain'
    config_path = config_dir / 'config.json'
    monkeypatch.setattr(cli, 'CONFIG_DIR', config_dir)
    monkeypatch.setattr(cli, 'CONFIG_PATH', config_path)
    monkeypatch.setattr(cli.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(cli.sys.stdout, 'isatty', lambda: True)

    monkeypatch.setattr(cli, '_open_dashboard', lambda url=cli.DEFAULT_DASHBOARD_URL: True)
    answers = iter(['1', 'y', 'vb_live_first_run'])
    monkeypatch.setattr(builtins, 'input', lambda prompt='': next(answers))

    parser = cli.build_parser()
    exit_code = cli._handle_no_command(parser)

    assert exit_code == 0
    saved = cli._load_cli_config()
    assert saved['runtime_mode'] == cli.RUNTIME_MODE_CLOUD
    assert saved['api_key'] == 'vb_live_first_run'


def test_handle_no_command_runs_self_hosted_onboarding(monkeypatch, tmp_path):
    config_dir = tmp_path / '.velocitybrain'
    config_path = config_dir / 'config.json'
    monkeypatch.setattr(cli, 'CONFIG_DIR', config_dir)
    monkeypatch.setattr(cli, 'CONFIG_PATH', config_path)
    monkeypatch.setattr(cli.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(cli.sys.stdout, 'isatty', lambda: True)

    answers = iter(['2'])
    monkeypatch.setattr(builtins, 'input', lambda prompt='': next(answers))

    parser = cli.build_parser()
    exit_code = cli._handle_no_command(parser)

    assert exit_code == 0
    saved = cli._load_cli_config()
    assert saved['runtime_mode'] == cli.RUNTIME_MODE_SELF_HOSTED


def test_cloud_error_details_for_authentication_failure():
    details = cli._cloud_error_details(AuthenticationError('Invalid API key'))

    assert details['status'] == 'authentication_failed'
    assert details['checks']['api_key'] is False
    assert 'Generate a fresh API key' in details['hint']


def test_connect_codex_command_available():
    assert cli._connect_command_for_client('codex') == 'codex mcp add velocitybrain -- velocitybrain serve mcp'


def test_default_cloud_base_url_matches_current_hosted_backend():
    assert cli.DEFAULT_CLOUD_BASE_URL == 'https://velocity.linkitapp.in'


def test_doctor_details_masks_api_key(monkeypatch, tmp_path):
    config_dir = tmp_path / '.velocitybrain'
    config_path = config_dir / 'config.json'
    monkeypatch.setattr(cli, 'CONFIG_DIR', config_dir)
    monkeypatch.setattr(cli, 'CONFIG_PATH', config_path)
    cli._save_cli_config({'api_key': 'vb_live_supersecret', 'base_url': 'https://api.example.com'})

    details = cli._doctor_details(cli.RUNTIME_MODE_CLOUD)

    assert details['runtime_mode'] == cli.RUNTIME_MODE_CLOUD
    assert details['base_url'] == 'https://api.example.com'
    assert 'supersecret' not in details['api_key']


def test_smoke_self_hosted_uses_local_helpers(monkeypatch):
    monkeypatch.setattr(cli, '_doctor_payload', lambda: {'ok': True, 'checks': {}, 'trace_id': 'doctor'})
    monkeypatch.setattr(cli.SkillRegistry, 'list_skills', lambda self: [{'name': 'summarize'}])
    monkeypatch.setattr(cli, '_query_payload', lambda question, limit, response_style='normal': {'answer': 'ok'})

    payload = cli._smoke_self_hosted('test question')

    assert payload['ok'] is True
    assert payload['passed'] == 3


def test_debug_run_command_returns_truth_report(capsys):
    parser = cli.build_parser()
    args = parser.parse_args(['--json', 'debug-run', '--scenario', 'auth-repeat', '--repeat-count', '2'])

    exit_code = cli.cmd_debug_run(args)
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert output['scenario_reports'][0]['scenario_id'] == 'auth-repeat'
    assert output['scenario_reports'][0]['runs'][1]['truth_report']['reused'] is True


def test_quickstart_command_returns_immediate_savings(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(cli, '_try_auto_connect', lambda client_name: (True, 'connected'))
    monkeypatch.setattr(cli, 'AdoptionService', lambda: AdoptionService(state_dir=tmp_path / 'state', repo_root=Path.cwd()))
    parser = cli.build_parser()
    args = parser.parse_args(['--json', 'quickstart', '--repo-path', '.'])

    exit_code = cli.cmd_quickstart(args)
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert output['reused'] is True
    assert output['tokens_saved'] > 0
    assert output['reuse_confidence'] >= 0.0


def test_share_run_outputs_last_saved_proof(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(cli, 'AdoptionService', lambda: AdoptionService(state_dir=tmp_path / 'state', repo_root=Path.cwd()))
    parser = cli.build_parser()
    run_args = parser.parse_args(['run', 'Map the main architecture and likely edit surface for this repo.', '--repo-path', '.'])
    cli.cmd_run(run_args)
    capsys.readouterr()

    share_args = parser.parse_args(['--json', 'share-run'])
    exit_code = cli.cmd_share_run(share_args)
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert set(output.keys()) == {'result', 'reused', 'reuse_confidence', 'tokens_saved', 'percent_saved'}
    assert output['tokens_saved'] >= 0


def test_export_metrics_outputs_user_repo_and_failure_groups(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(cli, 'AdoptionService', lambda: AdoptionService(state_dir=tmp_path / 'state', repo_root=Path.cwd()))
    parser = cli.build_parser()
    run_args = parser.parse_args(['run', 'Map the main architecture and likely edit surface for this repo.', '--repo-path', '.'])
    cli.cmd_run(run_args)
    capsys.readouterr()

    export_args = parser.parse_args(['--json', 'export-metrics'])
    exit_code = cli.cmd_export_metrics(export_args)
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert set(output.keys()) >= {'user_metrics', 'repo_metrics', 'failure_clusters'}
