from fastapi.testclient import TestClient

from src.main import app


def test_audit_recent_endpoint_returns_trace_id(monkeypatch):
    client = TestClient(app)

    def fake_recent_audit(self, limit=100):
        return {
            'count': 1,
            'events': [{'id': 1, 'event_type': 'destructive_tool_blocked', 'actor': 'mcp', 'created_at': '2026-04-18T00:00:00Z'}],
        }

    monkeypatch.setattr('src.services.compliance_service.ComplianceService.recent_audit', fake_recent_audit)

    response = client.get('/v1/audit/recent?limit=10')

    assert response.status_code == 200
    payload = response.json()
    assert payload['count'] == 1
    assert payload['events'][0]['event_type'] == 'destructive_tool_blocked'
    assert 'trace_id' in payload
