#!/usr/bin/env python3
"""
VelocityBrain Open-Source Setup Script

This script sets up the complete open-source repository structure
and prepares everything for deployment.
"""

import os
import shutil
import json
from pathlib import Path
from typing import Dict, Any


def create_directory_structure():
    """Create the open-source repository directory structure."""
    
    print("🏗️  Creating open-source repository structure...")
    
    # Define the structure
    directories = [
        "velocitybrain-open-source",
        "velocitybrain-open-source/src",
        "velocitybrain-open-source/src/client",
        "velocitybrain-open-source/src/cli", 
        "velocitybrain-open-source/src/mcp",
        "velocitybrain-open-source/src/skills",
        "velocitybrain-open-source/src/skills/examples",
        "velocitybrain-open-source/examples",
        "velocitybrain-open-source/tests",
        "velocitybrain-open-source/docs",
        "velocitybrain-open-source/integrations",
        "velocitybrain-open-source/integrations/mcp",
        "velocitybrain-open-source/integrations/claude",
        "velocitybrain-open-source/integrations/openclaw",
        "velocitybrain-open-source/.github",
        "velocitybrain-open-source/.github/workflows",
        "velocitybrain-open-source/.github/ISSUE_TEMPLATE"
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"  ✓ Created {directory}")


def copy_client_sdk():
    """Copy the client SDK to open-source repository."""
    
    print("\n📦 Copying client SDK...")
    
    source_dir = Path("src/client")
    target_dir = Path("velocitybrain-open-source/src/client")
    
    if source_dir.exists():
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(source_dir, target_dir)
        print("  ✓ Client SDK copied")
    else:
        print("  ❌ Client SDK source not found")


def copy_cli_tools():
    """Copy CLI tools to open-source repository."""
    
    print("\n   Copying CLI tools...")
    
    source_dir = Path("src/cli")
    target_dir = Path("velocitybrain-open-source/src/cli")
    
    if source_dir.exists():
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(source_dir, target_dir)
        print("  ✓ CLI tools copied")
    else:
        print("  ❌ CLI tools source not found")


def copy_mcp_server():
    """Copy MCP server to open-source repository."""
    
    print("\n  Copying MCP server...")
    
    source_dir = Path("src/mcp")
    target_dir = Path("velocitybrain-open-source/src/mcp")
    
    if source_dir.exists():
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(source_dir, target_dir)
        print("  ✓ MCP server copied")
    else:
        print("  ❌ MCP server source not found")


def copy_skills_framework():
    """Copy skills framework to open-source repository."""
    
    print("\n🛠️  Copying skills framework...")
    
    source_dir = Path("src/skills")
    target_dir = Path("velocitybrain-open-source/src/skills")
    
    if source_dir.exists():
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(source_dir, target_dir)
        print("  ✓ Skills framework copied")
    else:
        print("  ❌ Skills framework source not found")


def copy_examples():
    """Copy examples to open-source repository."""
    
    print("\n  Copying examples...")
    
    source_dir = Path("examples")
    target_dir = Path("velocitybrain-open-source/examples")
    
    if source_dir.exists():
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(source_dir, target_dir)
        print("  ✓ Examples copied")
    else:
        print("  ❌ Examples source not found")


def copy_tests():
    """Copy tests to open-source repository."""
    
    print("\n  Copying tests...")
    
    source_dir = Path("tests")
    target_dir = Path("velocitybrain-open-source/tests")
    
    if source_dir.exists():
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(source_dir, target_dir)
        print("  ✓ Tests copied")
    else:
        print("  ❌ Tests source not found")


def create_configuration_files():
    """Create configuration files for open-source repository."""
    
    print("\n⚙️  Creating configuration files...")
    
    # Copy pyproject.toml
    if Path("pyproject-client.toml").exists():
        shutil.copy("pyproject-client.toml", "velocitybrain-open-source/pyproject.toml")
        print("  ✓ pyproject.toml created")
    
    # Copy requirements
    if Path("requirements-client.txt").exists():
        shutil.copy("requirements-client.txt", "velocitybrain-open-source/requirements.txt")
        print("  ✓ requirements.txt created")
    
    # Copy README
    if Path("README-OPEN-SOURCE.md").exists():
        shutil.copy("README-OPEN-SOURCE.md", "velocitybrain-open-source/README.md")
        print("  ✓ README.md created")


def create_github_workflows():
    """Create GitHub Actions workflows."""
    
    print("\n🔄 Creating GitHub workflows...")
    
    workflows_dir = Path("velocitybrain-open-source/.github/workflows")
    
    # CI/CD workflow
    ci_workflow = """name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.11, 3.12]

    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -e ".[dev]"
    
    - name: Lint with black
      run: |
        black --check src tests
    
    - name: Lint with isort
      run: |
        isort --check-only src tests
    
    - name: Type check with mypy
      run: |
        mypy src
    
    - name: Run tests
      run: |
        pytest --cov=src --cov-report=xml
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        flags: unittests
        name: codecov-umbrella

  publish:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: 3.11
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install build twine
    
    - name: Build package
      run: |
        python -m build
    
    - name: Publish to PyPI
      env:
        TWINE_USERNAME: __token__
        TWINE_PASSWORD: ${{ secrets.PYPI_API_TOKEN }}
      run: |
        twine upload dist/*
"""
    
    with open(workflows_dir / "ci.yml", "w") as f:
        f.write(ci_workflow)
    
    print("  ✓ GitHub workflows created")


def create_integration_configs():
    """Create integration configuration files."""
    
    print("\n🔗 Creating integration configs...")
    
    # MCP configuration
    mcp_config = {
        "mcpServers": {
            "velocitybrain": {
                "command": "velocitybrain-mcp",
                "args": []
            }
        }
    }
    
    mcp_dir = Path("velocitybrain-open-source/integrations/mcp")
    with open(mcp_dir / "mcpServers.velocitybrain.json", "w") as f:
        json.dump(mcp_config, f, indent=2)
    
    # Claude Code integration
    claude_script = """#!/bin/bash
# VelocityBrain Claude Code Integration Setup

echo "Setting up VelocityBrain for Claude Code..."

# Add MCP server
claude mcp add velocitybrain -- velocitybrain-mcp

echo "VelocityBrain added to Claude Code"
echo "You can now use VelocityBrain tools in Claude Code!"
"""
    
    claude_dir = Path("velocitybrain-open-source/integrations/claude")
    with open(claude_dir / "setup.sh", "w") as f:
        f.write(claude_script)
    
    # OpenClaw integration
    openclaw_config = {
        "mcpServers": {
            "velocitybrain": {
                "command": "velocitybrain-mcp",
                "args": []
            }
        }
    }
    
    openclaw_dir = Path("velocitybrain-open-source/integrations/openclaw")
    with open(openclaw_dir / "mcpServers.json", "w") as f:
        json.dump(openclaw_config, f, indent=2)
    
    print("  ✓ Integration configs created")


def create_documentation():
    """Create documentation files."""
    
    print("\n📖 Creating documentation...")
    
    docs_dir = Path("velocitybrain-open-source/docs")
    
    # Getting started guide
    getting_started = """# Getting Started with VelocityBrain

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
"""
    
    with open(docs_dir / "getting-started.md", "w") as f:
        f.write(getting_started)
    
    print("  ✓ Documentation created")


def create_contributing_guide():
    """Create contributing guidelines."""
    
    print("\n🤝 Creating contributing guide...")
    
    contributing = """# Contributing to VelocityBrain

We welcome contributions! This guide will help you get started.

## Development Setup

1. Fork the repository
2. Clone your fork
3. Create a virtual environment
4. Install dependencies: `pip install -e ".[dev]"`
5. Install pre-commit hooks: `pre-commit install`

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test
pytest tests/test_client.py
```

## Code Quality

- Use Black for formatting: `black src tests`
- Use isort for imports: `isort src tests`
- Use mypy for type checking: `mypy src`

## Contributing Skills

### Python Skills

Create a new skill class:

```python
from src.skills.base import BaseSkill, SkillResult

class MySkill(BaseSkill):
    @property
    def description(self) -> str:
        return "Description of my skill"
    
    @property
    def category(self) -> str:
        return "enrichment"
    
    @property
    def version(self) -> str:
        return "1.0.0"
    
    @property
    def parameters_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text to process"}
            },
            "required": ["text"]
        }
    
    async def execute(self, parameters, context=None, response_style="normal"):
        # Your skill logic here
        return SkillResult(
            success=True,
            result={"output": "processed text"},
            message="Skill executed successfully",
            execution_time=0.1
        )
```

### JSON Skills

Create a JSON skill definition:

```json
{
  "name": "my_skill",
  "description": "Description of my skill",
  "category": "enrichment",
  "version": "1.0.0",
  "parameters": {
    "type": "object",
    "properties": {
      "text": {"type": "string", "description": "Text to process"}
    },
    "required": ["text"]
  },
  "required_tier": "free"
}
```

## Submitting Changes

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Community

- Join our Discord server
- Participate in GitHub Discussions
- Report issues and feature requests
"""
    
    with open("velocitybrain-open-source/CONTRIBUTING.md", "w") as f:
        f.write(contributing)
    
    print("  ✓ Contributing guide created")


def create_license():
    """Create MIT license file."""
    
    print("\n📄 Creating MIT license...")
    
    license_text = """MIT License

Copyright (c) 2024 VelocityBrain

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
    
    with open("velocitybrain-open-source/LICENSE", "w") as f:
        f.write(license_text)
    
    print("  ✓ MIT license created")


def main():
    """Main setup function."""
    
    print("🚀 VelocityBrain Open-Source Setup")
    print("=" * 50)
    
    # Create directory structure
    create_directory_structure()
    
    # Copy source files
    copy_client_sdk()
    copy_cli_tools()
    copy_mcp_server()
    copy_skills_framework()
    copy_examples()
    copy_tests()
    
    # Create configuration files
    create_configuration_files()
    create_github_workflows()
    create_integration_configs()
    
    # Create documentation
    create_documentation()
    create_contributing_guide()
    create_license()
    
    print("\n🎉 Open-source repository setup complete!")
    print("\n📋 Next Steps:")
    print("1. Review the generated repository in 'velocitybrain-open-source/'")
    print("2. Test the installation and functionality")
    print("3. Create GitHub repository and push code")
    print("4. Set up PyPI publishing tokens")
    print("5. Publish to PyPI")
    print("6. Launch community platforms")
    print("7. Set up production core API infrastructure")
    
    print(f"\n📁 Repository location: {Path.cwd()}/velocitybrain-open-source")


if __name__ == "__main__":
    main()
