"""Hosted authentication helper for the public client."""

from __future__ import annotations

import time
from typing import Any

import requests

from .exceptions import APIError, AuthenticationError


class AuthManager:
    """Manages hosted API authentication tokens for the public client."""

    def __init__(self, api_key: str, base_url: str = "https://velocity.linkitapp.in"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._access_token: str | None = None
        self._refresh_token: str | None = None
        self._token_expires_at: float | None = None

    def authenticate(self) -> dict[str, Any]:
        response = requests.post(
            f"{self.base_url}/v1/auth/authorize",
            json={"api_key": self.api_key},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        if response.status_code == 401:
            raise AuthenticationError("Invalid VelocityBrain API key.")
        if response.status_code == 429:
            raise AuthenticationError("VelocityBrain authentication rate limit exceeded.")
        if not response.ok:
            raise APIError(
                f"VelocityBrain authentication failed: {response.text}",
                status_code=response.status_code,
            )

        data = response.json()
        self._access_token = data["access_token"]
        self._refresh_token = data.get("refresh_token")
        self._token_expires_at = time.time() + data.get("expires_in", 3600)
        return data

    def _refresh_access_token(self) -> None:
        if not self._refresh_token:
            self.authenticate()
            return
        response = requests.post(
            f"{self.base_url}/v1/auth/refresh",
            json={"refresh_token": self._refresh_token},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        if not response.ok:
            self.authenticate()
            return
        data = response.json()
        self._access_token = data["access_token"]
        self._refresh_token = data.get("refresh_token")
        self._token_expires_at = time.time() + data.get("expires_in", 3600)

    def get_access_token(self) -> str:
        if not self._access_token or (self._token_expires_at and time.time() >= self._token_expires_at - 300):
            if self._refresh_token:
                self._refresh_access_token()
            else:
                self.authenticate()
        return self._access_token or ""

    def get_auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.get_access_token()}",
            "Content-Type": "application/json",
        }
