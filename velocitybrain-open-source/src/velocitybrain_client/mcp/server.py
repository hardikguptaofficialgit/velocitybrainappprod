"""Hosted-only MCP bridge for VelocityBrain."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from velocitybrain_client.client import VelocityBrainClient
from velocitybrain_client.client.exceptions import VelocityBrainError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("velocitybrain_client.mcp")

server = Server("velocitybrain")
client: VelocityBrainClient | None = None


def get_client() -> VelocityBrainClient:
    global client
    if client is None:
        api_key = os.getenv("VELOCITYBRAIN_API_KEY")
        if not api_key:
            raise ValueError("VELOCITYBRAIN_API_KEY is required for the public MCP bridge.")
        client = VelocityBrainClient(api_key, os.getenv("VELOCITYBRAIN_BASE_URL", "https://velocity.linkitapp.in"))
    return client


def _tool_output(payload: dict[str, Any]) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps(payload, indent=2))]


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="run_agent",
            description="Run a hosted coding task through VelocityBrain and return reuse savings.",
            inputSchema={"type": "object", "properties": {"task": {"type": "string"}}, "required": ["task"]},
        ),
        Tool(
            name="usage",
            description="Return minimal hosted reuse metrics such as hit rate and average token savings.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    try:
        vb = get_client()
        if name == "run_agent":
            return _tool_output(vb.run(arguments["task"]))
        if name == "usage":
            return _tool_output(vb.get_usage_stats())
        raise ValueError(f"Unknown tool: {name}")
    except (VelocityBrainError, ValueError) as exc:
        logger.error("VelocityBrain MCP error (%s): %s", name, exc)
        return _tool_output({"error": str(exc)})


async def _async_main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(server_name="velocitybrain", server_version="1.0.0", capabilities={}),
        )


def main() -> None:
    asyncio.run(_async_main())
