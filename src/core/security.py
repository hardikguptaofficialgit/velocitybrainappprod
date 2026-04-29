"""
Security utilities for input validation, sanitization, and authentication.
"""

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator


class SecurityConfig:
    """Security configuration constants."""
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB
    MAX_QUERY_LENGTH = 2000
    MAX_SLUG_LENGTH = 200
    ALLOWED_ACCESS_LEVELS = {'private', 'restricted', 'public'}
    TOKEN_SECRET_LENGTH = 32
    TOKEN_DEFAULT_TTL = 3600  # 1 hour
    
    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r'(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)',
        r'(--|#|\/\*|\*\/)',
        r'(\bOR\b.*\b1\s*=\s*1\b)',
        r'(\bAND\b.*\b1\s*=\s*1\b)',
        r'(\'\s*OR\s*\'.*\')',
        r'(\".*OR.*\")',
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe[^>]*>',
        r'<object[^>]*>',
        r'<embed[^>]*>',
    ]


class InputValidator:
    """Input validation and sanitization utilities."""
    
    @staticmethod
    def sanitize_sql_input(text: str) -> str:
        """Sanitize input to prevent SQL injection."""
        if not text:
            return ""
        
        # Remove null bytes
        text = text.replace('\x00', '')
        
        # Check for SQL injection patterns
        for pattern in SecurityConfig.SQL_INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                raise ValueError(f"Potentially malicious input detected: {pattern}")
        
        return text.strip()
    
    @staticmethod
    def sanitize_html_input(text: str) -> str:
        """Sanitize input to prevent XSS."""
        if not text:
            return ""
        
        # Remove null bytes
        text = text.replace('\x00', '')
        
        # Check for XSS patterns
        for pattern in SecurityConfig.XSS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                raise ValueError(f"Potentially malicious input detected: {pattern}")
        
        # Escape HTML special characters
        text = (text.replace('&', '&amp;')
                    .replace('<', '&lt;')
                    .replace('>', '&gt;')
                    .replace('"', '&quot;')
                    .replace("'", '&#x27;'))
        
        return text.strip()
    
    @staticmethod
    def validate_access_level(access_level: str) -> str:
        """Validate access level."""
        if access_level not in SecurityConfig.ALLOWED_ACCESS_LEVELS:
            raise ValueError(f"Invalid access level: {access_level}. Must be one of: {SecurityConfig.ALLOWED_ACCESS_LEVELS}")
        return access_level
    
    @staticmethod
    def validate_content_length(content: str, max_length: Optional[int] = None) -> str:
        """Validate content length."""
        max_len = max_length or SecurityConfig.MAX_CONTENT_LENGTH
        if len(content.encode('utf-8')) > max_len:
            raise ValueError(f"Content too large. Max size: {max_len} bytes")
        return content
    
    @staticmethod
    def validate_query_length(query: str) -> str:
        """Validate query length."""
        if len(query) > SecurityConfig.MAX_QUERY_LENGTH:
            raise ValueError(f"Query too long. Max length: {SecurityConfig.MAX_QUERY_LENGTH}")
        return query.strip()
    
    @staticmethod
    def validate_slug(slug: str) -> str:
        """Validate slug format."""
        if not slug:
            raise ValueError("Slug cannot be empty")
        
        if len(slug) > SecurityConfig.MAX_SLUG_LENGTH:
            raise ValueError(f"Slug too long. Max length: {SecurityConfig.MAX_SLUG_LENGTH}")
        
        # Only allow alphanumeric, hyphens, and underscores
        if not re.match(r'^[a-zA-Z0-9_-]+$', slug):
            raise ValueError("Slug can only contain alphanumeric characters, hyphens, and underscores")
        
        return slug.lower()


class SecureToken(BaseModel):
    """Secure token model for authentication."""
    token: str
    actor: str
    scopes: List[str]
    expires_at: datetime
    created_at: datetime = datetime.now(timezone.utc)
    
    @field_validator('token')
    @classmethod
    def validate_token_format(cls, v):
        if not v or len(v) < 32:
            raise ValueError('Token must be at least 32 characters long')
        return v
    
    @field_validator('scopes')
    @classmethod
    def validate_scopes(cls, v):
        allowed_scopes = {'read', 'write', 'admin', 'mcp'}
        invalid_scopes = set(v) - allowed_scopes
        if invalid_scopes:
            raise ValueError(f'Invalid scopes: {invalid_scopes}')
        return v
    
    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.now(timezone.utc) > self.expires_at
    
    def has_scope(self, scope: str) -> bool:
        """Check if token has specific scope."""
        return scope in self.scopes


class TokenManager:
    """Token management for authentication and authorization."""
    
    def __init__(self, secret_key: Optional[str] = None):
        self.secret_key = secret_key or secrets.token_bytes(SecurityConfig.TOKEN_SECRET_LENGTH)
    
    def generate_token(self, actor: str, scopes: List[str], ttl_seconds: int = SecurityConfig.TOKEN_DEFAULT_TTL) -> SecureToken:
        """Generate a secure token."""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        
        return SecureToken(
            token=token,
            actor=actor,
            scopes=scopes,
            expires_at=expires_at
        )
    
    def validate_token(self, token: str, required_scope: Optional[str] = None) -> Optional[SecureToken]:
        """Validate a token (placeholder for actual implementation)."""
        # In a real implementation, this would validate against a database or cache
        # For now, return None to indicate no valid token
        return None


class RateLimiter:
    """Simple rate limiter for API endpoints."""
    
    def __init__(self):
        self.requests: Dict[str, List[datetime]] = {}
    
    def is_allowed(self, key: str, limit: int = 100, window_seconds: int = 60) -> bool:
        """Check if request is allowed based on rate limit."""
        bucket_key = f"{key}:{limit}:{window_seconds}"
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=window_seconds)
        
        # Clean old requests
        if bucket_key in self.requests:
            self.requests[bucket_key] = [req_time for req_time in self.requests[bucket_key] if req_time > cutoff]
        else:
            self.requests[bucket_key] = []
        
        # Check limit
        if len(self.requests[bucket_key]) >= limit:
            return False
        
        # Add current request
        self.requests[bucket_key].append(now)
        return True


# Global instances
validator = InputValidator()
token_manager = TokenManager()
rate_limiter = RateLimiter()
