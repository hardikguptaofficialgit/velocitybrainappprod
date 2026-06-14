from pathlib import Path
import builtins
import json
import shutil
import tempfile

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


def test_report_agent_connection_queues_when_api_key_missing(monkeypatch, tmp_path):
    config_dir = tmp_path / '.velocitybrain'
    config_path = config_dir / 'config.json'
    monkeypatch.setattr(cli, 'CONFIG_DIR', config_dir)
    monkeypatch.setattr(cli, 'CONFIG_PATH', config_path)

    ok, note = cli._report_agent_connection('codex', str(tmp_path))
    saved = cli._load_cli_config()

    assert ok is False
    assert 'Queued codex integration' in note
    assert len(saved['pending_integrations']) == 1
    assert saved['pending_integrations'][0]['agent_id'] == 'codex'


def test_flush_pending_integrations_runs_after_key_is_saved(monkeypatch, tmp_path):
    config_dir = tmp_path / '.velocitybrain'
    config_path = config_dir / 'config.json'
    monkeypatch.setattr(cli, 'CONFIG_DIR', config_dir)
    monkeypatch.setattr(cli, 'CONFIG_PATH', config_path)
    cli._save_cli_config({
        'api_key': 'vb_live_queued',
        'base_url': 'https://api.example.com',
        'pending_integrations': [{
            'agent_id': 'codex',
            'status': 'connected',
            'repo_id': 'repo-x',
            'repo_name': 'repo-x',
            'repo_path': 'C:/repo-x',
            'metadata': {'source': 'connect'}
        }]
    })

    captured = []

    class DummyClient:
        def __init__(self, api_key, base_url):
            self.api_key = api_key
            self.base_url = base_url

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            return False

        def report_integration(self, **kwargs):
            captured.append(kwargs)

    monkeypatch.setattr(cli, 'VelocityBrainClient', DummyClient)

    ok, note = cli._flush_pending_integrations()
    saved = cli._load_cli_config()

    assert ok is True
    assert 'Synced 1 pending integrations' in note
    assert captured[0]['agent_id'] == 'codex'
    assert saved['pending_integrations'] == []


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


def test_connect_pair_code_stores_agent_credentials(monkeypatch):
    root = Path(tempfile.mkdtemp(prefix='vb-pairing-', dir=str(Path.cwd())))
    state = {'base_url': 'https://api.example.com'}
    try:
        monkeypatch.setattr(cli, '_load_cli_config', lambda: dict(state))
        monkeypatch.setattr(cli, '_save_cli_config', lambda payload: state.clear() or state.update(payload))
        monkeypatch.setattr(cli, '_run_connect_command', lambda command: type('Completed', (), {'returncode': 0, 'stdout': 'connected', 'stderr': ''})())
        monkeypatch.setattr(cli, '_ensure_velocitybrain_agents_md', lambda repo_path=None: (False, 'AGENTS ok'))
        monkeypatch.setattr(cli, '_ensure_velocitybrain_identity_spec', lambda repo_path=None: (False, 'identity ok'))
        monkeypatch.setattr(cli, '_report_agent_connection', lambda *args, **kwargs: (True, 'integration ok'))
        monkeypatch.setattr(cli, '_detect_repo_context', lambda repo_path=None: {
            'repo_id': 'repo-x',
            'repo_name': 'repo-x',
            'repo_path': str(root),
            'cwd': str(root),
            'project_id': 'repo-x',
            'branch': 'main',
        })
        monkeypatch.setattr(cli.VelocityBrainClient, 'complete_agent_pairing', lambda **kwargs: {
            'agent_connection_id': 'conn_123',
            'access_token': 'agent_access',
            'refresh_token': 'agent_refresh',
            'expires_in': 3600,
        })

        parser = cli.build_parser()
        args = parser.parse_args(['connect', 'codex', '--pair-code', 'vbp_pair_code', '--apply', '--repo-path', str(root)])

        exit_code = cli.cmd_connect(args)

        assert exit_code == 0
        assert state['preferred_agent'] == 'codex'
        assert state['agent_credentials']['codex']['agent_connection_id'] == 'conn_123'
        assert state['agent_credentials']['codex']['access_token'] == 'agent_access'
    finally:
        shutil.rmtree(root, ignore_errors=True)


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


def test_ensure_velocitybrain_agents_md_creates_file(tmp_path):
    changed, message = cli._ensure_velocitybrain_agents_md(str(tmp_path))

    agents_path = tmp_path / 'AGENTS.md'
    assert changed is True
    assert agents_path.exists()
    assert 'Use the `velocitybrain` MCP server automatically' in agents_path.read_text(encoding='utf-8')
    assert 'Created' in message


def test_ensure_velocitybrain_agents_md_is_idempotent(tmp_path):
    cli._ensure_velocitybrain_agents_md(str(tmp_path))
    changed, message = cli._ensure_velocitybrain_agents_md(str(tmp_path))

    assert changed is False
    assert 'already contains Velocity Brain instructions' in message


def test_ensure_velocitybrain_identity_spec_creates_file(tmp_path):
    changed, message = cli._ensure_velocitybrain_identity_spec(str(tmp_path))

    spec_path = tmp_path / 'identity.spec.json'
    assert changed is True
    assert spec_path.exists()
    payload = json.loads(spec_path.read_text(encoding='utf-8'))
    assert payload['runtime_policies']['brain_first_for_repo_tasks'] is True
    assert 'lookup_memory' in payload['capabilities']
    assert 'Created' in message


def test_ensure_velocitybrain_identity_spec_merges_existing_file(tmp_path):
    spec_path = tmp_path / 'identity.spec.json'
    spec_path.write_text(json.dumps({
        'name': 'custom-runtime',
        'persona': {'tone': 'custom-tone'},
        'runtime_policies': {'destructive_tools_require_approval': False},
        'capabilities': ['custom_capability']
    }), encoding='utf-8')

    changed, message = cli._ensure_velocitybrain_identity_spec(str(tmp_path))
    payload = json.loads(spec_path.read_text(encoding='utf-8'))

    assert changed is True
    assert payload['name'] == 'custom-runtime'
    assert payload['persona']['tone'] == 'custom-tone'
    assert payload['runtime_policies']['destructive_tools_require_approval'] is False
    assert payload['runtime_policies']['brain_first_for_repo_tasks'] is True
    assert 'custom_capability' in payload['capabilities']
    assert 'lookup_memory' in payload['capabilities']
    assert 'Updated identity.spec.json' in message


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


def test_connect_antigravity_returns_config_and_pairing_hint(monkeypatch, capsys):
    state = {'base_url': 'https://api.example.com'}
    monkeypatch.setattr(cli, '_load_cli_config', lambda: dict(state))
    monkeypatch.setattr(cli, '_save_cli_config', lambda payload: state.clear() or state.update(payload))
    monkeypatch.setattr(cli, '_detect_repo_context', lambda repo_path=None: {
        'repo_id': 'repo-x',
        'repo_name': 'repo-x',
        'repo_path': str(Path.cwd()),
        'cwd': str(Path.cwd()),
        'project_id': 'repo-x',
        'branch': 'main',
    })
    monkeypatch.setattr(cli.VelocityBrainClient, 'complete_agent_pairing', lambda **kwargs: {
        'agent_connection_id': 'conn_123',
        'access_token': 'agent_access',
        'refresh_token': 'agent_refresh',
        'expires_in': 3600,
    })

    parser = cli.build_parser()
    args = parser.parse_args(['connect', 'antigravity', '--pair-code', 'vbp_pair_code'])

    exit_code = cli.cmd_connect(args)
    captured = capsys.readouterr().out

    assert exit_code == 0
    assert state['preferred_agent'] == 'antigravity'
    assert 'Antigravity agent configuration' in captured
