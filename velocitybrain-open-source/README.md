# VelocityBrain Client

Open-source CLI, Python SDK, and MCP bridge for the hosted VelocityBrain API.

This folder exists as the **public distribution boundary** for Velocity Brain. The main repo contains private hosted product code too, but this package is the part that can be published safely as an open-source client.

## Scope

This package contains the public distribution layer only:

- Python client
- hosted CLI
- MCP bridge
- integration examples
- company integration bootstrap commands for Slack, Google Workspace, and GitHub

This package does not contain the hosted backend, ranking logic, reuse engine, dashboard, or private operational tooling.

## Why this package is separate

The main repository contains both:

- the hosted product codebase
- this open-source client package

Keeping this package in its own folder makes the public/private split explicit:

- public SDK and CLI code can be tested independently
- package publishing is simpler and safer
- import boundaries can be enforced
- hosted backend and dashboard internals stay out of the public client release

## Install

```bash
pip install velocitybrain-client
```

For local development:

```bash
pip install -e ".[dev]"
```

## Configure

Set your API key with an environment variable:

```bash
export VELOCITYBRAIN_API_KEY="vb_live_xxx"
```

Or save it with the CLI:

```bash
velocitybrain config --set-key vb_live_xxx
```

Optional:

```bash
velocitybrain config --set-key vb_live_xxx --base-url https://your-hosted-base-url
```

The default hosted base URL is `https://velocity.linkitapp.in`.

## CLI

The public CLI exposes these main commands:

- `velocitybrain run <task>`
- `velocitybrain status`
- `velocitybrain integrations`
- `velocitybrain integrations-connect <provider>`
- `velocitybrain config --set-key <key>`

Examples:

```bash
velocitybrain run "Which files should I edit to change hosted auth safely?"
velocitybrain run --json --response-style lite "Summarize the API key flow."
velocitybrain status
velocitybrain integrations
velocitybrain integrations-connect slack
```

`run` returns a normalized payload with:

- `result`
- `reused`
- `reuse_confidence`
- `tokens_saved`
- `percent_saved`

## Python SDK

```python
from velocitybrain_client import VelocityBrainClient

with VelocityBrainClient(api_key="vb_live_xxx") as client:
    result = client.run(
        "Map the hosted auth and API key flow in this repo.",
        response_style="lite",
    )
    print(result)

    usage = client.get_usage_stats()
    print(usage)

    integrations = client.get_integrations()
    print(integrations)
```

## MCP Bridge

Start the MCP bridge:

```bash
velocitybrain-mcp
```

The public MCP bridge exposes two tools:

- `run_agent`
- `usage`

It requires `VELOCITYBRAIN_API_KEY` to be set in the environment before launch.

Example config files are available in:

- `integrations/mcp/mcpServers.velocitybrain.json`
- `integrations/openclaw/mcpServers.json`
- `integrations/hermes/config.velocitybrain.yaml`
- `integrations/claude/setup.sh`

## Hosted API Surface

The public client is limited to these hosted endpoint families:

- `POST /v1/run`
- `GET /v1/usage`
- `GET /api/integrations`
- `GET /api/integrations/:provider/status`
- `POST /api/integrations/:provider/start`
- `POST /api/integrations/:provider/resync`
- `POST /api/integrations/:provider/disconnect`

## Development Checks

Run the public package checks before release:

```bash
pytest
python scripts/check_public_boundary.py
python -m build
```

The boundary check ensures the public package does not import private runtime modules from the main product codebase.
