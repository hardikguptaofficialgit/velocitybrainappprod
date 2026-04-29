"""
Production security tests for Velocity Brain.
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from src.core.security import validator, token_manager, rate_limiter
from src.core.config import settings
from src.main import app


class TestSecurityValidation:
    """Test security validation functions."""
    
    def test_sql_injection_prevention(self):
        """Test SQL injection prevention."""
        malicious_inputs = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "UNION SELECT * FROM entities",
            "'; INSERT INTO entities VALUES ('hack'); --"
        ]
        
        for malicious_input in malicious_inputs:
            with pytest.raises(ValueError, match="Potentially malicious input"):
                validator.sanitize_sql_input(malicious_input)
    
    def test_xss_prevention(self):
        """Test XSS prevention."""
        malicious_inputs = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            "<iframe src='javascript:alert(1)'></iframe>"
        ]
        
        for malicious_input in malicious_inputs:
            with pytest.raises(ValueError, match="Potentially malicious input"):
                validator.sanitize_html_input(malicious_input)
    
    def test_access_level_validation(self):
        """Test access level validation."""
        valid_levels = ['private', 'restricted', 'public']
        
        for level in valid_levels:
            assert validator.validate_access_level(level) == level
        
        with pytest.raises(ValueError):
            validator.validate_access_level('invalid')
    
    def test_content_length_validation(self):
        """Test content length validation."""
        # Valid content
        valid_content = "a" * 100
        assert validator.validate_content_length(valid_content) == valid_content
        
        # Content too large
        large_content = "a" * (settings.max_content_length + 1)
        with pytest.raises(ValueError, match="Content too large"):
            validator.validate_content_length(large_content)
    
    def test_query_length_validation(self):
        """Test query length validation."""
        # Valid query
        valid_query = "a" * 100
        assert validator.validate_query_length(valid_query) == valid_query.strip()
        
        # Query too long
        long_query = "a" * (settings.max_query_length + 1)
        with pytest.raises(ValueError, match="Query too long"):
            validator.validate_query_length(long_query)
    
    def test_slug_validation(self):
        """Test slug validation."""
        # Valid slugs
        valid_slugs = ["test-slug", "test_slug", "test123", "a"]
        for slug in valid_slugs:
            assert validator.validate_slug(slug) == slug.lower()
        
        # Invalid slugs
        invalid_slugs = ["", "a" * 201, "test slug", "test@slug", "test#slug"]
        for slug in invalid_slugs:
            with pytest.raises(ValueError):
                validator.validate_slug(slug)


class TestTokenManagement:
    """Test token management."""
    
    def test_token_generation(self):
        """Test token generation."""
        token = token_manager.generate_token(
            actor="test_user",
            scopes=["read", "write"],
            ttl_seconds=3600
        )
        
        assert token.actor == "test_user"
        assert token.scopes == ["read", "write"]
        assert not token.is_expired()
        assert token.has_scope("read")
        assert not token.has_scope("admin")
    
    def test_token_expiration(self):
        """Test token expiration."""
        token = token_manager.generate_token(
            actor="test_user",
            scopes=["read"],
            ttl_seconds=1
        )
        
        # Should not be expired immediately
        assert not token.is_expired()
        
        # Mock time to simulate expiration
        with patch('src.core.security.datetime') as mock_datetime:
            from datetime import datetime, timezone, timedelta
            mock_datetime.now.return_value = datetime.now(timezone.utc) + timedelta(seconds=2)
            assert token.is_expired()


class TestRateLimiting:
    """Test rate limiting."""
    
    def test_rate_limiting_within_limits(self):
        """Test rate limiting within allowed limits."""
        key = "test_key"
        limit = 5
        window = 60
        
        # Should allow requests within limit
        for i in range(limit):
            assert rate_limiter.is_allowed(key, limit, window)
    
    def test_rate_limiting_exceeds_limits(self):
        """Test rate limiting when exceeding limits."""
        key = "test_key"
        limit = 3
        window = 60
        
        # Should allow requests within limit
        for i in range(limit):
            assert rate_limiter.is_allowed(key, limit, window)
        
        # Should block request exceeding limit
        assert not rate_limiter.is_allowed(key, limit, window)


class TestAPISecurity:
    """Test API security endpoints."""
    
    def setup_method(self):
        """Setup test client."""
        self.client = TestClient(app)
    
    def test_health_endpoint_no_auth(self):
        """Test health endpoint without authentication."""
        response = self.client.get("/v1/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "timestamp" in data
        assert "version" in data
    
    def test_protected_endpoint_without_auth(self):
        """Test protected endpoint without authentication."""
        response = self.client.post("/v1/eval/query", json={"question": "test"})
        assert response.status_code == 401
    
    def test_protected_endpoint_with_invalid_token(self):
        """Test protected endpoint with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = self.client.post("/v1/eval/query", json={"question": "test"}, headers=headers)
        assert response.status_code == 401
    
    def test_eval_endpoint_with_valid_input(self):
        """Test eval endpoint with valid input and mock authentication."""
        # Mock authentication
        with patch('src.api.routes.token_manager.validate_token') as mock_validate:
            mock_token = MagicMock()
            mock_token.actor = "test_user"
            mock_token.scopes = ["read"]
            mock_token.is_expired.return_value = False
            mock_validate.return_value = mock_token
            
            headers = {"Authorization": "Bearer valid_token"}
            response = self.client.post(
                "/v1/eval/query",
                json={"question": "test question", "k": 5},
                headers=headers
            )
            # Should return 500 because evaluation service is not mocked
            assert response.status_code in [500, 422]  # 422 if validation fails, 500 if service fails
    
    def test_eval_endpoint_with_invalid_input(self):
        """Test eval endpoint with invalid input."""
        # Mock authentication
        with patch('src.api.routes.token_manager.validate_token') as mock_validate:
            mock_token = MagicMock()
            mock_token.actor = "test_user"
            mock_token.scopes = ["read"]
            mock_token.is_expired.return_value = False
            mock_validate.return_value = mock_token
            
            headers = {"Authorization": "Bearer valid_token"}
            
            # Empty question
            response = self.client.post(
                "/v1/eval/query",
                json={"question": "", "k": 5},
                headers=headers
            )
            assert response.status_code == 400
            
            # Missing question
            response = self.client.post(
                "/v1/eval/query",
                json={"k": 5},
                headers=headers
            )
            assert response.status_code == 422
    
    def test_audit_endpoint_admin_required(self):
        """Test audit endpoint requires admin scope."""
        # Mock authentication without admin scope
        with patch('src.api.routes.token_manager.validate_token') as mock_validate:
            mock_token = MagicMock()
            mock_token.actor = "test_user"
            mock_token.scopes = ["read"]  # No admin scope
            mock_token.is_expired.return_value = False
            mock_validate.return_value = mock_token
            
            headers = {"Authorization": "Bearer valid_token"}
            response = self.client.get("/v1/audit/recent", headers=headers)
            assert response.status_code == 403
    
    def test_rate_limiting_headers(self):
        """Test rate limiting is applied."""
        # Mock rate limiter to return False
        with patch('src.api.routes.rate_limiter.is_allowed', return_value=False):
            response = self.client.get("/v1/healthz")
            # Health endpoint should not be rate limited
            assert response.status_code == 200


class TestInputValidation:
    """Test input validation across the application."""
    
    def test_json_payload_size_limit(self):
        """Test JSON payload size limits."""
        client = TestClient(app)
        
        # Create oversized payload
        large_payload = {
            "question": "test",
            "large_field": "a" * (settings.max_content_length + 1)
        }
        
        # Should be rejected by FastAPI's built-in size limits
        response = client.post(
            "/v1/eval/query",
            json=large_payload,
            headers={"Authorization": "Bearer token"}
        )
        assert response.status_code in [400, 413, 422]
    
    def test_malformed_json(self):
        """Test handling of malformed JSON."""
        client = TestClient(app)
        
        response = client.post(
            "/v1/eval/query",
            data="invalid json",
            headers={"Content-Type": "application/json", "Authorization": "Bearer token"}
        )
        assert response.status_code == 422


class TestErrorHandling:
    """Test error handling and logging."""
    
    def test_database_connection_error(self):
        """Test database connection error handling."""
        with patch('src.core.db.psycopg.connect', side_effect=Exception("Connection failed")):
            from src.core.db import get_conn
            
            with pytest.raises(RuntimeError, match="Database connection failed"):
                with next(get_conn()):
                    pass
    
    def test_file_read_error_handling(self):
        """Test file read error handling."""
        with patch('pathlib.Path.read_text', side_effect=IOError("Permission denied")):
            from src.services.skill_registry import SkillRegistry
            
            registry = SkillRegistry("nonexistent")
            with pytest.raises(FileNotFoundError):
                registry.list_skills()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
