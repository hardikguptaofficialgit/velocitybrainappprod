"""Hosted API client exports."""

from .auth import AuthManager
from .client import VelocityBrainClient
from .exceptions import (
    APIError,
    AuthenticationError,
    ConfigurationError,
    NetworkError,
    RateLimitError,
    VelocityBrainError,
)

__all__ = [
    "VelocityBrainClient",
    "AuthManager",
    "VelocityBrainError",
    "AuthenticationError",
    "RateLimitError",
    "APIError",
    "ConfigurationError",
    "NetworkError",
]

