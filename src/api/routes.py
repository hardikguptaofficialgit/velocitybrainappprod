import uuid
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone

from src.models.api import EvalQueryRequest
from src.services.compliance_service import ComplianceService
from src.services.evaluation_service import EvaluationService
from src.services.openclaw_profile import build_openclaw_profile
from src.services.runtime_status import build_runtime_status
from src.core.security import token_manager, rate_limiter, validator
from src.core.logging_config import get_logger, log_security_event, log_audit_event, log_error
from src.core.config import settings

router = APIRouter(prefix='/v1')
evaluation = EvaluationService()
compliance = ComplianceService()
logger = get_logger('api')
security = HTTPBearer(auto_error=False)

# Dependency for authentication
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    """Authenticate and authorize user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Validate token
    token = token_manager.validate_token(credentials.credentials)
    if not token or token.is_expired():
        log_security_event(
            "authentication_failed",
            "unknown",
            {"token": credentials.credentials[:20] + "..."},
            "WARNING"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    """Attach a user when a bearer token is present, but allow anonymous access."""
    if not credentials:
        return None

    token = token_manager.validate_token(credentials.credentials)
    if not token or token.is_expired():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token

# Dependency for rate limiting
async def check_rate_limit(client_ip: str = "127.0.0.1"):
    """Check rate limits."""
    if settings.rate_limit_enabled:
        if not rate_limiter.is_allowed(
            client_ip, 
            settings.rate_limit_requests_per_minute, 
            60
        ):
            log_security_event(
                "rate_limit_exceeded",
                client_ip,
                {"limit": settings.rate_limit_requests_per_minute},
                "WARNING"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )
    return True

@router.get('/healthz')
def healthz():
    """Health check endpoint."""
    try:
        return {
            'ok': True,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'version': '1.0.0',
            'service': settings.app_name
        }
    except Exception as exc:
        logger.error(f"Health check failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unavailable"
        )


@router.post('/eval/query')
def eval_query(
    payload: EvalQueryRequest,
    user: Any = Depends(get_current_user),
    _: Any = Depends(check_rate_limit)
):
    """Evaluate query with authentication and validation."""
    try:
        # Validate input
        if not payload.question or not payload.question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question cannot be empty"
            )
        
        # Sanitize question
        question = validator.validate_query_length(payload.question)
        question = validator.sanitize_sql_input(question)
        
        # Log audit event
        log_audit_event(
            "query_evaluated",
            user.actor,
            {
                "question": question[:100] + "..." if len(question) > 100 else question,
                "k": payload.k,
                "org_key": payload.org_key
            }
        )
        
        result = evaluation.eval_query(question, payload.expected_slugs, k=payload.k, org_key=payload.org_key)
        
        return {
            **result,
            'type_distribution': dict(result['type_distribution']),
            'trace_id': f'eval-{uuid.uuid4()}',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'user': user.actor
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        log_error(exc, {"operation": "eval_query", "user": user.actor})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get('/audit/recent')
def recent_audit(
    limit: int = 100,
    user: Any = Depends(get_optional_user),
    _: Any = Depends(check_rate_limit)
):
    """Get recent audit events with authentication."""
    try:
        # Validate limit
        if limit < 1 or limit > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limit must be between 1 and 1000"
            )
        
        # Check admin scope
        if user is not None and 'admin' not in user.scopes:
            log_security_event(
                "unauthorized_access_attempt",
                user.actor,
                {"endpoint": "/audit/recent", "scopes": user.scopes},
                "WARNING"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        result = compliance.recent_audit(limit=limit)
        
        return {
            **result,
            'trace_id': f'audit-{uuid.uuid4()}',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'user': user.actor if user is not None else 'anonymous'
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        log_error(exc, {"operation": "recent_audit", "user": user.actor})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get('/openclaw/profile')
def openclaw_profile():
    profile = build_openclaw_profile()
    return {
        **profile,
        'trace_id': f'openclaw-{uuid.uuid4()}',
    }


@router.get('/openclaw/capabilities')
def openclaw_capabilities():
    profile = build_openclaw_profile()
    capabilities = profile['capabilities']
    return {
        'name': profile['name'],
        'client': profile['client'],
        'tool_count': capabilities['tool_count'],
        'skill_count': capabilities['skill_count'],
        'skill_categories': capabilities['skill_categories'],
        'response_styles': capabilities.get('response_styles', ['normal']),
        'recommended_smoke_flow': profile['recommended_smoke_flow'],
        'trace_id': f'openclaw-{uuid.uuid4()}',
    }


@router.get('/runtime/status')
def runtime_status(audit_limit: int = 5):
    status = build_runtime_status(audit_limit=audit_limit)
    return {
        **status,
        'trace_id': f'status-{uuid.uuid4()}',
    }
