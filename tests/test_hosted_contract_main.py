from fastapi.testclient import TestClient

from src.core_api import auth as auth_module
from src.main import app


def _client():
    return TestClient(app)


def test_main_app_exposes_usage_contract(monkeypatch):
    client = _client()

    async def _fake_validate(_: str):
        return {
            "tier": "pro",
            "rate_limit": 10000,
            "user_id": "user-usage",
        }

    monkeypatch.setattr("src.core_api.auth.validate_api_key_with_backend", _fake_validate)

    auth_response = client.post("/v1/auth/authorize", json={"api_key": "vb_test_key"})
    assert auth_response.status_code == 200
    token = auth_response.json()["access_token"]

    first = client.post(
        "/v1/run",
        json={"task": "Map the hosted auth flow", "metadata": {"repo_id": "velocitybrain", "workspace_id": "acme"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    second = client.post(
        "/v1/run",
        json={"task": "Map the hosted auth flow", "metadata": {"repo_id": "velocitybrain", "workspace_id": "acme"}},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert first.status_code == 200
    assert second.status_code == 200

    response = client.get("/v1/usage", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"total_runs", "repeat_rate", "reuse_hit_rate", "avg_token_savings"}
    assert payload["total_runs"] >= 2


def test_main_app_exposes_query_contract(monkeypatch):
    client = _client()

    async def _fake_validate(_: str):
        return {
            "tier": "pro",
            "rate_limit": 10000,
            "user_id": "user-query",
        }

    monkeypatch.setattr("src.core_api.auth.validate_api_key_with_backend", _fake_validate)

    auth_response = client.post("/v1/auth/authorize", json={"api_key": "vb_test_key"})
    assert auth_response.status_code == 200
    token = auth_response.json()["access_token"]

    monkeypatch.setattr(
        "src.core_api.brain.RetrievalEngine.hybrid_search",
        lambda self, query, limit=10, org_key=None: [
            {
                "slug": "auth-flow",
                "title": "Auth Flow",
                "compiled_truth_md": "Hosted auth route is mounted and returns bearer tokens.",
                "confidence": 0.93,
            }
        ],
    )

    response = client.post(
        "/v1/query",
        json={"question": "What do we know about auth?", "response_style": "lite", "max_results": 3},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["confidence"] == 0.93
    assert payload["sources"][0]["slug"] == "auth-flow"
    assert payload["response_style"] == "lite"
