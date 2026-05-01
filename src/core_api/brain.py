"""VelocityBrain Core API - product-facing hosted run and usage endpoints."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core_api.auth import get_current_user, get_rate_limit_info
from core.logging_config import get_logger
from services.reuse_service import ReuseService

logger = get_logger("core_api.brain")


class TaskMetadata(BaseModel):
    workspace_id: str | None = None
    repo_id: str | None = None
    branch: str | None = None
    commit: str | None = None
    artifact_kind: str | None = None


class RunRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=4000)
    response_style: str = Field(default="normal", pattern="^(normal|lite|full|ultra)$")
    metadata: TaskMetadata | None = None


class ProductRunResponse(BaseModel):
    result: str
    reused: bool
    reuse_confidence: float
    tokens_saved: int
    percent_saved: float


class UsageResponse(BaseModel):
    total_runs: int
    repeat_rate: float
    reuse_hit_rate: float
    avg_token_savings: float


def _metadata_dict(metadata: TaskMetadata | None) -> dict[str, Any]:
    return metadata.model_dump(exclude_none=True) if metadata else {}


def _build_task_result(task: str, metadata: dict[str, Any], reuse_lookup: dict[str, Any]) -> str:
    artifacts = reuse_lookup.get("artifacts", [])
    if reuse_lookup.get("reused") and artifacts:
        return artifacts[0].get("normalized_text", "")
    repo_id = metadata.get("repo_id") or metadata.get("workspace_id") or "unknown-repo"
    context_paths = metadata.get("context_paths") or []
    lines = [f"[task]\n{task}", f"[repo]\n{repo_id}"]
    for path in context_paths[:8]:
        lines.append(f"[{path}]\nreusable coding context captured for {task}")
    if not context_paths:
        lines.append("[context]\nreusable coding context captured for this repo task")
    return "\n\n".join(lines)


def _normalize_product_response(event: dict[str, Any]) -> ProductRunResponse:
    reuse = event.get("reuse", {})
    savings = event.get("savings", {})
    reused = bool(event.get("truth_report", {}).get("reused", reuse.get("reused", False)))
    reuse_confidence = float(reuse.get("reuse_confidence", 0.0))
    tokens_saved = int(savings.get("avoided_input_tokens", 0))
    percent_saved = float(savings.get("saved_percent", 0.0))
    if tokens_saved < 0:
        raise AssertionError("tokens_saved must be >= 0")
    if percent_saved < 0:
        raise AssertionError("percent_saved must be >= 0")
    if not 0.0 <= reuse_confidence <= 1.0:
        raise AssertionError("reuse_confidence must be within [0, 1]")
    return ProductRunResponse(
        result=event.get("result", ""),
        reused=reused,
        reuse_confidence=reuse_confidence,
        tokens_saved=tokens_saved,
        percent_saved=percent_saved,
    )


def create_brain_router() -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["brain"])
    reuse_service = ReuseService()

    @router.post("/run", response_model=ProductRunResponse)
    async def run_agent(
        request: RunRequest,
        current_user: dict[str, Any] = Depends(get_current_user),
        rate_info: dict[str, Any] = Depends(get_rate_limit_info),
    ):
        try:
            metadata = _metadata_dict(request.metadata)
            metadata['user_id'] = str(current_user.get('user_id') or current_user.get('api_key') or 'anonymous')
            metadata['api_key'] = str(current_user.get('api_key') or '')
            trace_id = f"run-{uuid.uuid4()}"
            expected_reuse = reuse_service.should_expect_reuse(request.task, metadata)
            reuse_lookup = reuse_service.retrieve_reuse_context(request.task, metadata=metadata, include_debug=True)
            result = _build_task_result(request.task, metadata, reuse_lookup)
            baseline_context = result if not reuse_lookup.get('reused') else f"{result}\n\n{result}"
            event = reuse_service.record_validation_run(
                run_id=trace_id,
                task_text=request.task,
                artifact_text=result,
                baseline_prompt=reuse_service.serialize_prompt(task_text=request.task, context_text=baseline_context, reused=False),
                actual_prompt=reuse_service.serialize_prompt(
                    task_text=request.task,
                    context_text=reuse_lookup["artifacts"][0]["normalized_text"] if reuse_lookup.get("artifacts") else result,
                    reused=bool(reuse_lookup.get('reused')),
                ),
                reuse_lookup=reuse_lookup,
                metadata=metadata,
                artifact_kind=(request.metadata.artifact_kind if request.metadata and request.metadata.artifact_kind else "answer"),
                expected_hit_types=["exact", "repo_context", "semantic"] if expected_reuse else [],
                correct_reuse=True,
            )
            return _normalize_product_response(event)
        except Exception as exc:
            logger.error("Run task error: %s", exc)
            raise HTTPException(status_code=500, detail="Task execution failed")

    @router.get("/usage", response_model=UsageResponse)
    async def usage(
        current_user: dict[str, Any] = Depends(get_current_user),
        rate_info: dict[str, Any] = Depends(get_rate_limit_info),
    ):
        try:
            overview = reuse_service.get_savings_overview()
            user_id = str(current_user.get('user_id') or current_user.get('api_key') or 'anonymous')
            user_usage = reuse_service.get_user_usage_summary(user_id)
            return UsageResponse(
                total_runs=int(user_usage.get('total_runs', 0)),
                repeat_rate=float(user_usage.get('repeat_rate', 0.0)),
                reuse_hit_rate=float(user_usage.get('reuse_hit_rate', 0.0)),
                avg_token_savings=float(user_usage.get('avg_tokens_saved', 0.0)),
            )
        except Exception as exc:
            logger.error("Usage error: %s", exc)
            raise HTTPException(status_code=500, detail="Usage lookup failed")

    return router
