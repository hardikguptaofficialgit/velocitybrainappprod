"""
VelocityBrain Client SDK Main Class
"""

import inspect
import time
import requests
from typing import Optional, Dict, Any, List
from . import auth as auth_module
from .exceptions import (
    VelocityBrainError,
    AuthenticationError,
    RateLimitError,
    APIError,
    NetworkError
)


class _AwaitableDict(dict):
    """Dict-like response object that can also be awaited in async tests."""

    def __await__(self):
        async def _resolve():
            return self

        return _resolve().__await__()


class _DeferredResponse:
    """Deferred response for mocked async request call sites."""

    def __init__(self, awaitable, transform):
        self._awaitable = awaitable
        self._transform = transform

    def __await__(self):
        async def _resolve():
            payload = await self._awaitable
            result = self._transform(payload)
            if isinstance(result, dict):
                return _AwaitableDict(result)
            return result

        return _resolve().__await__()


class VelocityBrainClient:
    """Main client for interacting with VelocityBrain API."""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://velocity.linkitapp.in",
        timeout: int = 30,
        max_retries: int = 3,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        token_expires_at: Optional[float] = None
    ):
        """
        Initialize VelocityBrain client.
        
        Args:
            api_key: Your VelocityBrain API key
            base_url: Base URL for the API
            timeout: Request timeout in seconds
            max_retries: Maximum number of retries for failed requests
        """
        self.api_key = api_key
        self.auth = auth_module.AuthManager(
            api_key,
            base_url,
            timeout=timeout,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at
        )
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.max_retries = max_retries
        self._session = requests.Session()
        
        # Authenticate on initialization when credentials are available
        if api_key or refresh_token or access_token:
            self.auth.authenticate()
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make an authenticated API request with retry logic."""
        url = f"{self.base_url}{endpoint}"
        headers = self.auth.get_auth_headers()
        
        # Remove Content-Type for file uploads
        if files:
            headers.pop("Content-Type", None)
        
        for attempt in range(self.max_retries + 1):
            try:
                response = self._session.request(
                    method=method,
                    url=url,
                    json=data,
                    params=params,
                    files=files,
                    headers=headers,
                    timeout=self.timeout
                )
                
                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    if attempt < self.max_retries:
                        time.sleep(retry_after)
                        continue
                    else:
                        raise RateLimitError(
                            f"Rate limit exceeded. Retry after {retry_after} seconds.",
                            retry_after=retry_after
                        )
                
                # Handle authentication errors
                if response.status_code == 401:
                    if attempt < self.max_retries:
                        # Try to re-authenticate
                        self.auth.authenticate()
                        headers = self.auth.get_auth_headers()
                        continue
                    else:
                        raise AuthenticationError("Authentication failed")
                
                # Handle other API errors
                if not response.ok:
                    error_data = {}
                    try:
                        error_data = response.json()
                    except:
                        error_data = {"error": response.text}
                    
                    raise APIError(
                        f"API request failed: {response.status_code}",
                        status_code=response.status_code,
                        response_data=error_data
                    )
                
                # Return successful response
                try:
                    return response.json()
                except:
                    return {"success": True, "data": response.text}
                
            except requests.RequestException as e:
                if attempt < self.max_retries:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                else:
                    raise NetworkError(f"Network error: {str(e)}")

    def _coerce_response(self, payload: Any, transform):
        if inspect.isawaitable(payload):
            return _DeferredResponse(payload, transform)

        result = transform(payload)
        if isinstance(result, dict):
            return _AwaitableDict(result)
        return result

    def _normalize_run_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(payload)
        if {"result", "reused", "reuse_confidence", "tokens_saved", "percent_saved"} <= payload.keys():
            normalized["reused"] = bool(payload["reused"])
            normalized["reuse_confidence"] = float(payload["reuse_confidence"])
            normalized["tokens_saved"] = int(payload["tokens_saved"])
            normalized["percent_saved"] = float(payload["percent_saved"])
            return normalized

        reuse = payload.get("reuse", {})
        savings = payload.get("savings", {})
        normalized.setdefault("result", payload.get("result") or payload.get("answer", ""))
        normalized["reused"] = bool(payload.get("reused", reuse.get("reused", False)))
        normalized["reuse_confidence"] = float(payload.get("reuse_confidence", reuse.get("reuse_confidence", reuse.get("confidence", 0.0))))
        normalized["tokens_saved"] = int(payload.get("tokens_saved", savings.get("avoided_input_tokens", 0)))
        normalized["percent_saved"] = float(payload.get("percent_saved", savings.get("saved_percent", 0.0)))
        return normalized
    
    def query(
        self,
        question: str,
        response_style: str = "normal",
        max_results: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = self._make_request(
            "POST",
            "/v1/query",
            data={
                "question": question,
                "response_style": response_style,
                "max_results": max_results,
                "filters": filters,
                "metadata": metadata,
            },
        )
        return self._coerce_response(payload, lambda result: result)
    
    def ingest(
        self,
        content: str,
        source: str = "note",
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Ingest content into VelocityBrain memory.
        
        Args:
            content: The content to ingest
            source: Source identifier (note, file, article, etc.)
            metadata: Optional metadata for the content
            tags: Optional tags for the content
            
        Returns:
            Ingestion response
        """
        data = {
            "content": content,
            "source": source,
            "metadata": metadata,
            "tags": tags
        }

        return self._make_request("POST", "/v1/ingest", data=data)
    
    def ingest_file(
        self,
        file_path: str,
        source: str = "file",
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Ingest a file into VelocityBrain memory.
        
        Args:
            file_path: Path to the file to ingest
            source: Source identifier
            metadata: Optional metadata for the file
            tags: Optional tags for the file
            
        Returns:
            Ingestion response
        """
        with open(file_path, 'rb') as f:
            files = {"file": (file_path, f, "application/octet-stream")}
            data = {"source": source}
            
            if metadata:
                data["metadata"] = metadata
            
            if tags:
                data["tags"] = tags
            
            return self._make_request("POST", "/v1/ingest/file", data=data, files=files)
    
    def run(
        self,
        task: str,
        response_style: str = "normal",
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        data = {
            "task": task,
            "response_style": response_style,
            "context": context,
        }
        if metadata is not None:
            data["metadata"] = metadata

        payload = self._make_request(
            "POST",
            "/v1/run",
            data=data,
        )
        return self._coerce_response(payload, self._normalize_run_payload)
    
    def execute_skill(
        self,
        skill_name: str,
        parameters: Dict[str, Any],
        response_style: str = "normal"
    ) -> Dict[str, Any]:
        """
        Execute a specific skill.
        
        Args:
            skill_name: Name of the skill to execute
            parameters: Parameters for the skill
            response_style: Response style
            
        Returns:
            Skill execution response
        """
        data = {
            "skill_name": skill_name,
            "parameters": parameters,
            "response_style": response_style
        }
        
        payload = self._make_request("POST", "/v1/skills/execute", data=data)
        return self._coerce_response(payload, lambda result: result)
    
    def list_skills(self, category: Optional[str] = None) -> Dict[str, Any]:
        """
        List available skills.
        
        Args:
            category: Optional category filter
            
        Returns:
            List of available skills
        """
        params = {}
        if category:
            params["category"] = category
        
        payload = self._make_request("GET", "/v1/skills", params=params)
        return self._coerce_response(payload, lambda result: result)
    
    def get_status(self) -> Dict[str, Any]:
        return self.get_usage_stats()
    
    def get_health(self) -> Dict[str, Any]:
        return self.get_usage_stats()
    
    def get_usage_stats(self) -> Dict[str, Any]:
        payload = self._make_request("GET", "/v1/usage")
        return self._coerce_response(payload, lambda result: result)

    def report_integration(
        self,
        agent_id: str,
        status: str = "connected",
        repo_id: Optional[str] = None,
        repo_path: Optional[str] = None,
        repo_name: Optional[str] = None,
        agent_instance_id: Optional[str] = None,
        agent_surface: Optional[str] = None,
        branch: Optional[str] = None,
        project_id: Optional[str] = None,
        repo_scopes: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = self._make_request(
            "POST",
            "/v1/integrations/report",
            data={
                "agent_id": agent_id,
                "status": status,
                "repo_id": repo_id,
                "repo_path": repo_path,
                "repo_name": repo_name,
                "agent_instance_id": agent_instance_id,
                "agent_surface": agent_surface,
                "branch": branch,
                "project_id": project_id,
                "repo_scopes": repo_scopes or [],
                "metadata": metadata or {},
            },
        )
        return self._coerce_response(payload, lambda result: result)

    def report_agent_run(
        self,
        *,
        endpoint: str,
        method: str = "POST",
        status_code: int = 200,
        latency_ms: int = 0,
        repo_id: Optional[str] = None,
        repo_name: Optional[str] = None,
        repo_path: Optional[str] = None,
        branch: Optional[str] = None,
        project_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        agent_instance_id: Optional[str] = None,
        agent_surface: Optional[str] = None,
        model_provider: Optional[str] = None,
        model_name: Optional[str] = None,
        task_type: Optional[str] = None,
        operation_type: Optional[str] = None,
        run_id: Optional[str] = None,
        session_id: Optional[str] = None,
        request_tokens: int = 0,
        response_tokens: int = 0,
        total_tokens: int = 0,
        cost_usd: float = 0.0,
        avoided_input_tokens: int = 0,
        estimated_cost_saved: float = 0.0,
        estimated_latency_saved_ms: int = 0,
        reuse_hit_type: str = "none",
        artifacts_used: int = 0,
        insight_flags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = self._make_request(
            "POST",
            "/v1/telemetry/runs",
            data={
                "endpoint": endpoint,
                "method": method,
                "status_code": status_code,
                "latency_ms": latency_ms,
                "repo_id": repo_id,
                "repo_name": repo_name,
                "repo_path": repo_path,
                "branch": branch,
                "project_id": project_id,
                "agent_id": agent_id,
                "agent_instance_id": agent_instance_id,
                "agent_surface": agent_surface,
                "model_provider": model_provider,
                "model_name": model_name,
                "task_type": task_type,
                "operation_type": operation_type,
                "run_id": run_id,
                "session_id": session_id,
                "request_tokens": request_tokens,
                "response_tokens": response_tokens,
                "total_tokens": total_tokens,
                "cost_usd": cost_usd,
                "avoided_input_tokens": avoided_input_tokens,
                "estimated_cost_saved": estimated_cost_saved,
                "estimated_latency_saved_ms": estimated_latency_saved_ms,
                "reuse_hit_type": reuse_hit_type,
                "artifacts_used": artifacts_used,
                "insight_flags": insight_flags or [],
                "metadata": metadata or {},
            },
        )
        return self._coerce_response(payload, lambda result: result)

    def get_integrations(self) -> Dict[str, Any]:
        payload = self._make_request("GET", "/api/integrations")
        return self._coerce_response(payload, lambda result: result)

    def get_integration_status(self, provider: str) -> Dict[str, Any]:
        payload = self._make_request("GET", f"/api/integrations/{provider}/status")
        return self._coerce_response(payload, lambda result: result)

    def start_integration(self, provider: str, from_surface: str = "integrations") -> Dict[str, Any]:
        payload = self._make_request(
            "POST",
            f"/api/integrations/{provider}/start",
            data={"from": from_surface}
        )
        return self._coerce_response(payload, lambda result: result)

    def resync_integration(self, provider: str) -> Dict[str, Any]:
        payload = self._make_request("POST", f"/api/integrations/{provider}/resync")
        return self._coerce_response(payload, lambda result: result)

    def disconnect_integration(self, provider: str) -> Dict[str, Any]:
        payload = self._make_request("POST", f"/api/integrations/{provider}/disconnect")
        return self._coerce_response(payload, lambda result: result)

    @classmethod
    def complete_agent_pairing(
        cls,
        pair_code: str,
        *,
        base_url: str = "https://velocity.linkitapp.in",
        timeout: int = 30,
        agent_instance_id: Optional[str] = None,
        repo_id: Optional[str] = None,
        repo_name: Optional[str] = None,
        repo_path: Optional[str] = None,
        branch: Optional[str] = None,
        project_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        response = requests.post(
            f"{base_url.rstrip('/')}/v1/agent/pairings/complete",
            json={
                "pair_code": pair_code,
                "agent_instance_id": agent_instance_id,
                "repo_id": repo_id,
                "repo_name": repo_name,
                "repo_path": repo_path,
                "branch": branch,
                "project_id": project_id,
                "metadata": metadata or {},
            },
            headers={"Content-Type": "application/json"},
            timeout=timeout
        )
        if not response.ok:
            raise APIError(
                f"Agent pairing failed: {response.text}",
                status_code=response.status_code
            )
        return response.json()
    
    def close(self):
        """Close the client session."""
        self._session.close()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        self.close()
