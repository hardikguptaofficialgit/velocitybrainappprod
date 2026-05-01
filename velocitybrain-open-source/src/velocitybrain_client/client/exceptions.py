"""Public client exceptions."""


class VelocityBrainError(Exception):
    """Base exception for public client failures."""


class AuthenticationError(VelocityBrainError):
    """Raised when API authentication fails."""


class RateLimitError(VelocityBrainError):
    """Raised when the hosted API rate-limits a request."""

    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class APIError(VelocityBrainError):
    """Raised when the hosted API returns a non-success response."""

    def __init__(self, message: str, status_code: int | None = None, response_data: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data or {}


class ConfigurationError(VelocityBrainError):
    """Raised when public client configuration is invalid."""


class NetworkError(VelocityBrainError):
    """Raised when the hosted API cannot be reached."""

