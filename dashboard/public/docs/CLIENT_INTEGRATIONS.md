# Client Integrations Guide

This guide shows how to connect Velocity Brain to MCP-capable clients and how to verify the connection reliably.

## Integration Model

- Velocity Brain runs as an MCP server process.
- Your client runtime (Claude Code, Codex CLI, Gemini CLI, Cline, OpenClaw) is the MCP client.
- The client launches `velocitybrain serve mcp` and calls tools like `query`, `ingest_text`, and `run_agent`.

## Prerequisites

1. Activate the project virtual environment.
2. Ensure DB is running if you want memory-backed query and run behavior.
3. Ensure `velocitybrain about` and `velocitybrain doctor` succeed.

## MCP Server Command

Preferred command:

```powershell
velocitybrain serve mcp
```

If `velocitybrain` is not on PATH, use the full executable path:

```powershell
C:/Path/To/venv/Scripts/velocitybrain.exe serve mcp
```

## Claude Code CLI

### One-command setup

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client claude
```

### Add server

```powershell
claude mcp add velocitybrain -- velocitybrain serve mcp
```

If path spaces cause parsing issues on Windows, add through a wrapper script that launches the same command.

### Verify

```powershell
claude mcp list
```

Expected: `velocitybrain` should be connected.

### Smoke prompts

- Use velocitybrain `healthz` and show raw result.
- Query velocitybrain for "What do we know about auth and API keys in this repo?"
- Run agent for "Prepare me to review the large codebase before refactoring auth"

## OpenAI Codex CLI

### Add server

```powershell
codex mcp add velocitybrain -- velocitybrain serve mcp
```

### Verify

Use Codex MCP listing command in your installed version, then run a tool call prompt against `query`.

## Gemini CLI

Use Gemini CLI MCP config and register the same server command:

```json
{
  "mcpServers": {
    "velocitybrain": {
      "command": "velocitybrain",
      "args": ["serve", "mcp"]
    }
  }
}
```

## Cline

Add Velocity Brain in Cline MCP settings with the same stdio command.

## OpenClaw

OpenClaw can use Velocity Brain through the same MCP stdio configuration.

### One-command setup

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client openclaw
```

Default OpenClaw output path:

- `~/.openclaw/mcp.json`

Velocity Brain also ships a ready-made OpenClaw profile export:

```powershell
velocitybrain openclaw
```

This prints a ready-to-use MCP server profile, capability summary, and the recommended smoke flow.

Use this server entry in the OpenClaw MCP settings file:

```json
{
  "mcpServers": {
    "velocitybrain": {
      "command": "velocitybrain",
      "args": ["serve", "mcp"]
    }
  }
}
```

If OpenClaw runs in a different shell context, set `command` to the absolute executable path.

Absolute command setup for either client:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client claude -UseAbsoluteCommandPath
```

Recommended OpenClaw smoke flow:

1. Call `healthz` and verify `{ "ok": true }`.
2. Call `list_skills` and verify a non-zero `count`.
3. Call `query` with a known entity.
4. Call `run_agent` with a planning signal.

To enable terse/caveman responses in OpenClaw (or any MCP client), pass `response_style` in tool arguments:

- `normal` (default)
- `lite` (concise)
- `full` (max compression)
- `ultra` (maximum compression)

Example:

```json
{
  "name": "query",
  "arguments": {
    "question": "What do we know about auth and API keys in this repo?",
    "response_style": "full"
  }
}
```

OpenClaw can also discover the same data through the API:

- `GET /v1/openclaw/profile`
- `GET /v1/openclaw/capabilities`

The guide app at `https://velocitybrain.vercel.app/guide` surfaces these integration checks in the sidebar:

- OpenClaw command, tool count, skill count, and smoke flow
- Recent audit event snapshot
- Core API online/offline status

## Production-Safe MCP Defaults

Use these defaults when integrating any client, including OpenClaw:

- Keep `MCP_ALLOW_DESTRUCTIVE_TOOLS=false` until explicitly needed.
- Start with read-only and non-mutating tool usage (`query`, `list_skills`, `healthz`).
- Enable destructive tools only for controlled maintenance windows.
- Pair tool access with runtime identity and policy checks.

## Plugin Notes

Velocity Brain itself already acts as the MCP plugin/tool provider. In client UIs, it appears under MCP/Plugins/Tools depending on the client terminology.

## Available MCP Tools

- `ingest_text`
- `query`
- `run_agent`
- `sync_brain` (policy gated)
- `put_page` (policy gated)
- `delete_page` (policy gated)
- `google_workspace_action`
- `get_identity_spec`
- `list_skills`
- `healthz`

## Troubleshooting

### Failed to connect

- Confirm command works directly in terminal.
- Confirm the client uses the same executable and venv.
- Reinstall editable package if repo path changed:

```powershell
python -m pip install -e .
```

### Query says DB unavailable

- Start Postgres:

```powershell
docker compose up db -d
```

- Load schema:

```powershell
docker compose exec -T db psql -U velocity -d velocitybrain -f /docker-entrypoint-initdb.d/01-schema.sql
```

- Recheck:

```powershell
velocitybrain doctor
```

### Destructive tool blocked

This is expected by default. Enable policy only when needed using runtime approval and env policy settings.

## Recommended Validation Flow

1. `velocitybrain doctor`
2. `velocitybrain ingest --source note --content "Auth uses Firebase on the frontend and backend session sync through /api/auth/firebase-session."`
3. `velocitybrain query "What do we know about auth and API keys in this repo?"`
4. Client MCP `healthz` call
5. Client MCP `query` call

## Automated Plugin Verification

Run a single verifier for Claude Code and OpenClaw integration checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_mcp_integrations.ps1
```

This validates:

- MCP protocol initialize + `tools/list`
- MCP `healthz` tool call
- Claude registration if Claude CLI is installed
- OpenClaw config entry presence

## Caveman Context Compression

Use `caveman_compress` (MCP) or `velocitybrain caveman-compress` (CLI) to compress markdown context files while preserving:

- headings
- fenced code blocks
- URLs
- file paths
- command lines

CLI example:

```powershell
velocitybrain caveman-compress docs/CLIENT_INTEGRATIONS.md
```

By default, a backup file is created at `<filename>.original.md`.

## Claude Mode Persistence (Optional)

Install Claude hooks for SessionStart activation and prompt-level mode tracking:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install_claude_caveman_hooks.ps1
```

Hook files are under `integrations/claude/hooks`.

## Go-Live Checklist

1. Pin the Python environment used by your MCP client.
2. Verify database readiness before starting MCP.
3. Validate policy gates for destructive tools.
4. Capture one full tool-call trace for auditability.
5. Monitor first-run latency for `query` and `run_agent`.
