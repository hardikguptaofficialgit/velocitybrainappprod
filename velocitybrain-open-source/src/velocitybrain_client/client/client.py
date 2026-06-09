"""Hosted-only VelocityBrain client."""

from __future__ import annotations

import time
from typing import Any

import requests

from .auth import AuthManager
from .exceptions import APIError, AuthenticationError, NetworkError, RateLimitError


class VelocityBrainClient:
    """Public client for the hosted VelocityBrain API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://velocity.linkitapp.in",
        dashboard_url: str = "https://velocitybrain.vercel.app",
        timeout: int = 30,
        max_retries: int = 3,
    ):
        self.base_url = base_url.rstrip("/")
        self.dashboard_url = dashboard_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.auth = AuthManager(api_key, self.base_url)
        self._session = requests.Session()
        self.auth.authenticate()

    def _make_request(
        self,
        method: str,
        endpoint: str,
        *,
        data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        authenticated: bool = True,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        headers = self.auth.get_auth_headers() if authenticated else {"Content-Type": "application/json"}
        for attempt in range(self.max_retries + 1):
            try:
                response = self._session.request(
                    method=method,
                    url=url,
                    json=data,
                    params=params,
                    headers=headers,
                    timeout=self.timeout,
                )
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    if attempt < self.max_retries:
                        time.sleep(retry_after)
                        continue
                    raise RateLimitError("VelocityBrain rate limit exceeded.", retry_after=retry_after)
                if response.status_code == 401:
                    if attempt < self.max_retries:
                        self.auth.authenticate()
                        headers = self.auth.get_auth_headers()
                        continue
                    raise AuthenticationError("VelocityBrain authentication failed.")
                if not response.ok:
                    try:
                        error_data = response.json()
                    except ValueError:
                        error_data = {"error": response.text}
                    raise APIError(
                        f"VelocityBrain API request failed: {response.status_code}",
                        status_code=response.status_code,
                        response_data=error_data,
                    )
                return response.json()
            except requests.RequestException as exc:
                if attempt < self.max_retries:
                    time.sleep(2**attempt)
                    continue
                raise NetworkError(f"VelocityBrain network error: {exc}") from exc

        raise NetworkError("VelocityBrain request failed without a response.")

    def _normalize_run_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        if {"result", "reused", "reuse_confidence", "tokens_saved", "percent_saved"} <= payload.keys():
            return {
                "result": payload["result"],
                "reused": bool(payload["reused"]),
                "reuse_confidence": float(payload["reuse_confidence"]),
                "tokens_saved": int(payload["tokens_saved"]),
                "percent_saved": float(payload["percent_saved"]),
            }
        reuse = payload.get("reuse", {})
        savings = payload.get("savings", {})
        return {
            "result": payload.get("result") or payload.get("answer", ""),
            "reused": bool(payload.get("reused", reuse.get("reused", False))),
            "reuse_confidence": float(payload.get("reuse_confidence", reuse.get("reuse_confidence", reuse.get("confidence", 0.0)))),
            "tokens_saved": int(payload.get("tokens_saved", savings.get("avoided_input_tokens", 0))),
            "percent_saved": float(payload.get("percent_saved", savings.get("saved_percent", 0.0))),
        }

    def run(
        self,
        task: str,
        *,
        response_style: str = "normal",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._normalize_run_payload(self._make_request(
            "POST",
            "/v1/run",
            data={
                "task": task,
                "response_style": response_style,
                "metadata": metadata,
            },
        ))

    def get_status(self) -> dict[str, Any]:
        health = self.get_health()
        usage = self.get_usage_stats()
        return {
            "status": health.get("status", "unknown"),
            "health": health,
            "usage": usage,
        }

    def get_health(self) -> dict[str, Any]:
        return self._make_request("GET", "/v1/health", authenticated=False)

    def get_usage_stats(self) -> dict[str, Any]:
        return self._make_request("GET", "/v1/usage")

    def get_integrations(self) -> dict[str, Any]:
        return self._make_request("GET", "/v1/integrations")

    def get_integration_status(self, provider: str) -> dict[str, Any]:
        integrations = self.get_integrations().get("integrations", [])
        for integration in integrations:
            identifiers = {
                str(integration.get("id", "")).lower(),
                str(integration.get("agent_id", "")).lower(),
                str(integration.get("provider", "")).lower(),
                str(integration.get("source_type", "")).lower(),
            }
            if provider.lower() in identifiers:
                return {"success": True, "provider": provider, "integration": integration}
        return {
            "success": True,
            "provider": provider,
            "integration": None,
            "status": "not_connected",
        }

    def start_integration(self, provider: str, *, from_surface: str = "integrations") -> dict[str, Any]:
        return {
            "success": False,
            "provider": provider,
            "status": "dashboard_required",
            "message": "Browser OAuth integrations must be connected from the VelocityBrain dashboard.",
            "dashboard_url": f"{self.dashboard_url}/dashboard/integrations?provider={provider}&from={from_surface}",
        }

    def resync_integration(self, provider: str) -> dict[str, Any]:
        return {
            "success": False,
            "provider": provider,
            "status": "dashboard_required",
            "message": "Integration resync is currently available from the VelocityBrain dashboard.",
            "dashboard_url": f"{self.dashboard_url}/dashboard/integrations?provider={provider}",
        }

    def disconnect_integration(self, provider: str) -> dict[str, Any]:
        status = self.get_integration_status(provider)
        integration = status.get("integration")
        connection_id = integration.get("id") if isinstance(integration, dict) else None
        if not connection_id:
            return {
                "success": True,
                "provider": provider,
                "status": "not_connected",
            }
        return self._make_request("POST", f"/v1/integrations/{connection_id}/revoke")

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "VelocityBrainClient":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
