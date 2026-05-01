import asyncio

from velocitybrain_client.mcp.server import handle_list_tools


def test_public_mcp_only_exposes_run_and_usage():
    tools = asyncio.run(handle_list_tools())
    names = {tool.name for tool in tools}
    assert names == {"run_agent", "usage"}
