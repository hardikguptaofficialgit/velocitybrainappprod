from pathlib import Path

from src.mcp import server as mcp_server


def test_load_saved_cloud_config_returns_empty_when_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)

    assert mcp_server._load_saved_cloud_config() == {}


def test_get_client_uses_saved_cli_config_when_env_missing(tmp_path, monkeypatch):
    config_dir = tmp_path / ".velocitybrain"
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / "config.json").write_text(
        '{"api_key": "vb_saved_key", "base_url": "https://saved.example.com"}',
        encoding="utf-8",
    )
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.delenv("VELOCITYBRAIN_API_KEY", raising=False)
    monkeypatch.delenv("VELOCITYBRAIN_BASE_URL", raising=False)
    monkeypatch.setattr(mcp_server, "client", None)

    captured = {}

    class DummyClient:
        def __init__(self, api_key, base_url):
            captured["api_key"] = api_key
            captured["base_url"] = base_url

    monkeypatch.setattr(mcp_server, "VelocityBrainClient", DummyClient)

    client = mcp_server.get_client()

    assert isinstance(client, DummyClient)
    assert captured == {"api_key": "vb_saved_key", "base_url": "https://saved.example.com"}


def test_infer_agent_id_prefers_saved_registered_agent():
    assert mcp_server._infer_agent_id({"preferred_agent": "codex"}) == "codex"


def test_with_repo_metadata_adds_repo_fields(tmp_path, monkeypatch):
    repo = tmp_path / "repo-a"
    repo.mkdir(parents=True, exist_ok=True)
    (repo / "AGENTS.md").write_text("test", encoding="utf-8")
    monkeypatch.chdir(repo)

    payload = mcp_server._with_repo_metadata({"source": "manual"})

    assert payload["source"] == "manual"
    assert payload["repo_id"] == "repo-a"
    assert payload["repo_name"] == "repo-a"
    assert payload["repo_path"] == str(repo)
