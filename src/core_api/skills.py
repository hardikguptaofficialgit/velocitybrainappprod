"""
VelocityBrain Core API - SDK/MCP-facing skill catalog.
"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.core.logging_config import get_logger
from src.services.skill_registry import SkillRegistry

from .auth import get_current_user, get_rate_limit_info

logger = get_logger("core_api.skills")


class SkillExecutionRequest(BaseModel):
    skill_name: str = Field(..., min_length=1, max_length=100)
    parameters: dict[str, Any] = Field(default_factory=dict)
    response_style: str = Field(default="normal", pattern="^(normal|lite|full|ultra)$")


class SkillExecutionResponse(BaseModel):
    skill_name: str
    success: bool
    result: dict[str, Any]
    execution_time: float
    message: str


class SkillsListResponse(BaseModel):
    skills: list[dict[str, Any]]
    total: int
    categories: list[str]


def create_skills_router() -> APIRouter:
    router = APIRouter(prefix="/v1/skills", tags=["skills"])
    skill_registry = SkillRegistry()

    @router.get("", response_model=SkillsListResponse)
    async def list_skills(
        category: str | None = None,
        current_user: dict[str, Any] = Depends(get_current_user),
        rate_info: dict[str, Any] = Depends(get_rate_limit_info),
    ):
        try:
            skills = skill_registry.list_skills()
            if category:
                skills = [skill for skill in skills if skill.get("category") == category]
            categories = sorted({skill.get("category", "uncategorized") for skill in skill_registry.list_skills()})
            return SkillsListResponse(skills=skills, total=len(skills), categories=categories)
        except Exception as exc:
            logger.error("Skills list error: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to list skills")

    @router.post("/execute", response_model=SkillExecutionResponse)
    async def execute_skill(
        request: SkillExecutionRequest,
        current_user: dict[str, Any] = Depends(get_current_user),
        rate_info: dict[str, Any] = Depends(get_rate_limit_info),
    ):
        start_time = time.time()
        try:
            skills = skill_registry.list_skills()
            skill = next((item for item in skills if item.get("name") == request.skill_name or item.get("skill_key") == request.skill_name), None)
            if not skill:
                raise HTTPException(status_code=404, detail=f"Skill '{request.skill_name}' not found")
            result = {
                "skill_key": skill.get("skill_key"),
                "category": skill.get("category"),
                "workflow": skill.get("workflow", []),
                "parameters": request.parameters,
                "response_style": request.response_style,
                "hosted_note": "Hosted VelocityBrain exposes the skill catalog through the SDK/MCP layer. Execution remains provider-controlled.",
            }
            return SkillExecutionResponse(
                skill_name=request.skill_name,
                success=True,
                result=result,
                execution_time=time.time() - start_time,
                message="Skill metadata returned for hosted SDK/MCP compatibility",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Skill execution error: %s", exc)
            raise HTTPException(status_code=500, detail="Skill execution failed")

    @router.get("/{skill_name}")
    async def get_skill_info(
        skill_name: str,
        current_user: dict[str, Any] = Depends(get_current_user),
        rate_info: dict[str, Any] = Depends(get_rate_limit_info),
    ):
        try:
            skills = skill_registry.list_skills()
            skill = next((item for item in skills if item.get("name") == skill_name or item.get("skill_key") == skill_name), None)
            if not skill:
                raise HTTPException(status_code=404, detail=f"Skill '{skill_name}' not found")
            return skill
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Skill info error: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to get skill information")

    return router
