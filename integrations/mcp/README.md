# MCP Plugin Templates

This folder contains ready-to-use Velocity Brain MCP plugin templates for clients.

## Files

- `claude-code/mcpServers.velocitybrain.json`
- `codex/config.velocitybrain.toml`
- `openclaw/mcpServers.velocitybrain.json`

## One-command setup

Use the setup script to register plugins automatically.

### Claude Code

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client claude
```

### OpenClaw

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client openclaw
```

### Codex

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client codex
```

If your client cannot resolve `velocitybrain` on PATH, use absolute command resolution:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client claude -UseAbsoluteCommandPath
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client openclaw -UseAbsoluteCommandPath
```

## Verify both integrations

Run one command to verify:

- MCP server handshake and `healthz` tool call
- Claude registration (`claude mcp list`) when Claude CLI is installed
- Codex registration (`codex mcp list`) when Codex CLI is installed
- OpenClaw config entry for `velocitybrain`

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_mcp_integrations.ps1
```

If your OpenClaw config path is custom:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_mcp_integrations.ps1 -OpenClawConfigPath "C:/path/to/openclaw/mcp.json"
```

## Response Style Modes

Velocity Brain supports:

- `normal`
- `lite`
- `full`
- `ultra`

Use in MCP tool arguments as `response_style`.

## Codex auto-use behavior

Velocity Brain includes a root `AGENTS.md` file for Codex-style agents. Keep that file in the repo so Codex knows to use Velocity Brain automatically for entity and memory lookups without requiring the user to mention `velocitybrain` in the prompt.

Compression tool:

- `caveman_compress` with `file_path`, optional `response_style`, optional `write_backup`

## Benchmark

Run local token reduction benchmark on bundled prompt set:

```powershell
& ".venv-test/Scripts/python.exe" scripts/response_style_benchmark.py
```
