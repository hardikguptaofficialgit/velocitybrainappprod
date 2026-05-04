# MCP Setup

VelocityBrain connects to agent clients through MCP.

The MCP server command is:

```bash
velocitybrain serve mcp
```

## Minimal MCP shape

```yaml
mcpServers:
  velocitybrain:
    command: velocitybrain
    args: ["serve", "mcp"]
```

## Supported clients

- Codex
- Claude Code
- Hermes
- OpenClaw
- Generic MCP clients

## Fastest way to configure

```bash
velocitybrain connect codex --apply
velocitybrain connect claude --apply
velocitybrain connect hermes --apply
```

## Why MCP matters

MCP gives the agent a structured way to:

- retrieve memory
- reuse prior context
- query saved knowledge
- run guarded workflows

## Troubleshooting

- Run `velocitybrain doctor`
- Confirm the client config points to `velocitybrain serve mcp`
- Reload MCP inside the client after config changes
