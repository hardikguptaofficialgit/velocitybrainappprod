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
