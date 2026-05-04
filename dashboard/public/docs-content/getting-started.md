# Getting Started

VelocityBrain is the memory and reuse layer for AI agents.

Use this guide if you want the fastest path from signup to a working connection.

## What you need

- A VelocityBrain account
- An API key from the dashboard
- A supported client such as Codex, Claude Code, or Hermes

## Quick setup

```bash
pip install velocitybrain
velocitybrain login --api-key vb_live_xxx
velocitybrain doctor
```

If `doctor` passes, your local setup is ready.

## Connect a client

Choose one client and apply the config automatically:

```bash
velocitybrain connect codex --apply
velocitybrain connect claude --apply
velocitybrain connect hermes --apply
```

This writes the MCP configuration for that client and points it to:

```bash
velocitybrain serve mcp
```

## Verify it works

Run:

```bash
velocitybrain smoke
```

Then open your client and ask it to use VelocityBrain memory on a simple repo task.

## Recommended flow

1. Sign in and create an API key.
2. Run `velocitybrain login`.
3. Run `velocitybrain doctor`.
4. Connect one client with `velocitybrain connect ... --apply`.
5. Test with `velocitybrain smoke`.

## When something breaks

- If login fails, check the API key.
- If MCP does not connect, rerun `velocitybrain doctor`.
- If your client does not see the server, reload its MCP config.
