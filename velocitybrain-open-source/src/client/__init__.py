"""
VelocityBrain Client SDK

Open-source client for accessing VelocityBrain core engine APIs.
"""

from .client import VelocityBrainClient
from .auth import AuthManager
from .exceptions import (
    VelocityBrainError,
    AuthenticationError,
    RateLimitError,
    APIError
)

__version__ = "1.0.0"
__all__ = [
    "VelocityBrainClient",
    "AuthManager", 
    "VelocityBrainError",
    "AuthenticationError",
    "RateLimitError",
    "APIError"
]
