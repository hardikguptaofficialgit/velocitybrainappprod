# Agent Integrations

VelocityBrain is built to sit behind the agents people already use.

## Current integrations

### Codex

Best for repo-native workflows and coding tasks.

```bash
velocitybrain connect codex --apply
```

### Claude Code

Best for long-form reasoning and code assistance.

```bash
velocitybrain connect claude --apply
```

### Hermes

Best when you want an MCP-aware local agent setup with explicit config control.

```bash
velocitybrain connect hermes --apply
```

## Integration principle

VelocityBrain does not replace the model.

It gives the model:

- better continuity
- less repeated context loading
- reusable memory across sessions

## Best starting point

Pick one agent, verify it works, then expand.
