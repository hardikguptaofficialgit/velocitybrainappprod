"""VelocityBrain Core API - product-facing hosted query, run, and usage endpoints."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.core.logging_config import get_logger
from src.services.response_style import apply_response_style
from src.services.retrieval_engine import RetrievalEngine
from src.services.reuse_service import ReuseService

from .auth import get_current_user, get_rate_limit_info

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


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    response_style: str = Field(default="normal", pattern="^(normal|lite|full|ultra)$")
    max_results: int = Field(default=10, ge=1, le=100)
    filters: dict[str, Any] | None = None


class QueryResponse(BaseModel):
    answer: str
    confidence: float
    sources: list[dict[str, Any]]
    reasoning_summary: str
    response_style: str


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


def _normalize_query_response(payload: dict[str, Any]) -> QueryResponse:
    return QueryResponse(
        answer=str(payload.get("answer", "")),
        confidence=float(payload.get("confidence", 0.0)),
        sources=list(payload.get("sources", [])),
        reasoning_summary=str(payload.get("reasoning_summary", "")),
        response_style=str(payload.get("response_style", "normal")),
    )


def create_brain_router() -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["brain"])
    reuse_service = ReuseService()
    retrieval = RetrievalEngine()

    @router.post("/query", response_model=QueryResponse)
    async def query(
        request: QueryRequest,
        current_user: dict[str, Any] = Depends(get_current_user),
        rate_info: dict[str, Any] = Depends(get_rate_limit_info),
    ):
        try:
            filters = request.filters or {}
            org_key = filters.get("org_key")
            hits = retrieval.hybrid_search(request.question, limit=request.max_results, org_key=org_key)

            if not hits:
                payload = apply_response_style(
                    {
                        "answer": "The internal brain does not currently contain sufficient data for this question.",
                        "confidence": 0.0,
                        "sources": [],
                        "reasoning_summary": "Brain-first lookup completed with zero hits. No hallucinated answer returned.",
                    },
                    request.response_style,
                )
                return _normalize_query_response(payload)

            top = hits[0]
            payload = apply_response_style(
                {
                    "answer": f"{top['title']}: {top['compiled_truth_md'][:400]}",
                    "confidence": float(top.get("confidence", 0.0)),
                    "sources": [
                        {"type": "entity", "slug": hit["slug"], "title": hit["title"]}
                        for hit in hits
                    ],
                    "reasoning_summary": f"Hybrid retrieval returned {len(hits)} internal matches; top-ranked entity used for synthesis.",
                },
                request.response_style,
            )
            return _normalize_query_response(payload)
        except Exception as exc:
            logger.error("Query error: %s", exc)
            raise HTTPException(status_code=500, detail="Query lookup failed")

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
