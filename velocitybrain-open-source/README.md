# VelocityBrain Client

Open-source CLI, SDK, and MCP bridge for the hosted VelocityBrain coding-agent reuse API.

## What Is Public

This repository contains only the distribution layer:

- Python SDK
- hosted-only CLI
- MCP bridge
- integrations
- examples
- minimal docs

It does not contain the hosted reuse engine, ranking logic, savings logic, backend, or dashboard.

## Install

```bash
pip install velocitybrain-client
```

## Configure

```bash
export VELOCITYBRAIN_API_KEY="vb_live_xxx"
```

## CLI

```bash
velocitybrain run "Which files should I edit to change hosted auth safely?"
velocitybrain status
```

## Python

```python
from velocitybrain_client import VelocityBrainClient

with VelocityBrainClient(api_key="vb_live_xxx") as client:
    result = client.run("Map the hosted auth and API key flow in this repo.")
    print(result)
```

## MCP

```bash
velocitybrain-mcp
```

## API Surface

The public client only calls these hosted endpoints:

- `POST /v1/run`
- `GET /v1/usage`

## Development

```bash
pip install -e ".[dev]"
pytest
python scripts/check_public_boundary.py
```
