from velocitybrain_client.client.client import VelocityBrainClient


def test_public_client_exposes_hosted_endpoints_only():
    methods = {name for name in dir(VelocityBrainClient) if not name.startswith("_")}
    assert "run" in methods
    assert "query" not in methods
    assert "get_status" in methods
    assert "get_health" in methods
    assert "get_usage_stats" in methods
    assert "ingest" not in methods
    assert "execute_skill" not in methods
    assert "store_artifact" not in methods
    assert "retrieve_reuse_context" not in methods
    assert "record_reuse_decision" not in methods
