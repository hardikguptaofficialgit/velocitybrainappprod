"""
VelocityBrain Client Exceptions
"""


class VelocityBrainError(Exception):
    """Base exception for all VelocityBrain client errors."""
    pass


class AuthenticationError(VelocityBrainError):
    """Raised when authentication fails."""
    pass


class RateLimitError(VelocityBrainError):
    """Raised when API rate limit is exceeded."""
    
    def __init__(self, message: str, retry_after: int = None):
        super().__init__(message)
        self.retry_after = retry_after


class APIError(VelocityBrainError):
    """Raised when API request fails."""
    
    def __init__(self, message: str, status_code: int = None, response_data: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


class ConfigurationError(VelocityBrainError):
    """Raised when client configuration is invalid."""
    pass


class NetworkError(VelocityBrainError):
    """Raised when network connectivity fails."""
    pass
