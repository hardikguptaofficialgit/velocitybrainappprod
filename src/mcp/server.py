"""VelocityBrain MCP Server - product-facing run and usage tools only."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
from typing import Any
from pathlib import Path

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
session_registered = False


def _load_saved_cloud_config() -> dict[str, Any]:
    config_path = Path.home() / ".velocitybrain" / "config.json"
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        logger.warning("Failed to read Velocity Brain config from %s", config_path)
        return {}


def _infer_agent_id(config: dict[str, Any] | None = None) -> str:
    config = config or _load_saved_cloud_config()
    return (
        os.getenv("VELOCITYBRAIN_AGENT_ID")
        or config.get("preferred_agent")
        or ((config.get("registered_agents") or [None])[0])
        or "mcp-client"
    )


def _detect_repo_context() -> dict[str, Any]:
    cwd = Path.cwd().resolve()
    current = cwd
    while True:
        if (current / ".git").exists() or (current / "AGENTS.md").exists() or (current / "identity.spec.json").exists():
            branch = ""
            try:
                branch = subprocess.run(
                    ["git", "-C", str(current), "rev-parse", "--abbrev-ref", "HEAD"],
                    capture_output=True,
                    text=True,
                    check=False,
                ).stdout.strip()
            except Exception:
                branch = ""
            return {
                "repo_id": current.name or "default-workspace",
                "repo_name": current.name or "default-workspace",
                "repo_path": str(current),
                "cwd": str(cwd),
                "project_id": current.name or "default-workspace",
                "branch": branch,
            }
        if current.parent == current:
            break
        current = current.parent
    return {
        "repo_id": cwd.name or "default-workspace",
        "repo_name": cwd.name or "default-workspace",
        "repo_path": str(cwd),
        "cwd": str(cwd),
        "project_id": cwd.name or "default-workspace",
        "branch": "",
    }


def _with_repo_metadata(metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    merged = dict(metadata or {})
    for key, value in _detect_repo_context().items():
        merged.setdefault(key, value)
    return merged


def _with_repo_filters(filters: dict[str, Any] | None = None) -> dict[str, Any]:
    merged = dict(filters or {})
    repo = _detect_repo_context()
    merged.setdefault("repo_id", repo["repo_id"])
    return merged


def _ensure_session_registration(vb: VelocityBrainClient) -> None:
    global session_registered
    if session_registered:
        return
    config = _load_saved_cloud_config()
    repo = _detect_repo_context()
    try:
        vb.report_integration(
            agent_id=_infer_agent_id(config),
            status="connected",
            repo_id=repo["repo_id"],
            repo_name=repo["repo_name"],
            repo_path=repo["repo_path"],
            agent_instance_id=f"{_infer_agent_id(config)}-{repo['repo_id']}",
            agent_surface="mcp",
            branch=repo.get("branch"),
            project_id=repo.get("project_id"),
            repo_scopes=[repo["repo_id"]],
            metadata={
                "source": "mcp_session",
                "cwd": repo["cwd"],
                "auto_reported": True,
            },
        )
        session_registered = True
    except Exception as exc:
        logger.warning("VelocityBrain MCP session registration failed: %s", exc)


def get_client() -> VelocityBrainClient:
    global client
    if client is None:
        config = _load_saved_cloud_config()
        api_key = os.getenv("VELOCITYBRAIN_API_KEY") or config.get("api_key")
        base_url = os.getenv("VELOCITYBRAIN_BASE_URL") or config.get("base_url") or "https://velocity.linkitapp.in"
        preferred_agent = _infer_agent_id(config)
        agent_credentials = (config.get("agent_credentials") or {}).get(preferred_agent) or {}
        if not api_key and not agent_credentials.get("refresh_token") and not agent_credentials.get("access_token"):
            raise ValueError(
                "VELOCITYBRAIN_API_KEY environment variable is required, or save a key with "
                "`velocitybrain login --api-key <key>` or pair an agent with `velocitybrain connect <client> --pair-code <code>`."
            )
        client = VelocityBrainClient(
            api_key=api_key,
            base_url=base_url,
            access_token=agent_credentials.get("access_token"),
            refresh_token=agent_credentials.get("refresh_token"),
            token_expires_at=agent_credentials.get("token_expires_at"),
        )
        logger.info("VelocityBrain client initialized")
    return client


def _tool_output(payload: dict[str, Any]) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps(payload, indent=2))]


def _infer_task_type(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in {"debug", "fix", "error", "bug"}):
        return "debugging"
    if any(token in lowered for token in {"refactor", "cleanup"}):
        return "refactoring"
    if any(token in lowered for token in {"generate", "create", "write"}):
        return "code_generation"
    if any(token in lowered for token in {"analy", "map", "inspect"}):
        return "analysis"
    return "coding_task"


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="healthz",
            description="Check whether the hosted Velocity Brain bridge is configured and reachable.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="query",
            description="Query Velocity Brain memory for people, projects, decisions, notes, or repo knowledge.",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "response_style": {
                        "type": "string",
                        "enum": ["normal", "lite", "full", "ultra"],
                        "default": "normal",
                    },
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["question"],
            },
        ),
        Tool(
            name="lookup_memory",
            description="Look up what Velocity Brain knows about a person, company, project, meeting, or topic.",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "response_style": {
                        "type": "string",
                        "enum": ["normal", "lite", "full", "ultra"],
                        "default": "normal",
                    },
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["question"],
            },
        ),
        Tool(
            name="ingest_text",
            description="Save durable project facts, decisions, notes, or meeting outcomes into Velocity Brain memory.",
            inputSchema={
                "type": "object",
                "properties": {
                    "source": {"type": "string", "default": "codex"},
                    "content": {"type": "string"},
                    "metadata": {"type": "object"},
                },
                "required": ["content"],
            },
        ),
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
        if name != "usage":
            _ensure_session_registration(vb)
        if name == "healthz":
            return _tool_output(vb.get_health())
        if name in {"query", "lookup_memory"}:
            question = arguments["question"]
            return _tool_output(
                vb.query(
                    question=question,
                    response_style=arguments.get("response_style", "normal"),
                    max_results=int(arguments.get("limit", 10)),
                    filters=_with_repo_filters(arguments.get("filters")),
                    metadata=_with_repo_metadata({
                        "task_type": "memory_lookup",
                        "operation_type": name,
                        "agent_surface": "mcp",
                    }),
                )
            )
        if name == "ingest_text":
            return _tool_output(
                vb.ingest(
                    content=arguments["content"],
                    source=arguments.get("source", _infer_agent_id(_load_saved_cloud_config())),
                    metadata=_with_repo_metadata({
                        **(arguments.get("metadata") or {}),
                        "task_type": "writeback",
                        "operation_type": "ingest",
                        "agent_surface": "mcp",
                    }),
                )
            )
        if name == "run_agent":
            task = arguments["task"]
            return _tool_output(
                vb.run(
                    task=task,
                    response_style=arguments.get("response_style", "normal"),
                    metadata=_with_repo_metadata({
                        **(arguments.get("metadata") or {}),
                        "task_type": _infer_task_type(task),
                        "operation_type": "run",
                        "agent_surface": "mcp",
                    }),
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
