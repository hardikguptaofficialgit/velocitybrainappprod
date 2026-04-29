from fastapi.testclient import TestClient

from src.main import app


def test_runtime_status_endpoint_returns_summary(monkeypatch):
    client = TestClient(app)

    monkeypatch.setattr(
        'src.services.runtime_status.SkillRegistry.list_skills',
        lambda self: [
            {'skill_key': 'query-basic', 'category': 'query', 'name': 'Query Basic'},
            {'skill_key': 'plan-basic', 'category': 'planning', 'name': 'Plan Basic'},
        ],
    )
    monkeypatch.setattr(
        'src.services.runtime_status.build_openclaw_profile',
        lambda: {
            'server': {'command': 'velocitybrain', 'args': ['serve', 'mcp']},
            'capabilities': {'tool_count': 10, 'skill_count': 2},
            'recommended_smoke_flow': ['healthz', 'list_skills', 'query', 'run_agent'],
        },
    )
    monkeypatch.setattr(
        'src.services.runtime_status.ComplianceService.recent_audit',
        lambda self, limit=5: {
            'count': 1,
            'events': [
                {
                    'id': 7,
                    'event_type': 'destructive_tool_blocked',
                    'actor': 'mcp',
                    'created_at': '2026-04-18T00:00:00Z',
                }
            ],
        },
    )

    response = client.get('/v1/runtime/status')

    assert response.status_code == 200
    payload = response.json()
    assert payload['health']['ok'] is True
    assert payload['skills']['count'] == 2
    assert payload['openclaw']['tool_count'] == 10
    assert payload['audit']['available'] is True
    assert payload['audit']['count'] == 1
    assert 'trace_id' in payload


def test_runtime_status_endpoint_handles_audit_failure(monkeypatch):
    client = TestClient(app)

    monkeypatch.setattr('src.services.runtime_status.SkillRegistry.list_skills', lambda self: [])
    monkeypatch.setattr(
        'src.services.runtime_status.build_openclaw_profile',
        lambda: {'server': {'command': 'velocitybrain', 'args': ['serve', 'mcp']}, 'capabilities': {}, 'recommended_smoke_flow': []},
    )

    def _raise(self, limit=5):
        raise RuntimeError('db unavailable')

    monkeypatch.setattr('src.services.runtime_status.ComplianceService.recent_audit', _raise)

    response = client.get('/v1/runtime/status')

    assert response.status_code == 200
    payload = response.json()
    assert payload['audit']['available'] is False
    assert payload['audit']['count'] == 0
    assert 'error' in payload['audit']
