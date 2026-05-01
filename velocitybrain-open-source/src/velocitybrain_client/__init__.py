"""Public VelocityBrain client package."""

from .client import VelocityBrainClient
from .client.auth import AuthManager
from .client.exceptions import (
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

