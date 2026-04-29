"""
VelocityBrain Skills Registry

Registry for managing and discovering skills.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Type
from .base import BaseSkill, SkillResult
from src.core.logging_config import get_logger

logger = get_logger("skills.registry")


class SkillRegistry:
    """Registry for managing VelocityBrain skills."""
    
    def __init__(self, skills_directory: Optional[str] = None):
        self.skills_directory = skills_directory or "skills"
        self._skills: Dict[str, BaseSkill] = {}
        self._skill_metadata: Dict[str, Dict[str, Any]] = {}
        self._load_skills()
    
    def _load_skills(self):
        """Load skills from directory and register them."""
        # Load Python skill classes
        self._load_python_skills()
        
        # Load JSON skill definitions
        self._load_json_skills()
        
        logger.info(f"Loaded {len(self._skills)} skills")
    
    def _load_python_skills(self):
        """Load skills from Python files."""
        skills_dir = Path(self.skills_directory)
        if not skills_dir.exists():
            return
        
        # Import skill classes dynamically
        for skill_file in skills_dir.rglob("*.py"):
            if skill_file.name.startswith("__"):
                continue
            
            try:
                # Import module and find skill classes
                module_name = str(skill_file.relative_to(skills_dir)).replace("/", ".").replace(".py", "")
                spec = __import__(f"skills.{module_name}", fromlist=["*"])
                
                for attr_name in dir(spec):
                    attr = getattr(spec, attr_name)
                    if (isinstance(attr, type) and 
                        issubclass(attr, BaseSkill) and 
                        attr != BaseSkill):
                        
                        skill_instance = attr()
                        self.register_skill(skill_instance)
                        
            except Exception as e:
                logger.warning(f"Failed to load skill from {skill_file}: {e}")
    
    def _load_json_skills(self):
        """Load skills from JSON definitions."""
        skills_dir = Path(self.skills_directory)
        if not skills_dir.exists():
            return
        
        for skill_file in skills_dir.rglob("*.json"):
            try:
                with open(skill_file, 'r') as f:
                    skill_data = json.load(f)
                
                # Create a generic JSON skill
                skill = JSONSkill(skill_data)
                self.register_skill(skill)
                
            except Exception as e:
                logger.warning(f"Failed to load JSON skill from {skill_file}: {e}")
    
    def register_skill(self, skill: BaseSkill):
        """Register a skill instance."""
        self._skills[skill.name] = skill
        self._skill_metadata[skill.name] = skill.get_skill_info()
        logger.debug(f"Registered skill: {skill.name}")
    
    def get_skill(self, name: str) -> Optional[BaseSkill]:
        """Get a skill by name."""
        return self._skills.get(name)
    
    def list_skills(
        self,
        category: Optional[str] = None,
        user_tier: str = "free"
    ) -> List[Dict[str, Any]]:
        """List available skills."""
        skills = []
        
        for skill_name, metadata in self._skill_metadata.items():
            # Filter by category
            if category and metadata.get("category") != category:
                continue
            
            # Filter by tier
            required_tier = metadata.get("required_tier", "free")
            if not self._is_tier_accessible(user_tier, required_tier):
                continue
            
            skills.append(metadata)
        
        return sorted(skills, key=lambda x: x["name"])
    
    def list_categories(self, user_tier: str = "free") -> List[str]:
        """List available categories for user tier."""
        categories = set()
        
        for metadata in self._skill_metadata.values():
            required_tier = metadata.get("required_tier", "free")
            if self._is_tier_accessible(user_tier, required_tier):
                categories.add(metadata.get("category", "general"))
        
        return sorted(list(categories))
    
    def is_skill_available(self, skill_name: str, user_tier: str = "free") -> bool:
        """Check if a skill is available for the user's tier."""
        skill = self.get_skill(skill_name)
        if not skill:
            return False
        
        required_tier = skill.required_tier
        return self._is_tier_accessible(user_tier, required_tier)
    
    def _is_tier_accessible(self, user_tier: str, required_tier: str) -> bool:
        """Check if user tier can access required tier."""
        tier_hierarchy = {
            "free": 0,
            "pro": 1,
            "enterprise": 2
        }
        
        user_level = tier_hierarchy.get(user_tier, 0)
        required_level = tier_hierarchy.get(required_tier, 0)
        
        return user_level >= required_level
    
    async def execute_skill(
        self,
        skill_name: str,
        parameters: Dict[str, Any],
        response_style: str = "normal",
        user_tier: str = "free"
    ) -> SkillResult:
        """Execute a skill."""
        skill = self.get_skill(skill_name)
        if not skill:
            return SkillResult(
                success=False,
                result={},
                message=f"Skill '{skill_name}' not found",
                execution_time=0.0
            )
        
        if not self.is_skill_available(skill_name, user_tier):
            return SkillResult(
                success=False,
                result={},
                message=f"Skill '{skill_name}' not available for {user_tier} tier",
                execution_time=0.0
            )
        
        try:
            # Validate parameters
            skill.validate_parameters(parameters)
            
            # Execute skill
            result = await skill.execute(
                parameters=parameters,
                response_style=response_style
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Skill execution error: {e}")
            return SkillResult(
                success=False,
                result={},
                message=f"Skill execution failed: {str(e)}",
                execution_time=0.0
            )
    
    def get_skill_info(self, skill_name: str) -> Optional[Dict[str, Any]]:
        """Get skill information."""
        return self._skill_metadata.get(skill_name)


class JSONSkill(BaseSkill):
    """Skill defined by JSON configuration."""
    
    def __init__(self, skill_data: Dict[str, Any]):
        super().__init__()
        self._skill_data = skill_data
        self._name = skill_data["name"]
        self._description = skill_data["description"]
        self._category = skill_data["category"]
        self._version = skill_data["version"]
        self._parameters_schema = skill_data["parameters"]
        self._required_tier = skill_data.get("required_tier", "free")
        self._tags = skill_data.get("tags", [])
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def description(self) -> str:
        return self._description
    
    @property
    def category(self) -> str:
        return self._category
    
    @property
    def version(self) -> str:
        return self._version
    
    @property
    def parameters_schema(self) -> Dict[str, Any]:
        return self._parameters_schema
    
    @property
    def required_tier(self) -> str:
        return self._required_tier
    
    @property
    def tags(self) -> List[str]:
        return self._tags
    
    async def execute(
        self,
        parameters: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
        response_style: str = "normal"
    ) -> SkillResult:
        """Execute JSON-based skill."""
        import time
        start_time = time.time()
        
        try:
            # For JSON skills, we'll simulate execution
            # In a real implementation, this would call the core API
            result_text = f"Executed {self.name} skill with parameters: {parameters}"
            
            # Format response based on style
            formatted_result = self.format_response(result_text, response_style)
            
            execution_time = time.time() - start_time
            
            return SkillResult(
                success=True,
                result={"output": formatted_result, "parameters": parameters},
                message=f"Skill '{self.name}' executed successfully",
                execution_time=execution_time,
                confidence=0.8
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            return SkillResult(
                success=False,
                result={},
                message=f"Skill execution failed: {str(e)}",
                execution_time=execution_time
            )
