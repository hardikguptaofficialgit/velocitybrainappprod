"""
VelocityBrain Authentication Manager
"""

import time
import jwt
import requests
from typing import Optional, Dict, Any
from .exceptions import AuthenticationError, APIError, NetworkError


class AuthManager:
    """Manages authentication with VelocityBrain API."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.velocitybrain.ai", timeout: int = 30):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expires_at: Optional[float] = None
        
    def authenticate(self) -> Dict[str, Any]:
        """Authenticate with the API and store tokens."""
        try:
            response = requests.post(
                f"{self.base_url}/v1/auth/authorize",
                json={"api_key": self.api_key},
                headers={"Content-Type": "application/json"},
                timeout=self.timeout,
            )
            
            if response.status_code == 401:
                raise AuthenticationError("Invalid API key")
            elif response.status_code == 429:
                raise AuthenticationError("Rate limit exceeded for authentication")
            elif not response.ok:
                raise APIError(
                    f"Authentication failed: {response.text}",
                    status_code=response.status_code
                )
            
            data = response.json()
            self._access_token = data["access_token"]
            self._refresh_token = data.get("refresh_token")
            self._token_expires_at = time.time() + data.get("expires_in", 3600)
            
            return data
            
        except requests.RequestException as e:
            raise NetworkError(f"Network error during authentication: {str(e)}")
    
    def get_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary."""
        if not self._access_token or (self._token_expires_at and time.time() >= self._token_expires_at - 300):
            if self._refresh_token:
                self._refresh_access_token()
            else:
                self.authenticate()
        
        return self._access_token
    
    def _refresh_access_token(self) -> None:
        """Refresh the access token using refresh token."""
        try:
            response = requests.post(
                f"{self.base_url}/v1/auth/refresh",
                json={"refresh_token": self._refresh_token},
                headers={"Content-Type": "application/json"},
                timeout=self.timeout,
            )
            
            if not response.ok:
                # If refresh fails, re-authenticate
                self.authenticate()
                return
            
            data = response.json()
            self._access_token = data["access_token"]
            self._refresh_token = data.get("refresh_token")
            self._token_expires_at = time.time() + data.get("expires_in", 3600)
            
        except requests.RequestException:
            # If refresh fails due to network error, re-authenticate
            self.authenticate()
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for API requests."""
        token = self.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def is_authenticated(self) -> bool:
        """Check if client is authenticated with valid token."""
        return (
            self._access_token is not None and
            (self._token_expires_at is None or time.time() < self._token_expires_at)
        )
