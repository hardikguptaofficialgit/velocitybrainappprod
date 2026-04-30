# Agent Integrations

Velocity Brain is the shared memory layer behind the agent, not a replacement for the agent.

## Supported Pattern

- Claude Code
- OpenAI Codex
- Gemini CLI
- OpenClaw
- Cline
- other MCP-capable clients

Most clients point to the same runtime:

```powershell
velocitybrain serve mcp
```

OpenClaw can also use:

```powershell
velocitybrain openclaw
```

## What Should Happen Automatically

1. The user sends a normal prompt.
2. The client calls Velocity Brain in the background.
3. Velocity Brain retrieves the relevant repo or memory context.
4. The agent answers with a smaller, better-prepared context package.
5. Useful results can be written back for the next run.

## Product Promise

Users should not have to think about memory lookup.

They should be able to say:

- `fix auth`
- `review this feature`
- `prepare me for this repo`
- `map the API key system before refactoring it`

and expect Velocity Brain to run first.

## Why It Matters

- less repeated project setup
- better cross-session memory
- the same context layer across multiple agents
- smaller prompts reaching the model
