# Getting Started with VelocityBrain

## Installation

### From PyPI
```bash
pip install velocitybrain-client
```

### From Source
```bash
git clone https://github.com/velocitybrain/velocitybrain-client.git
cd velocitybrain-client
pip install -e .
```

## Configuration

Set your API key:

```bash
export VELOCITYBRAIN_API_KEY="your_api_key_here"
```

Or create a config file:
```bash
mkdir -p ~/.velocitybrain
echo '{"api_key": "your_api_key_here"}' > ~/.velocitybrain/config.json
```

## Quick Start

### CLI Usage
```bash
# Query your memory
velocitybrain query "What do I know about AI?"

# Ingest content
velocitybrain ingest --content "Important information"

# Run agent task
velocitybrain run "Summarize recent activities"
```

### Python SDK
```python
from src.client import VelocityBrainClient

with VelocityBrainClient(api_key="your_key") as client:
    result = client.query("What do I know about AI?")
    print(result["answer"])
```

### MCP Server
```bash
# Start MCP server
velocitybrain-mcp

# Configure with your AI assistant
# See integrations/ directory for examples
```

## Next Steps

- Browse available skills: `velocitybrain skills --list`
- Read the API documentation
- Join our community Discord
- Contribute skills on GitHub
