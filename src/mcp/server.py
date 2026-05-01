"""VelocityBrain MCP Server - product-facing run and usage tools only."""

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

from src.client import VelocityBrainClient
from src.client.exceptions import VelocityBrainError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("velocitybrain.mcp")

server = Server("velocitybrain")
client: VelocityBrainClient | None = None


def get_client() -> VelocityBrainClient:
    global client
    if client is None:
        api_key = os.getenv("VELOCITYBRAIN_API_KEY")
        if not api_key:
            raise ValueError("VELOCITYBRAIN_API_KEY environment variable is required")
        base_url = os.getenv("VELOCITYBRAIN_BASE_URL", "https://api.velocitybrain.ai")
        client = VelocityBrainClient(api_key, base_url)
        logger.info("VelocityBrain client initialized")
    return client


def _tool_output(payload: dict[str, Any]) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps(payload, indent=2))]


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="run_agent",
            description="Run a coding-agent task with hosted memory reuse and savings reporting.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task": {"type": "string", "description": "Task to execute"},
                    "response_style": {
                        "type": "string",
                        "enum": ["normal", "lite", "full", "ultra"],
                        "default": "normal",
                    },
                    "metadata": {"type": "object", "description": "Optional repo metadata"},
                },
                "required": ["task"],
            },
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
            return _tool_output(
                vb.run(
                    task=arguments["task"],
                    response_style=arguments.get("response_style", "normal"),
                    metadata=arguments.get("metadata"),
                )
            )
        if name == "usage":
            return _tool_output(vb.get_usage_stats())
        raise ValueError(f"Unknown tool: {name}")
    except (VelocityBrainError, ValueError) as exc:
        logger.error("VelocityBrain MCP error (%s): %s", name, exc)
        return _tool_output({"error": str(exc)})


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="velocitybrain",
                server_version="1.0.0",
                capabilities={"tools": {}},
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
