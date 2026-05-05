"""
Tests for VelocityBrain Client SDK
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from src.client import VelocityBrainClient
from src.client.exceptions import AuthenticationError, APIError, RateLimitError


class TestVelocityBrainClient:
    """Test cases for VelocityBrainClient."""
    
    @pytest.fixture
    def mock_client(self):
        """Create a mock client for testing."""
        with patch('src.client.auth.AuthManager') as mock_auth:
            mock_auth.return_value.authenticate.return_value = {"access_token": "test_token"}
            client = VelocityBrainClient("test_api_key", "https://test.api.com")
            return client
    
    @pytest.mark.asyncio
    async def test_client_initialization(self):
        """Test client initialization."""
        with patch('src.client.auth.AuthManager') as mock_auth:
            mock_auth.return_value.authenticate.return_value = {"access_token": "test_token"}
            
            client = VelocityBrainClient("test_api_key", "https://test.api.com")
            
            assert client.api_key == "test_api_key"
            assert client.base_url == "https://test.api.com"
            assert client.timeout == 30
            assert client.max_retries == 3
            mock_auth.return_value.authenticate.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_query_success(self, mock_client):
        """Test successful query."""
        mock_response = {
            "question": "What is AI?",
            "answer": "AI is artificial intelligence",
            "sources": [{"title": "AI Basics"}],
            "confidence": 0.95
        }
        
        with patch.object(mock_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            result = await mock_client.query("What is AI?")
            
            assert result["question"] == "What is AI?"
            assert result["answer"] == "AI is artificial intelligence"
            assert result["confidence"] == 0.95
            mock_request.assert_called_once_with(
                "POST", "/v1/query", 
                data={
                    "question": "What is AI?",
                    "response_style": "normal",
                    "max_results": 10,
                    "filters": None,
                    "metadata": None
                }
            )
    
    @pytest.mark.asyncio
    async def test_ingest_success(self, mock_client):
        """Test successful content ingestion."""
        mock_response = {
            "success": True,
            "document_id": "doc_123",
            "processing_time": 0.5,
            "message": "Content ingested successfully"
        }
        
        with patch.object(mock_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            result = await mock_client.ingest(
                content="Test content",
                source="note",
                tags=["test"]
            )
            
            assert result["success"] is True
            assert result["document_id"] == "doc_123"
            mock_request.assert_called_once_with(
                "POST", "/v1/ingest",
                data={
                    "content": "Test content",
                    "source": "note",
                    "metadata": None,
                    "tags": ["test"]
                }
            )
    
    @pytest.mark.asyncio
    async def test_run_success(self, mock_client):
        """Test successful task execution."""
        mock_response = {
            "task": "Summarize the document",
            "result": "Document summary here",
            "steps": [{"step": "analyze", "result": "success"}],
            "confidence": 0.88
        }
        
        with patch.object(mock_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            result = await mock_client.run(
                task="Summarize the document",
                response_style="full"
            )
            
            assert result["task"] == "Summarize the document"
            assert result["result"] == "Document summary here"
            assert result["confidence"] == 0.88
            mock_request.assert_called_once_with(
                "POST", "/v1/run",
                data={
                    "task": "Summarize the document",
                    "response_style": "full",
                    "context": None
                }
            )
    
    @pytest.mark.asyncio
    async def test_execute_skill_success(self, mock_client):
        """Test successful skill execution."""
        mock_response = {
            "skill_name": "summarize",
            "success": True,
            "result": {"summary": "Test summary"},
            "execution_time": 0.3
        }
        
        with patch.object(mock_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            result = await mock_client.execute_skill(
                skill_name="summarize",
                parameters={"text": "Long text..."},
                response_style="lite"
            )
            
            assert result["skill_name"] == "summarize"
            assert result["success"] is True
            assert result["result"]["summary"] == "Test summary"
            mock_request.assert_called_once_with(
                "POST", "/v1/skills/execute",
                data={
                    "skill_name": "summarize",
                    "parameters": {"text": "Long text..."},
                    "response_style": "lite"
                }
            )
    
    @pytest.mark.asyncio
    async def test_list_skills_success(self, mock_client):
        """Test successful skills listing."""
        mock_response = {
            "skills": [
                {
                    "name": "summarize",
                    "description": "Summarize text",
                    "category": "enrichment",
                    "required_tier": "free"
                }
            ],
            "total": 1,
            "categories": ["enrichment"]
        }
        
        with patch.object(mock_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            result = await mock_client.list_skills(category="enrichment")
            
            assert result["total"] == 1
            assert len(result["skills"]) == 1
            assert result["skills"][0]["name"] == "summarize"
            mock_request.assert_called_once_with(
                "GET", "/v1/skills",
                params={"category": "enrichment"}
            )
    
    @pytest.mark.asyncio
    async def test_authentication_error_handling(self, mock_client):
        """Test authentication error handling."""
        with patch.object(mock_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = AuthenticationError("Invalid API key")
            
            with pytest.raises(AuthenticationError):
                await mock_client.query("Test question")
    
    @pytest.mark.asyncio
    async def test_rate_limit_error_handling(self, mock_client):
        """Test rate limit error handling."""
        with patch.object(mock_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = RateLimitError("Rate limit exceeded", retry_after=60)
            
            with pytest.raises(RateLimitError) as exc_info:
                await mock_client.query("Test question")
            
            assert exc_info.value.retry_after == 60
    
    @pytest.mark.asyncio
    async def test_api_error_handling(self, mock_client):
        """Test API error handling."""
        with patch.object(mock_client, '_make_request', new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = APIError("API error", status_code=500)
            
            with pytest.raises(APIError) as exc_info:
                await mock_client.query("Test question")
            
            assert exc_info.value.status_code == 500

    def test_complete_agent_pairing_success(self):
        """Test successful browser-assisted agent pairing."""
        mock_response = Mock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "success": True,
            "agent_connection_id": "conn_123",
            "access_token": "agent_access",
            "refresh_token": "agent_refresh",
            "expires_in": 3600
        }

        with patch('src.client.client.requests.post', return_value=mock_response) as mock_post:
            result = VelocityBrainClient.complete_agent_pairing(
                "vbp_pair_code",
                base_url="https://test.api.com",
                agent_instance_id="codex-repo",
                repo_id="repo-x",
                repo_name="repo-x",
                repo_path="/tmp/repo-x",
                branch="main",
                project_id="repo-x",
                metadata={"paired_via": "test"}
            )

            assert result["agent_connection_id"] == "conn_123"
            mock_post.assert_called_once_with(
                "https://test.api.com/v1/agent/pairings/complete",
                json={
                    "pair_code": "vbp_pair_code",
                    "agent_instance_id": "codex-repo",
                    "repo_id": "repo-x",
                    "repo_name": "repo-x",
                    "repo_path": "/tmp/repo-x",
                    "branch": "main",
                    "project_id": "repo-x",
                    "metadata": {"paired_via": "test"},
                },
                headers={"Content-Type": "application/json"},
                timeout=30
            )
    
    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test client as context manager."""
        with patch('src.client.auth.AuthManager') as mock_auth:
            mock_auth.return_value.authenticate.return_value = {"access_token": "test_token"}
            
            async with VelocityBrainClient("test_api_key") as client:
                assert client is not None
                assert hasattr(client, 'close')
            
            # Verify session was closed
            mock_auth.return_value.authenticate.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
