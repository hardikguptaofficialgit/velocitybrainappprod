"""
Centralized logging configuration for Velocity Brain.
"""

import logging
import sys
from datetime import datetime, UTC
from pathlib import Path
from typing import Any, Dict, Optional

from pythonjsonlogger import jsonlogger


class VelocityBrainFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter for structured logging."""
    
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]):
        """Add custom fields to log records."""
        super().add_fields(log_record, record, message_dict)
        
        # Add timestamp if not present
        if not log_record.get('timestamp'):
            log_record['timestamp'] = datetime.now(UTC).isoformat()
        
        # Add log level
        log_record['level'] = record.levelname
        
        # Add module and function
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        
        # Add service name
        log_record['service'] = 'velocitybrain'
        
        # Add process info
        log_record['process_id'] = record.process
        log_record['thread_id'] = record.thread


class SecurityFilter(logging.Filter):
    """Filter for security-related events."""
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add security context to security-related logs."""
        if hasattr(record, 'security_event'):
            record.security = True
        return True


class AuditFilter(logging.Filter):
    """Filter for audit events."""
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add audit context to audit-related logs."""
        if hasattr(record, 'audit_event'):
            record.audit = True
        return True


def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    enable_json: bool = True,
    enable_console: bool = True
) -> None:
    """Setup centralized logging configuration."""
    
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    if enable_json:
        formatter = VelocityBrainFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s'
        )
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        console_handler.addFilter(SecurityFilter())
        console_handler.addFilter(AuditFilter())
        root_logger.addHandler(console_handler)
    
    # File handler
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(formatter)
        file_handler.addFilter(SecurityFilter())
        file_handler.addFilter(AuditFilter())
        root_logger.addHandler(file_handler)
    
    # Configure specific loggers
    configure_specific_loggers()


def configure_specific_loggers() -> None:
    """Configure logging for specific components."""
    
    # Security logger
    security_logger = logging.getLogger('velocitybrain.security')
    security_logger.setLevel(logging.INFO)
    security_logger.propagate = True
    
    # Audit logger
    audit_logger = logging.getLogger('velocitybrain.audit')
    audit_logger.setLevel(logging.INFO)
    audit_logger.propagate = True
    
    # Database logger
    db_logger = logging.getLogger('velocitybrain.database')
    db_logger.setLevel(logging.WARNING)  # Reduce database noise
    db_logger.propagate = True
    
    # API logger
    api_logger = logging.getLogger('velocitybrain.api')
    api_logger.setLevel(logging.INFO)
    api_logger.propagate = True
    
    # MCP logger
    mcp_logger = logging.getLogger('velocitybrain.mcp')
    mcp_logger.setLevel(logging.INFO)
    mcp_logger.propagate = True


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name."""
    return logging.getLogger(f'velocitybrain.{name}')


def log_security_event(
    event_type: str,
    actor: str,
    details: Dict[str, Any],
    severity: str = "INFO"
) -> None:
    """Log a security event."""
    logger = get_logger('security')
    log_level = getattr(logging, severity.upper())
    
    logger.log(
        log_level,
        f"Security event: {event_type}",
        extra={
            'security_event': True,
            'event_type': event_type,
            'actor': actor,
            'details': details
        }
    )


def log_audit_event(
    event_type: str,
    actor: str,
    details: Dict[str, Any],
    severity: str = "INFO"
) -> None:
    """Log an audit event."""
    logger = get_logger('audit')
    log_level = getattr(logging, severity.upper())
    
    logger.log(
        log_level,
        f"Audit event: {event_type}",
        extra={
            'audit_event': True,
            'event_type': event_type,
            'actor': actor,
            'details': details
        }
    )


def log_error(
    error: Exception,
    context: Dict[str, Any],
    logger: Optional[logging.Logger] = None
) -> None:
    """Log an error with context."""
    if logger is None:
        logger = get_logger('error')
    
    logger.error(
        f"Error occurred: {str(error)}",
        extra={
            'error_type': type(error).__name__,
            'error_message': str(error),
            'context': context,
            'traceback': True
        },
        exc_info=True
    )
