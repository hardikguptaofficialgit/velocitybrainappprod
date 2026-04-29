import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg import OperationalError, DatabaseError

from src.core.config import settings
from src.core.logging_config import get_logger, log_error
from src.core.security import validator


logger = get_logger('database')


def _sanitize_db_url(url: str) -> str:
    """Sanitize database URL for logging by removing password."""
    if not url:
        return "empty"
    
    # Remove password from URL
    if '@' in url and '://' in url:
        parts = url.split('://')
        if len(parts) == 2:
            scheme = parts[0]
            rest = parts[1]
            if '@' in rest:
                auth_part, host_part = rest.split('@', 1)
                if ':' in auth_part:
                    user, _ = auth_part.split(':', 1)
                    return f"{scheme}://{user}@{host_part}"
            return f"{scheme}://{rest}"
    
    return url.split('@')[0] + '@***' if '@' in url else url

@contextmanager
def get_conn():
    """Get database connection with proper error handling and logging."""
    conn = None
    safe_url = _sanitize_db_url(settings.database_url or "")
    try:
        # Validate database URL format
        if not settings.database_url:
            raise ValueError("DATABASE_URL is not configured")
        
        # Sanitize database URL for logging
        logger.info(f"Connecting to database: {safe_url}")
        
        options = f"-c lock_timeout={settings.db_lock_timeout_ms} -c statement_timeout={settings.db_statement_timeout_ms}"
        conn = psycopg.connect(
            settings.database_url,
            row_factory=dict_row,
            connect_timeout=max(1, settings.db_connect_timeout_seconds),
            options=options,
        )
        
        # Test connection
        with conn.cursor() as cur:
            cur.execute('SELECT 1')
        
        logger.debug("Database connection established")
        yield conn
        
    except ValueError as exc:
        log_error(exc, {'operation': 'database_connection'})
        raise RuntimeError(str(exc)) from exc
    except (OperationalError, DatabaseError) as exc:
        error_msg = f'Database connection failed: {str(exc)}'
        logger.error(error_msg, extra={'database_url': safe_url})
        raise RuntimeError(
            'Database connection failed. Check DATABASE_URL and ensure the DB/schema exist. '
            f'url={safe_url} error={exc}'
        ) from exc
    except Exception as exc:
        log_error(exc, {'operation': 'database_connection'})
        raise RuntimeError(
            'Database connection failed. Check DATABASE_URL and ensure the DB/schema exist. '
            f'url={safe_url} error={exc}'
        ) from exc
    finally:
        if conn:
            try:
                conn.close()
                logger.debug("Database connection closed")
            except Exception as exc:
                logger.warning(f"Error closing database connection: {exc}")


def bootstrap_schema(embed_dim: Optional[int] = None) -> Dict[str, Any]:
    """Bootstrap database schema with proper validation and error handling."""
    try:
        dim = int(settings.embed_dim if embed_dim is None else embed_dim)
        if dim <= 0 or dim > 10000:
            raise ValueError(f"Invalid embedding dimension: {dim}. Must be between 1 and 10000")
        
        schema_path = Path('migrations/schema.sql')
        if not schema_path.exists():
            raise FileNotFoundError(f'Schema file missing: {schema_path}')
        
        # Validate schema file size
        if schema_path.stat().st_size > 10 * 1024 * 1024:  # 10MB
            raise ValueError(f"Schema file too large: {schema_path}")
        
        logger.info(f"Bootstrapping schema with dimension {dim}")
        
        sql = schema_path.read_text(encoding='utf-8')
        sql = sql.replace('vector(1536)', f'vector({dim})')
        
        # Validate SQL content
        if not sql.strip():
            raise ValueError("Schema file is empty")
        
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
        
        logger.info(f"Schema successfully bootstrapped with dimension {dim}")
        return {
            'ok': True, 
            'embed_dim': dim, 
            'schema': str(schema_path),
            'timestamp': logger.info("Schema bootstrap completed")
        }
        
    except Exception as exc:
        log_error(exc, {'embed_dim': embed_dim, 'operation': 'schema_bootstrap'})
        return {
            'ok': False, 
            'error': str(exc),
            'embed_dim': embed_dim or settings.embed_dim
        }


def serialize_vector(values: list[float], dim: Optional[int] = None) -> str:
    """Serialize vector with validation and error handling."""
    try:
        if not isinstance(values, (list, tuple)):
            raise TypeError(f"Values must be a list or tuple, got {type(values)}")
        
        target = int(dim or settings.embed_dim)
        if target <= 0 or target > 10000:
            raise ValueError(f"Invalid vector dimension: {target}")
        
        if len(values) != target:
            raise ValueError(f'vector dimension mismatch: expected {target}, got {len(values)}')
        
        # Validate all values are numbers
        for i, v in enumerate(values):
            if not isinstance(v, (int, float)):
                raise TypeError(f"Vector value at index {i} is not a number: {v}")
            if not (-1.0 <= float(v) <= 1.0):
                logger.warning(f"Vector value at index {i} is outside [-1, 1] range: {v}")
        
        # Format with proper precision
        formatted_values = [f'{float(v):.8f}' for v in values]
        result = '[' + ','.join(formatted_values) + ']'
        
        logger.debug(f"Serialized vector of dimension {target}")
        return result
        
    except Exception as exc:
        log_error(exc, {'values_length': len(values) if values else 0, 'target_dim': dim})
        raise
