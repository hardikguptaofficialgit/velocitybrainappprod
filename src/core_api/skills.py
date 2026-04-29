"""
VelocityBrain Core API - Skills Management

Skills execution and management endpoints.
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from core_api.auth import get_current_user, get_rate_limit_info
from services.skill_registry import SkillRegistry
from core.logging_config import get_logger

logger = get_logger("core_api.skills")

# Models
class SkillExecutionRequest(BaseModel):
    skill_name: str = Field(..., min_length=1, max_length=100)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    response_style: str = Field(default="normal", pattern="^(normal|lite|full|ultra)$")

class SkillExecutionResponse(BaseModel):
    skill_name: str
    success: bool
    result: Dict[str, Any]
    execution_time: float
    message: str

class SkillInfo(BaseModel):
    name: str
    description: str
    category: str
    version: str
    parameters: Dict[str, Any]
    required_tier: str

class SkillsListResponse(BaseModel):
    skills: List[SkillInfo]
    total: int
    categories: List[str]

def create_skills_router() -> APIRouter:
    """Create skills management router."""
    router = APIRouter(prefix="/v1/skills", tags=["skills"])
    
    # Initialize skill registry
    skill_registry = SkillRegistry()
    
    @router.get("", response_model=SkillsListResponse)
    async def list_skills(
        category: Optional[str] = None,
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """List available skills for the user's tier."""
        try:
            logger.info(f"Skills list requested by {rate_info['tier']} user")
            
            # Get skills available for user's tier
            skills = skill_registry.list_skills(
                category=category,
                user_tier=rate_info["tier"]
            )
            
            # Get all categories
            categories = skill_registry.list_categories(user_tier=rate_info["tier"])
            
            skill_infos = []
            for skill in skills:
                skill_infos.append(SkillInfo(
                    name=skill["name"],
                    description=skill["description"],
                    category=skill["category"],
                    version=skill["version"],
                    parameters=skill["parameters"],
                    required_tier=skill.get("required_tier", "free")
                ))
            
            return SkillsListResponse(
                skills=skill_infos,
                total=len(skill_infos),
                categories=categories
            )
            
        except Exception as e:
            logger.error(f"Skills list error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to list skills")
    
    @router.post("/execute", response_model=SkillExecutionResponse)
    async def execute_skill(
        request: SkillExecutionRequest,
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """Execute a specific skill."""
        import time
        start_time = time.time()
        
        try:
            logger.info(f"Skill execution '{request.skill_name}' by {rate_info['tier']} user")
            
            # Check if skill is available for user's tier
            if not skill_registry.is_skill_available(request.skill_name, rate_info["tier"]):
                raise HTTPException(
                    status_code=403,
                    detail=f"Skill '{request.skill_name}' not available for {rate_info['tier']} tier"
                )
            
            # Execute skill
            result = skill_registry.execute_skill(
                skill_name=request.skill_name,
                parameters=request.parameters,
                response_style=request.response_style,
                user_tier=rate_info["tier"]
            )
            
            execution_time = time.time() - start_time
            
            return SkillExecutionResponse(
                skill_name=request.skill_name,
                success=result.get("success", True),
                result=result.get("result", {}),
                execution_time=execution_time,
                message=result.get("message", "Skill executed successfully")
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Skill execution error: {str(e)}")
            raise HTTPException(status_code=500, detail="Skill execution failed")
    
    @router.get("/{skill_name}", response_model=SkillInfo)
    async def get_skill_info(
        skill_name: str,
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """Get detailed information about a specific skill."""
        try:
            logger.info(f"Skill info requested: {skill_name} by {rate_info['tier']} user")
            
            # Check if skill is available for user's tier
            if not skill_registry.is_skill_available(skill_name, rate_info["tier"]):
                raise HTTPException(
                    status_code=404,
                    detail=f"Skill '{skill_name}' not found or not available for {rate_info['tier']} tier"
                )
            
            # Get skill details
            skill = skill_registry.get_skill_info(skill_name)
            
            return SkillInfo(
                name=skill["name"],
                description=skill["description"],
                category=skill["category"],
                version=skill["version"],
                parameters=skill["parameters"],
                required_tier=skill.get("required_tier", "free")
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Skill info error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get skill information")
    
    return router
