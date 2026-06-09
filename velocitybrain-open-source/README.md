<p align="center">
  <img src="docs/velocity-brain-logo.svg" alt="Velocity Brain logo" width="96" />
</p>

# VelocityBrain Client

Open-source CLI, Python SDK, and MCP bridge for the hosted Velocity Brain API.

`velocitybrain-open-source` is the public distribution boundary for Velocity Brain. The main repository contains hosted backend and dashboard code as well, but this folder is the safe publishable client package: `velocitybrain-client`.

## What This Package Is

This package gives developers a clean way to talk to the hosted Velocity Brain service from scripts, terminals, and MCP-compatible clients.

It includes:

* a Python SDK for hosted API calls
* a `velocitybrain` CLI for running tasks and checking integration state
* a `velocitybrain-mcp` bridge for MCP-compatible tools
* examples and integration templates
* tests and a public/private boundary check

It does not include:

* hosted backend services
* dashboard code
* private ranking or reuse internals
* internal operational tooling
* local/self-hosted memory storage

## Package Surface

The public client is intentionally small and hosted-only.

### CLI commands

* `velocitybrain run <task>`
* `velocitybrain status`
* `velocitybrain integrations`
* `velocitybrain integrations-connect <provider>`
* `velocitybrain config --set-key <key>`

### Python client methods

* `run`
* `get_status`
* `get_health`
* `get_usage_stats`
* `get_integrations`
* `get_integration_status`
* `start_integration`
* `resync_integration`
* `disconnect_integration`

### MCP tools

* `run_agent`
* `usage`

## Installation

Install from PyPI:

```bash
pip install velocitybrain-client
```

## Quick Start

Create an API key in the Velocity Brain dashboard, then configure the client:

```bash
velocitybrain config --set-key vb_your_key_here
velocitybrain status
velocitybrain run "Summarize the repo context I should reuse before editing auth."
```

Or use the Python SDK:

```python
from velocitybrain_client import VelocityBrainClient

with VelocityBrainClient("vb_your_key_here") as client:
    print(client.get_health())
    print(client.run("Map the hosted API key flow."))
```

## Hosted API Notes

The SDK talks to the hosted API at `https://velocity.linkitapp.in` by default.
Browser OAuth integrations such as Slack, Google Workspace, and GitHub are connected from the dashboard because those flows require an interactive browser session. The SDK exposes integration status and returns dashboard guidance for browser-only connect/resync actions.
