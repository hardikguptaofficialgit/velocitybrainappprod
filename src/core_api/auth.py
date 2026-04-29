"""
VelocityBrain Core API - Authentication

Handles API key authentication and token management for the core engine.
Integrates with Node.js backend for API key validation.
"""

import time
import jwt
import hashlib
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from core.config import settings
from core.logging_config import get_logger

logger = get_logger("core_api.auth")

# Security
security = HTTPBearer()

# Models
class AuthRequest(BaseModel):
    api_key: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int = 3600

class RefreshRequest(BaseModel):
    refresh_token: str

# In-memory token storage (in production, use Redis or database)
token_store = {}

# Backend API URL for validation
BACKEND_API_URL = settings.backend_api_url if hasattr(settings, 'backend_api_url') else os.getenv('BACKEND_API_URL', 'http://localhost:3001')

async def validate_api_key_with_backend(api_key: str) -> Dict[str, Any]:
    """Validate API key against Node.js backend."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f'{BACKEND_API_URL}/api/api-keys/validate',
                json={'apiKey': api_key}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    return {
                        'tier': data.get('tier', 'free'),
                        'rate_limit': data.get('dailyQuota', 100),
                        'user_id': data.get('userId')
                    }
            logger.warning(f"API key validation failed: {response.status_code}")
            return None
    except httpx.TimeoutException:
        logger.error("Backend API timeout during API key validation")
        return None
    except httpx.ConnectError:
        logger.error(f"Cannot connect to backend API at {BACKEND_API_URL}")
        return None
    except Exception as e:
        logger.error(f"Failed to validate API key with backend: {e}")
        return None

def create_auth_router() -> APIRouter:
    """Create authentication router."""
    router = APIRouter(prefix="/v1/auth", tags=["authentication"])
    
    @router.post("/authorize", response_model=AuthResponse)
    async def authorize(request: AuthRequest):
        """Authorize API key and return access token."""
        api_key = request.api_key
        
        # Validate API key against backend
        key_info = await validate_api_key_with_backend(api_key)
        
        if not key_info:
            logger.warning(f"Invalid API key attempted: {api_key[:8]}...")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
        
        # Generate tokens
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=1)
        
        access_payload = {
            "api_key": api_key,
            "tier": key_info["tier"],
            "rate_limit": key_info["rate_limit"],
            "user_id": key_info.get("user_id"),
            "type": "access",
            "exp": expires_at,
            "iat": now
        }
        
        refresh_payload = {
            "api_key": api_key,
            "type": "refresh", 
            "exp": now + timedelta(days=30),
            "iat": now
        }
        
        access_token = jwt.encode(
            access_payload,
            settings.secret_key or "default-secret",
            algorithm="HS256"
        )
        
        refresh_token = jwt.encode(
            refresh_payload,
            settings.secret_key or "default-secret",
            algorithm="HS256"
        )
        
        # Store tokens
        token_store[access_token] = {
            "api_key": api_key,
            "expires_at": expires_at.timestamp(),
            "tier": key_info["tier"]
        }
        
        logger.info(f"Authorized API key for tier: {key_info['tier']}")
        
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=3600
        )
    
    @router.post("/refresh", response_model=AuthResponse)
    async def refresh_token(request: RefreshRequest):
        """Refresh access token using refresh token."""
        refresh_token = request.refresh_token
        
        try:
            payload = jwt.decode(
                refresh_token,
                settings.secret_key or "default-secret",
                algorithms=["HS256"]
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        api_key = payload["api_key"]
        
        # Re-validate API key with backend
        key_info = await validate_api_key_with_backend(api_key)
        
        if not key_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key no longer valid"
            )
        
        # Generate new access token
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=1)
        
        access_payload = {
            "api_key": api_key,
            "tier": key_info["tier"],
            "rate_limit": key_info["rate_limit"],
            "user_id": key_info.get("user_id"),
            "type": "access",
            "exp": expires_at,
            "iat": now
        }
        
        access_token = jwt.encode(
            access_payload,
            settings.secret_key or "default-secret",
            algorithm="HS256"
        )
        
        # Store new token
        token_store[access_token] = {
            "api_key": api_key,
            "expires_at": expires_at.timestamp(),
            "tier": key_info["tier"]
        }
        
        return AuthResponse(
            access_token=access_token,
            expires_in=3600
        )
    
    return router

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current user from JWT token."""
    token = credentials.credentials
    
    # Check if token exists in store
    if token not in token_store:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    token_data = token_store[token]
    
    # Check if token expired
    if time.time() > token_data["expires_at"]:
        del token_store[token]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    
    return token_data

def get_rate_limit_info(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get rate limit information for current user."""
    return {
        "tier": user["tier"],
        "rate_limit": user["rate_limit"],
        "api_key": user["api_key"]
    }
