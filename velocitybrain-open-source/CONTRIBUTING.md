# Contributing to VelocityBrain

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
