# VelocityBrain Client SDK

<p align="center">
  <img src="https://raw.githubusercontent.com/hardikguptaofficialgit/velocitybrain/2555e6ca7880bf9e1ab291d2253ac3b23b115e82/docs/assets/velocity-brain-logo.svg" alt="Velocity Brain logo" width="600" />
</p>

<p align="center">
  <strong>Open-Source Client for VelocityBrain AI Agent Memory & Execution Engine</strong><br/>
  CLI-native. MCP-ready. Production-hardened.
</p>

## Overview

VelocityBrain Client SDK is the open-source client for accessing the VelocityBrain proprietary core engine API. It provides a complete toolkit for integrating AI agent memory and execution capabilities into your applications.

## What's Included

- **  Python SDK**: Full-featured client library
- **  CLI Tools**: Command-line interface for quick operations
- **  MCP Server**: Model Context Protocol server integration
- **  Documentation**: Comprehensive guides and examples
- **  Tests**: Full test suite for reliability

## Core Features

###   **Memory Management**
- Query your AI agent's memory with natural language
- Ingest content from various sources (text, files, articles)
- Semantic search and retrieval with confidence scoring

###   **Agent Execution**
- Run complex agent tasks with context awareness
- Execute pre-built skills for common operations
- Configurable response styles (normal, lite, full, ultra)

###   **Integration Ready**
- MCP server for seamless AI assistant integration
- RESTful API client with retry logic
- Comprehensive error handling and logging

## Quick Start

### Installation

```bash
# Install from PyPI
pip install velocitybrain-client

# Or install from source
git clone https://github.com/velocitybrain/velocitybrain-client.git
cd velocitybrain-client
pip install -e .
```

### Configuration

Set up your API key:

```bash
# Option 1: Environment variable
export VELOCITYBRAIN_API_KEY="your_api_key_here"

# Option 2: Config file
mkdir -p ~/.velocitybrain
echo '{"api_key": "your_api_key_here"}' > ~/.velocitybrain/config.json
```

### CLI Usage

```bash
# Query your memory
velocitybrain query "What do I know about AI?"

# Ingest content
velocitybrain ingest --content "Meeting notes from today's standup"

# Ingest a file
velocitybrain ingest --file notes.txt --source meeting

# Run agent tasks
velocitybrain run "Prepare a summary of recent activities"

# List available skills
velocitybrain skills --list

# Execute a skill
velocitybrain skills --execute summarize --parameters '{"text": "Long document..."}'

# Check system health
velocitybrain status --health
```

### Python SDK Usage

```python
from src.client import VelocityBrainClient

# Initialize client
with VelocityBrainClient(api_key="your_api_key") as client:
    # Query memory
    result = client.query("What do I know about AI?")
    print(result["answer"])
    
    # Ingest content
    result = client.ingest(
        content="Important information to remember",
        source="note",
        tags=["important", "ai"]
    )
    
    # Run agent task
    result = client.run(
        task="Analyze this data and provide insights",
        response_style="full"
    )
    
    # Execute skill
    result = client.execute_skill(
        skill_name="summarize",
        parameters={"text": "Long document to summarize..."}
    )
```

### MCP Server Usage

Start the MCP server:

```bash
velocitybrain-mcp
```

Configure with your AI assistant (Claude, OpenAI Codex, etc.):

```json
{
  "mcpServers": {
    "velocitybrain": {
      "command": "velocitybrain-mcp",
      "args": []
    }
  }
}
```

## Available Tools

### Core Operations
- `query` - Search memory with natural language
- `ingest_text` - Add content to memory
- `run_agent` - Execute agent tasks
- `healthz` - Check system health

### Skills Management
- `list_skills` - Browse available skills
- `execute_skill` - Run specific skills

## Response Styles

Control the verbosity and format of responses:

- **normal** (default) - Balanced response
- **lite** - Concise, minimal response
- **full** - Detailed, comprehensive response  
- **ultra** - Maximum detail with full context

## API Tiers

VelocityBrain offers different tiers with varying capabilities:

| Tier | Features | Rate Limit |
|------|----------|------------|
| Free | Basic query, ingest, run | 100 requests/day |
| Pro | Advanced skills, higher limits | 10,000 requests/day |
| Enterprise | Unlimited, custom models | Unlimited |

Get your API key at [https://velocitybrain.ai](https://velocitybrain.ai)

## Development

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/velocitybrain/velocitybrain-client.git
cd velocitybrain-client

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install development dependencies
pip install -e ".[dev]"

# Install pre-commit hooks
pre-commit install
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test
pytest tests/test_client.py
```

### Code Quality

```bash
# Format code
black src tests
isort src tests

# Type checking
mypy src

# Linting
flake8 src tests
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Areas for Contribution

- **New Skills**: Create and contribute skills for the community
- **Integrations**: Add support for new AI assistants and platforms
- **Documentation**: Improve guides and examples
- **Bug Fixes**: Help us squash bugs and improve reliability

## Skills Framework

VelocityBrain uses a JSON-based skill framework. Skills are reusable workflows that can be executed by the agent.

### Skill Structure

```json
{
  "name": "summarize",
  "description": "Summarize text content",
  "category": "enrichment",
  "version": "1.0.0",
  "parameters": {
    "text": {
      "type": "string",
      "description": "Text to summarize",
      "required": true
    },
    "style": {
      "type": "string",
      "enum": ["brief", "detailed"],
      "default": "brief"
    }
  },
  "required_tier": "free"
}
```

### Contributing Skills

1. Create skill JSON file in `skills/` directory
2. Test with CLI: `velocitybrain skills --execute your_skill`
3. Submit pull request with description

## Support

- **Documentation**: [https://docs.velocitybrain.ai](https://docs.velocitybrain.ai)
- **Issues**: [GitHub Issues](https://github.com/velocitybrain/velocitybrain-client/issues)
- **Discussions**: [GitHub Discussions](https://github.com/velocitybrain/velocitybrain-client/discussions)
- **Email**: support@velocitybrain.ai

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

- [ ] JavaScript/TypeScript SDK
- [ ] Go SDK
- [ ] Rust SDK
- [ ] Web dashboard
- [ ] Advanced analytics
- [ ] Custom skill marketplace

---

**VelocityBrain Client SDK** - Your AI agent's memory, now open-source.

🚀 **Production-Ready** •   **Integration-Friendly** •   **Thoroughly-Tested** •   **Well-Documented**
