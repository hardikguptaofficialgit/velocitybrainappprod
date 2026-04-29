from fastapi.testclient import TestClient

from src.cli import build_parser
from src.main import app


def test_cli_exposes_openclaw_command():
    parser = build_parser()
    args = parser.parse_args(['openclaw'])

    assert args.command == 'openclaw'


def test_openclaw_profile_endpoint_returns_profile():
    client = TestClient(app)

    response = client.get('/v1/openclaw/profile')

    assert response.status_code == 200
    payload = response.json()
    assert payload['name'] == 'velocitybrain'
    assert payload['client'] == 'openclaw'
    assert 'server' in payload
    assert 'trace_id' in payload


def test_openclaw_capabilities_endpoint_returns_summary():
    client = TestClient(app)

    response = client.get('/v1/openclaw/capabilities')

    assert response.status_code == 200
    payload = response.json()
    assert payload['name'] == 'velocitybrain'
    assert payload['client'] == 'openclaw'
    assert payload['tool_count'] >= 12
    assert 'response_styles' in payload
    assert 'full' in payload['response_styles']
    assert 'trace_id' in payload