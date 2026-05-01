from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core_api import brain as brain_module


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(brain_module.create_brain_router())
    app.dependency_overrides[brain_module.get_current_user] = lambda: {
        "api_key": "vb_test_key",
        "tier": "pro",
        "rate_limit": 1000,
    }
    app.dependency_overrides[brain_module.get_rate_limit_info] = lambda: {
        "tier": "pro",
        "rate_limit": 1000,
        "api_key": "vb_test_key",
    }
    return app


def test_run_endpoint_returns_product_contract():
    client = TestClient(_app())

    first = client.post(
        "/v1/run",
        json={"task": "Map the hosted auth flow", "metadata": {"repo_id": "velocitybrain", "workspace_id": "acme"}},
    )
    second = client.post(
        "/v1/run",
        json={"task": "Map the hosted auth flow", "metadata": {"repo_id": "velocitybrain", "workspace_id": "acme"}},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    payload = second.json()
    assert set(payload.keys()) == {"result", "reused", "reuse_confidence", "tokens_saved", "percent_saved"}
    assert payload["reused"] is True
    assert payload["tokens_saved"] >= 0
    assert payload["percent_saved"] >= 0
    assert 0.0 <= payload["reuse_confidence"] <= 1.0


def test_usage_endpoint_returns_minimal_retention_metrics():
    client = TestClient(_app())

    client.post(
        "/v1/run",
        json={"task": "Map the hosted auth flow", "metadata": {"repo_id": "velocitybrain", "workspace_id": "acme"}},
    )
    client.post(
        "/v1/run",
        json={"task": "Map the hosted auth flow", "metadata": {"repo_id": "velocitybrain", "workspace_id": "acme"}},
    )

    response = client.get("/v1/usage")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"total_runs", "repeat_rate", "reuse_hit_rate", "avg_token_savings"}
    assert payload["total_runs"] >= 2
    assert payload["repeat_rate"] >= 0
