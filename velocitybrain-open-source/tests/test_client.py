from velocitybrain_client.client.client import VelocityBrainClient


class FakeResponse:
    def __init__(self, payload, status_code=200, headers=None):
        self._payload = payload
        self.status_code = status_code
        self.headers = headers or {}
        self.ok = 200 <= status_code < 300
        self.text = "" if self.ok else str(payload)

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, calls, responses):
        self.calls = calls
        self.responses = list(responses)

    def request(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)

    def close(self):
        pass


def make_client(monkeypatch, responses):
    calls = []

    def fake_post(url, **kwargs):
        return FakeResponse({
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
        })

    monkeypatch.setattr("requests.post", fake_post)
    monkeypatch.setattr("requests.Session", lambda: FakeSession(calls, responses))
    return VelocityBrainClient("vb-test", base_url="https://api.example.test"), calls


def test_public_client_exposes_hosted_endpoints_only():
    methods = {name for name in dir(VelocityBrainClient) if not name.startswith("_")}
    assert "run" in methods
    assert "query" not in methods
    assert "get_status" in methods
    assert "get_health" in methods
    assert "get_usage_stats" in methods
    assert "get_integrations" in methods
    assert "start_integration" in methods
    assert "resync_integration" in methods
    assert "disconnect_integration" in methods
    assert "ingest" not in methods
    assert "execute_skill" not in methods
    assert "store_artifact" not in methods
    assert "retrieve_reuse_context" not in methods
    assert "record_reuse_decision" not in methods


def test_health_and_status_use_hosted_v1_endpoints(monkeypatch):
    client, calls = make_client(monkeypatch, [
        FakeResponse({"status": "ok"}),
        FakeResponse({"status": "ok"}),
        FakeResponse({"total_runs": 3}),
    ])

    assert client.get_health() == {"status": "ok"}
    status = client.get_status()

    assert status["status"] == "ok"
    assert status["usage"] == {"total_runs": 3}
    assert [call["url"] for call in calls] == [
        "https://api.example.test/v1/health",
        "https://api.example.test/v1/health",
        "https://api.example.test/v1/usage",
    ]


def test_integrations_use_hosted_api_key_surface(monkeypatch):
    client, calls = make_client(monkeypatch, [
        FakeResponse({"integrations": [{"id": "conn-1", "agent_id": "github", "status": "connected"}]}),
        FakeResponse({"integrations": [{"id": "conn-1", "agent_id": "github", "status": "connected"}]}),
        FakeResponse({"integrations": [{"id": "conn-1", "agent_id": "github", "status": "connected"}]}),
        FakeResponse({"success": True, "connection_id": "conn-1", "status": "revoked"}),
    ])

    integrations = client.get_integrations()
    status = client.get_integration_status("github")
    disconnected = client.disconnect_integration("github")

    assert integrations["integrations"][0]["id"] == "conn-1"
    assert status["integration"]["status"] == "connected"
    assert disconnected["status"] == "revoked"
    assert [call["url"] for call in calls] == [
        "https://api.example.test/v1/integrations",
        "https://api.example.test/v1/integrations",
        "https://api.example.test/v1/integrations",
        "https://api.example.test/v1/integrations/conn-1/revoke",
    ]


def test_browser_integration_actions_return_dashboard_guidance(monkeypatch):
    client, calls = make_client(monkeypatch, [])
    payload = client.start_integration("github")

    assert calls == []
    assert payload["success"] is False
    assert payload["status"] == "dashboard_required"
    assert payload["dashboard_url"] == "https://velocitybrain.vercel.app/dashboard/integrations?provider=github&from=integrations"
