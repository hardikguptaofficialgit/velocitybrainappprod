import os
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator, ConfigDict

from src.core.logging_config import get_logger


def _env_str(name: str, default: str) -> str:
    return os.getenv(name, default)


def _env_optional_str(name: str) -> Optional[str]:
    value = os.getenv(name)
    return value if value not in {"", None} else None


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value in {"", None}:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value in {"", None}:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings(BaseModel):
    """Production-ready settings with validation."""
    
    # App settings
    app_name: str = Field(default_factory=lambda: _env_str('APP_NAME', 'Velocity Brain'), description='Application name')
    env: str = Field(default_factory=lambda: _env_str('ENV', 'dev'), description='Environment (dev, staging, prod)')
    port: int = Field(default_factory=lambda: _env_int('PORT', 8080), ge=1, le=65535, description='Server port')
    
    # Database settings
    database_url: str = Field(default_factory=lambda: _env_str('DATABASE_URL', 'postgresql://velocity:velocity@localhost:5432/velocitybrain'), description='Database connection URL')
    db_connect_timeout_seconds: int = Field(default_factory=lambda: _env_int('DB_CONNECT_TIMEOUT_SECONDS', 5), ge=1, le=60, description='Database connection timeout')
    db_lock_timeout_ms: int = Field(default_factory=lambda: _env_int('DB_LOCK_TIMEOUT_MS', 5000), ge=1000, le=300000, description='Database lock timeout')
    db_statement_timeout_ms: int = Field(default_factory=lambda: _env_int('DB_STATEMENT_TIMEOUT_MS', 15000), ge=1000, le=300000, description='Database statement timeout')
    
    # Embedding settings
    embed_dim: int = Field(default_factory=lambda: _env_int('EMBED_DIM', 1536), ge=1, le=10000, description='Embedding dimension')
    embedding_provider: str = Field(default_factory=lambda: _env_str('EMBEDDING_PROVIDER', 'openai-compatible'), description='Embedding provider')
    embedding_model: str = Field(default_factory=lambda: _env_str('EMBEDDING_MODEL', 'text-embedding-3-small'), description='Embedding model')
    model_router: str = Field(default_factory=lambda: _env_str('MODEL_ROUTER', 'native'), description='Model router')
    
    # Path settings
    skills_path: str = Field(default_factory=lambda: _env_str('SKILLS_PATH', 'skills'), description='Skills directory path')
    local_storage_path: str = Field(default_factory=lambda: _env_str('LOCAL_STORAGE_PATH', './data'), description='Local storage path')
    workspace_root: str = Field(default_factory=lambda: _env_str('WORKSPACE_ROOT', str(Path.cwd())), description='Workspace root directory')
    identity_spec_path: str = Field(default_factory=lambda: _env_str('IDENTITY_SPEC_PATH', 'identity.spec.json'), description='Identity specification file path')
    
    # Security settings
    default_access_level: str = Field(default_factory=lambda: _env_str('DEFAULT_ACCESS_LEVEL', 'private'), description='Default access level')
    allow_unsafe_file_reads: bool = Field(default_factory=lambda: _env_bool('ALLOW_UNSAFE_FILE_READS', False), description='Allow unsafe file reads')
    mcp_allow_destructive_tools: bool = Field(default_factory=lambda: _env_bool('MCP_ALLOW_DESTRUCTIVE_TOOLS', False), description='Allow destructive MCP tools')
    
    # Logging settings
    log_level: str = Field(default_factory=lambda: _env_str('LOG_LEVEL', 'INFO'), description='Log level')
    log_file: Optional[str] = Field(default_factory=lambda: _env_optional_str('LOG_FILE'), description='Log file path')
    enable_json_logging: bool = Field(default_factory=lambda: _env_bool('ENABLE_JSON_LOGGING', True), description='Enable JSON logging')
    
    # Security settings
    secret_key: Optional[str] = Field(default_factory=lambda: _env_optional_str('SECRET_KEY'), description='Secret key for authentication')
    jwt_algorithm: str = Field(default_factory=lambda: _env_str('JWT_ALGORITHM', 'HS256'), description='JWT algorithm')
    access_token_ttl_minutes: int = Field(default_factory=lambda: _env_int('ACCESS_TOKEN_TTL_MINUTES', 60), ge=1, le=1440, description='Access token TTL in minutes')
    backend_api_url: str = Field(default_factory=lambda: _env_str('BACKEND_API_URL', 'http://localhost:3001'), description='Backend API URL for API key validation')
    cors_origins: Optional[str] = Field(default_factory=lambda: _env_optional_str('CORS_ORIGINS'), description='Comma-separated CORS origins')
    cors_allow_credentials: bool = Field(default_factory=lambda: _env_bool('CORS_ALLOW_CREDENTIALS', False), description='Allow CORS credentials')
    
    # Rate limiting
    rate_limit_enabled: bool = Field(default_factory=lambda: _env_bool('RATE_LIMIT_ENABLED', True), description='Enable rate limiting')
    rate_limit_requests_per_minute: int = Field(default_factory=lambda: _env_int('RATE_LIMIT_REQUESTS_PER_MINUTE', 100), ge=1, le=10000, description='Rate limit requests per minute')
    
    # Content validation
    max_content_length: int = Field(default_factory=lambda: _env_int('MAX_CONTENT_LENGTH', 10*1024*1024), ge=1024, le=100*1024*1024, description='Max content length in bytes')
    max_query_length: int = Field(default_factory=lambda: _env_int('MAX_QUERY_LENGTH', 2000), ge=100, le=10000, description='Max query length')
    
    @field_validator('env')
    @classmethod
    def validate_env(cls, v):
        allowed = {'dev', 'development', 'staging', 'prod', 'production'}
        if v not in allowed:
            raise ValueError(f'Environment must be one of: {allowed}')
        return v
    
    @field_validator('database_url')
    @classmethod
    def validate_database_url(cls, v):
        if not v or not v.strip():
            raise ValueError('Database URL cannot be empty')
        if not v.startswith(('postgresql://', 'postgres://')):
            raise ValueError('Database URL must be a PostgreSQL connection string')
        return v.strip()
    
    @field_validator('default_access_level')
    @classmethod
    def validate_access_level(cls, v):
        allowed = {'private', 'restricted', 'public'}
        if v not in allowed:
            raise ValueError(f'Access level must be one of: {allowed}')
        return v
    
    @field_validator('log_level')
    @classmethod
    def validate_log_level(cls, v):
        allowed = {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}
        if v.upper() not in allowed:
            raise ValueError(f'Log level must be one of: {allowed}')
        return v.upper()
    
    @field_validator('skills_path', 'local_storage_path', 'workspace_root')
    @classmethod
    def validate_paths(cls, v):
        path = Path(v)
        if not path.is_absolute():
            # Convert relative paths to absolute
            path = Path.cwd() / path
        return str(path.resolve())
    
    @field_validator('identity_spec_path')
    @classmethod
    def validate_identity_spec_path(cls, v):
        path = Path(v)
        if not path.is_absolute():
            path = Path.cwd() / path
        return str(path.resolve())
    
    @field_validator('embedding_provider')
    @classmethod
    def validate_embedding_provider(cls, v):
        allowed = {'openai-compatible', 'huggingface', 'local'}
        if v not in allowed:
            raise ValueError(f'Embedding provider must be one of: {allowed}')
        return v
    
    @field_validator('jwt_algorithm')
    @classmethod
    def validate_jwt_algorithm(cls, v):
        allowed = {'HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'}
        if v not in allowed:
            raise ValueError(f'JWT algorithm must be one of: {allowed}')
        return v
    
    model_config = ConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False
    )
    
    def __init__(self, **data: Any):
        super().__init__(**data)
        self._validate_configuration()
    
    def _validate_configuration(self) -> None:
        """Validate overall configuration consistency."""
        logger = get_logger('config')
        
        # Security warnings for production
        if self.env in {'prod', 'production'}:
            if self.allow_unsafe_file_reads:
                logger.warning('Unsafe file reads enabled in production environment')
            if self.mcp_allow_destructive_tools:
                logger.warning('Destructive MCP tools enabled in production environment')
            if not self.secret_key:
                logger.error('Secret key not configured for production environment')
        
        # Validate paths exist or can be created
        for path_name in ['skills_path', 'local_storage_path']:
            path = Path(getattr(self, path_name))
            if not path.exists():
                try:
                    path.mkdir(parents=True, exist_ok=True)
                    logger.info(f'Created directory: {path}')
                except Exception as exc:
                    logger.error(f'Failed to create directory {path}: {exc}')
        
        # Missing repo-local identity specs are common in consumer repos, so keep this low-noise
        identity_path = Path(self.identity_spec_path)
        if not identity_path.exists():
            if os.getenv('IDENTITY_SPEC_PATH'):
                logger.warning(f'Identity spec file not found: {identity_path}')
            else:
                logger.info(f'No repo-local identity spec found at {identity_path}; using default hosted identity behavior')
        
        logger.info(f'Configuration validated for environment: {self.env}')


settings = Settings()
