"""
VelocityBrain Base Skill Class

Base class for creating VelocityBrain skills.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from datetime import datetime, UTC


class SkillResult(BaseModel):
    """Result of skill execution."""
    success: bool
    result: Dict[str, Any]
    message: str
    execution_time: float
    confidence: float = 0.0
    metadata: Optional[Dict[str, Any]] = None


class BaseSkill(ABC):
    """Base class for all VelocityBrain skills."""
    
    def __init__(self):
        self._name = self.__class__.__name__.lower().replace('skill', '')
        self.created_at = datetime.now(UTC)

    @property
    def name(self) -> str:
        """Stable skill name used by registries."""
        return self._name
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Description of what this skill does."""
        pass
    
    @property
    @abstractmethod
    def category(self) -> str:
        """Category of this skill (ingestion, execution, enrichment, etc.)."""
        pass
    
    @property
    @abstractmethod
    def version(self) -> str:
        """Version of this skill."""
        pass
    
    @property
    @abstractmethod
    def parameters_schema(self) -> Dict[str, Any]:
        """JSON schema for skill parameters."""
        pass
    
    @property
    def required_tier(self) -> str:
        """Minimum tier required to use this skill."""
        return "free"
    
    @property
    def tags(self) -> List[str]:
        """Tags for this skill."""
        return []
    
    @abstractmethod
    async def execute(
        self,
        parameters: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
        response_style: str = "normal"
    ) -> SkillResult:
        """
        Execute the skill with given parameters.
        
        Args:
            parameters: Skill parameters
            context: Optional execution context
            response_style: Response style (normal, lite, full, ultra)
            
        Returns:
            SkillResult with execution outcome
        """
        pass
    
    def validate_parameters(self, parameters: Dict[str, Any]) -> bool:
        """Validate skill parameters against schema."""
        # Basic validation - in production, use jsonschema
        required_params = self.parameters_schema.get("required", [])
        for param in required_params:
            if param not in parameters:
                raise ValueError(f"Required parameter missing: {param}")
        return True
    
    def get_skill_info(self) -> Dict[str, Any]:
        """Get skill information as dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "version": self.version,
            "parameters": self.parameters_schema,
            "required_tier": self.required_tier,
            "tags": self.tags,
            "created_at": self.created_at.isoformat()
        }
    
    async def _measure_execution(self, func, *args, **kwargs) -> tuple:
        """Measure execution time of a function."""
        import time
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            return result, execution_time
        except Exception as e:
            execution_time = time.time() - start_time
            raise e
    
    def format_response(
        self,
        content: str,
        response_style: str = "normal"
    ) -> str:
        """Format response based on style preference."""
        if response_style == "lite":
            # Very concise, bullet points only
            lines = content.split('\n')
            essential_lines = [line.strip() for line in lines if line.strip() and not line.startswith('#')]
            return '\n'.join(essential_lines[:3])  # First 3 essential lines
        
        elif response_style == "full":
            # Comprehensive with details
            return f"""
# {self.name.title()} Skill Result

## Execution Summary
{content}

## Additional Information
- Skill: {self.name}
- Category: {self.category}
- Version: {self.version}
- Executed at: {datetime.now(UTC).isoformat()}
"""
        
        elif response_style == "ultra":
            # Maximum detail with step-by-step breakdown
            return f"""
# Detailed Skill Execution Report

## Skill Information
- **Name**: {self.name}
- **Category**: {self.category}
- **Version**: {self.version}
- **Required Tier**: {self.required_tier}
- **Tags**: {', '.join(self.tags)}

## Execution Details
- **Timestamp**: {datetime.now(UTC).isoformat()}
- **Response Style**: {response_style}

## Results
{content}

## Metadata
- Skill Type: Community Contribution
- Execution Engine: VelocityBrain Core API
- Response Format: Ultra-detailed
"""
        
        else:  # normal
            return content
