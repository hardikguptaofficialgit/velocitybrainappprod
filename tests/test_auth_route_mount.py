from fastapi.testclient import TestClient

from src.main import app


def test_auth_authorize_route_is_mounted(monkeypatch):
    client = TestClient(app)

    async def _fake_validate(_: str):
        return {
            'tier': 'pro',
            'rate_limit': 10000,
            'user_id': 'user-123',
        }

    monkeypatch.setattr('src.core_api.auth.validate_api_key_with_backend', _fake_validate)

    response = client.post('/v1/auth/authorize', json={'api_key': 'vb_test_key'})

    assert response.status_code == 200
    payload = response.json()
    assert payload['token_type'] == 'bearer'
    assert payload['expires_in'] == 3600
    assert payload['access_token']
    assert payload['refresh_token']


def test_auth_authorize_route_rejects_invalid_key(monkeypatch):
    client = TestClient(app)

    async def _fake_validate(_: str):
        return None

    monkeypatch.setattr('src.core_api.auth.validate_api_key_with_backend', _fake_validate)

    response = client.post('/v1/auth/authorize', json={'api_key': 'vb_bad_key'})

    assert response.status_code == 401
    assert response.json()['detail'] == 'Invalid API key'
