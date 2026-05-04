# CLI Workflows

The CLI is the main control surface for VelocityBrain.

## Core commands

```bash
velocitybrain login --api-key vb_live_xxx
velocitybrain doctor
velocitybrain smoke
velocitybrain serve mcp
```

## Connect commands

Use these to generate client config:

```bash
velocitybrain connect codex
velocitybrain connect claude
velocitybrain connect hermes
velocitybrain connect openclaw
velocitybrain connect generic
```

Add `--apply` to write the config automatically when supported.

## Common workflow

```bash
velocitybrain login --api-key vb_live_xxx
velocitybrain doctor
velocitybrain connect codex --apply
velocitybrain smoke
```

## What each command does

- `login`: saves your API key locally
- `doctor`: checks local readiness
- `serve mcp`: starts the local MCP bridge
- `connect`: prints or writes client config
- `smoke`: runs a quick connectivity test

## Good practice

- Start with one client
- Keep MCP tool access narrow
- Verify with `doctor` before debugging the client
