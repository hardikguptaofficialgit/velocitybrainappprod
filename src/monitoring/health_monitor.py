"""
Comprehensive health monitoring and metrics collection for Velocity Brain.
"""

import os
import socket
import time
import psutil
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
from urllib.parse import urlparse

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


@dataclass
class HealthCheck:
    """Health check result."""
    name: str
    status: str  # "healthy", "degraded", "unhealthy"
    message: str
    timestamp: datetime
    response_time_ms: float
    details: Dict[str, Any]


@dataclass
class SystemMetrics:
    """System performance metrics."""
    cpu_percent: float
    memory_percent: float
    disk_usage_percent: float
    open_files: int
    network_connections: int
    timestamp: datetime


@dataclass
class DatabaseMetrics:
    """Database performance metrics."""
    connection_count: int
    active_connections: int
    database_size_mb: float
    index_usage_percent: float
    slow_query_count: int
    timestamp: datetime


@dataclass
class ApplicationMetrics:
    """Application-specific metrics."""
    total_requests: int
    error_rate_percent: float
    average_response_time_ms: float
    active_users: int
    skill_load_count: int
    timestamp: datetime


class HealthMonitor:
    """Comprehensive health monitoring system."""
    
    def __init__(self):
        self.logger = get_logger('health_monitor')
        self.health_checks: List[HealthCheck] = []
        self.system_metrics: List[SystemMetrics] = []
        self.database_metrics: List[DatabaseMetrics] = []
        self.application_metrics: List[ApplicationMetrics] = []
        self.start_time = datetime.now(timezone.utc)
        
        # Metrics tracking
        self.request_count = 0
        self.error_count = 0
        self.response_times = []
        
    async def run_health_checks(self) -> Dict[str, Any]:
        """Run all health checks and return comprehensive status."""
        start_time = time.time()
        
        try:
            # Run individual health checks
            checks = await self._run_all_checks()
            
            # Calculate overall status
            overall_status = self._calculate_overall_status(checks)
            
            # Collect metrics
            system_metrics = self._collect_system_metrics()
            database_metrics = await self._collect_database_metrics()
            application_metrics = self._collect_application_metrics()
            
            # Store metrics
            self._store_metrics(system_metrics, database_metrics, application_metrics)
            
            response_time = (time.time() - start_time) * 1000
            
            result = {
                'status': overall_status,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'uptime_seconds': (datetime.now(timezone.utc) - self.start_time).total_seconds(),
                'checks': [asdict(check) for check in checks],
                'metrics': {
                    'system': asdict(system_metrics),
                    'database': asdict(database_metrics),
                    'application': asdict(application_metrics)
                },
                'response_time_ms': response_time
            }
            
            self.logger.info(f"Health check completed: {overall_status} in {response_time:.2f}ms")
            return result
            
        except Exception as exc:
            self.logger.error(f"Health check failed: {exc}")
            return {
                'status': 'unhealthy',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'error': str(exc),
                'uptime_seconds': (datetime.now(timezone.utc) - self.start_time).total_seconds()
            }
    
    async def _run_all_checks(self) -> List[HealthCheck]:
        """Run all individual health checks."""
        checks = []
        
        # Database health check
        checks.append(await self._check_database())
        
        # File system health check
        checks.append(self._check_filesystem())
        
        # Memory health check
        checks.append(self._check_memory())
        
        # Skills directory health check
        checks.append(self._check_skills_directory())
        
        # Configuration health check
        checks.append(self._check_configuration())
        
        # External dependencies health check
        checks.append(await self._check_external_dependencies())
        
        return checks
    
    async def _check_database(self) -> HealthCheck:
        """Check database connectivity and performance."""
        start_time = time.time()
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Test basic connectivity
                    cur.execute('SELECT 1 as health_check')
                    result = cur.fetchone()
                    
                    if result and result.get('health_check') == 1:
                        # Check table counts
                        cur.execute("""
                            SELECT 
                                COUNT(*) as total_entities,
                                COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_updates
                            FROM entities
                        """)
                        db_stats = cur.fetchone()
                        
                        response_time = (time.time() - start_time) * 1000
                        
                        return HealthCheck(
                            name='database',
                            status='healthy',
                            message=f"Database connected. Entities: {db_stats['total_entities']}, Recent updates: {db_stats['recent_updates']}",
                            timestamp=datetime.now(timezone.utc),
                            response_time_ms=response_time,
                            details=db_stats
                        )
                    else:
                        raise Exception("Database health check query failed")
                        
        except Exception as exc:
            response_time = (time.time() - start_time) * 1000
            return HealthCheck(
                name='database',
                status='unhealthy',
                message=f"Database connection failed: {exc}",
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={'error': str(exc)}
            )
    
    def _check_filesystem(self) -> HealthCheck:
        """Check file system health and permissions."""
        start_time = time.time()
        
        try:
            # Check critical directories
            critical_paths = [
                Path(settings.skills_path),
                Path(settings.local_storage_path),
                Path(settings.workspace_root)
            ]
            
            issues = []
            for path in critical_paths:
                if not path.exists():
                    issues.append(f"Missing directory: {path}")
                elif not os.access(path, os.R_OK | os.W_OK):
                    issues.append(f"Permission denied: {path}")
            
            # Check disk space on the workspace volume, which is more accurate on Windows.
            disk_target = Path(settings.workspace_root)
            if not disk_target.exists():
                disk_target = Path.cwd()
            disk_usage = psutil.disk_usage(str(disk_target))
            disk_usage_percent = (disk_usage.used / disk_usage.total) * 100
            
            response_time = (time.time() - start_time) * 1000
            
            if issues:
                status = 'unhealthy'
                message = f"Filesystem issues: {'; '.join(issues)}"
            elif disk_usage_percent > 90:
                status = 'degraded'
                message = f"Low disk space: {disk_usage_percent:.1f}%"
            else:
                status = 'healthy'
                message = f"Filesystem OK. Disk usage: {disk_usage_percent:.1f}%"
            
            return HealthCheck(
                name='filesystem',
                status=status,
                message=message,
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={
                    'disk_usage_percent': disk_usage_percent,
                    'disk_free_gb': disk_usage.free / (1024**3),
                    'issues': issues
                }
            )
            
        except Exception as exc:
            response_time = (time.time() - start_time) * 1000
            return HealthCheck(
                name='filesystem',
                status='unhealthy',
                message=f"Filesystem check failed: {exc}",
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={'error': str(exc)}
            )
    
    def _check_memory(self) -> HealthCheck:
        """Check memory usage."""
        start_time = time.time()
        
        try:
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            response_time = (time.time() - start_time) * 1000
            
            if memory_percent > 90:
                status = 'unhealthy'
                message = f"Critical memory usage: {memory_percent:.1f}%"
            elif memory_percent > 80:
                status = 'degraded'
                message = f"High memory usage: {memory_percent:.1f}%"
            else:
                status = 'healthy'
                message = f"Memory usage OK: {memory_percent:.1f}%"
            
            return HealthCheck(
                name='memory',
                status=status,
                message=message,
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={
                    'memory_percent': memory_percent,
                    'memory_available_gb': memory.available / (1024**3),
                    'memory_used_gb': memory.used / (1024**3)
                }
            )
            
        except Exception as exc:
            response_time = (time.time() - start_time) * 1000
            return HealthCheck(
                name='memory',
                status='unhealthy',
                message=f"Memory check failed: {exc}",
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={'error': str(exc)}
            )
    
    def _check_skills_directory(self) -> HealthCheck:
        """Check skills directory and load skills."""
        start_time = time.time()
        
        try:
            from src.services.skill_registry import SkillRegistry
            
            registry = SkillRegistry(settings.skills_path)
            skills = registry.list_skills()
            
            response_time = (time.time() - start_time) * 1000
            
            if len(skills) == 0:
                status = 'degraded'
                message = "No skills loaded"
            else:
                status = 'healthy'
                message = f"Loaded {len(skills)} skills"
            
            return HealthCheck(
                name='skills_directory',
                status=status,
                message=message,
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={
                    'skills_count': len(skills),
                    'categories': list(set(skill.get('category', 'unknown') for skill in skills))
                }
            )
            
        except Exception as exc:
            response_time = (time.time() - start_time) * 1000
            return HealthCheck(
                name='skills_directory',
                status='unhealthy',
                message=f"Skills directory check failed: {exc}",
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={'error': str(exc)}
            )
    
    def _check_configuration(self) -> HealthCheck:
        """Check configuration validity."""
        start_time = time.time()
        
        try:
            issues = []
            
            # Check critical configuration
            if not settings.database_url:
                issues.append("DATABASE_URL not configured")
            
            if settings.env in {'prod', 'production'}:
                if not settings.secret_key:
                    issues.append("SECRET_KEY not configured for production")
                if settings.allow_unsafe_file_reads:
                    issues.append("Unsafe file reads enabled in production")
            
            # Check paths
            critical_paths = [settings.skills_path, settings.local_storage_path]
            for path in critical_paths:
                if not Path(path).exists():
                    issues.append(f"Path does not exist: {path}")
            
            response_time = (time.time() - start_time) * 1000
            
            if issues:
                status = 'unhealthy'
                message = f"Configuration issues: {'; '.join(issues)}"
            else:
                status = 'healthy'
                message = "Configuration OK"
            
            return HealthCheck(
                name='configuration',
                status=status,
                message=message,
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={
                    'environment': settings.env,
                    'issues': issues
                }
            )
            
        except Exception as exc:
            response_time = (time.time() - start_time) * 1000
            return HealthCheck(
                name='configuration',
                status='unhealthy',
                message=f"Configuration check failed: {exc}",
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={'error': str(exc)}
            )
    
    async def _check_external_dependencies(self) -> HealthCheck:
        """Check external dependencies (if any)."""
        start_time = time.time()
        
        try:
            dependency_results: Dict[str, Any] = {
                'provider': settings.embedding_provider,
                'backend_api_url': settings.backend_api_url,
            }
            issues: List[str] = []

            backend_ok = await asyncio.to_thread(self._check_tcp_url, settings.backend_api_url)
            dependency_results['backend_api_reachable'] = backend_ok
            if not backend_ok:
                issues.append(f"Backend API unreachable: {settings.backend_api_url}")

            redis_url = os.getenv('REDIS_URL')
            if redis_url:
                redis_ok = await asyncio.to_thread(self._check_tcp_url, redis_url)
                dependency_results['redis_url'] = redis_url
                dependency_results['redis_reachable'] = redis_ok
                if not redis_ok:
                    issues.append("Redis unreachable")
            else:
                dependency_results['redis_configured'] = False

            response_time = (time.time() - start_time) * 1000

            if issues:
                status = 'degraded'
                message = '; '.join(issues)
            else:
                status = 'healthy'
                message = "External dependencies OK"
            
            return HealthCheck(
                name='external_dependencies',
                status=status,
                message=message,
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details=dependency_results
            )
            
        except Exception as exc:
            response_time = (time.time() - start_time) * 1000
            return HealthCheck(
                name='external_dependencies',
                status='degraded',
                message=f"External dependency check failed: {exc}",
                timestamp=datetime.now(timezone.utc),
                response_time_ms=response_time,
                details={'error': str(exc)}
            )
    
    def _calculate_overall_status(self, checks: List[HealthCheck]) -> str:
        """Calculate overall health status from individual checks."""
        if any(check.status == 'unhealthy' for check in checks):
            return 'unhealthy'
        elif any(check.status == 'degraded' for check in checks):
            return 'degraded'
        else:
            return 'healthy'
    
    def _collect_system_metrics(self) -> SystemMetrics:
        """Collect system performance metrics."""
        return SystemMetrics(
            cpu_percent=psutil.cpu_percent(interval=1),
            memory_percent=psutil.virtual_memory().percent,
            disk_usage_percent=psutil.disk_usage('/').percent,
            open_files=len(psutil.Process().open_files()),
            network_connections=len(psutil.net_connections()),
            timestamp=datetime.now(timezone.utc)
        )
    
    async def _collect_database_metrics(self) -> DatabaseMetrics:
        """Collect database performance metrics."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Get connection stats
                    cur.execute("""
                        SELECT 
                            count(*) as total_connections,
                            count(CASE WHEN state = 'active' THEN 1 END) as active_connections
                        FROM pg_stat_activity
                    """)
                    conn_stats = cur.fetchone()
                    
                    # Get database size
                    cur.execute("SELECT pg_database_size(current_database()) as size_bytes")
                    size_result = cur.fetchone()
                    
                    slow_query_count = 0
                    try:
                        cur.execute("""
                            SELECT count(*) as slow_queries
                            FROM pg_stat_statements
                            WHERE mean_exec_time > 1000
                        """)
                        slow_queries = cur.fetchone()
                        slow_query_count = slow_queries['slow_queries'] if slow_queries else 0
                    except Exception:
                        # pg_stat_statements is optional in many deployments.
                        slow_query_count = 0
                    
                    return DatabaseMetrics(
                        connection_count=conn_stats['total_connections'],
                        active_connections=conn_stats['active_connections'],
                        database_size_mb=round((size_result['size_bytes'] or 0) / (1024 * 1024), 2),
                        index_usage_percent=0.0,  # Would need more complex query
                        slow_query_count=slow_query_count,
                        timestamp=datetime.now(timezone.utc)
                    )
        except Exception as exc:
            self.logger.warning(f"Failed to collect database metrics: {exc}")
            return DatabaseMetrics(
                connection_count=0, active_connections=0, database_size_mb=0,
                index_usage_percent=0, slow_query_count=0,
                timestamp=datetime.now(timezone.utc)
            )
    
    def _collect_application_metrics(self) -> ApplicationMetrics:
        """Collect application-specific metrics."""
        error_rate = (self.error_count / max(self.request_count, 1)) * 100
        avg_response_time = sum(self.response_times) / max(len(self.response_times), 1) if self.response_times else 0
        
        return ApplicationMetrics(
            total_requests=self.request_count,
            error_rate_percent=error_rate,
            average_response_time_ms=avg_response_time,
            active_users=0,  # Would be tracked separately
            skill_load_count=0,  # Would be tracked separately
            timestamp=datetime.now(timezone.utc)
        )
    
    def _store_metrics(self, system: SystemMetrics, database: DatabaseMetrics, application: ApplicationMetrics):
        """Store metrics for historical tracking."""
        # Keep only last 1000 data points to prevent memory issues
        self.system_metrics.append(system)
        self.database_metrics.append(database)
        self.application_metrics.append(application)
        
        if len(self.system_metrics) > 1000:
            self.system_metrics = self.system_metrics[-1000:]
        if len(self.database_metrics) > 1000:
            self.database_metrics = self.database_metrics[-1000:]
        if len(self.application_metrics) > 1000:
            self.application_metrics = self.application_metrics[-1000:]
    
    def record_request(self, response_time_ms: float, is_error: bool = False):
        """Record a request for metrics tracking."""
        self.request_count += 1
        if is_error:
            self.error_count += 1
        self.response_times.append(response_time_ms)
        
        # Keep only last 1000 response times
        if len(self.response_times) > 1000:
            self.response_times = self.response_times[-1000:]

    @staticmethod
    def _check_tcp_url(raw_url: str) -> bool:
        """Return True when a TCP endpoint derived from a URL is reachable."""
        try:
            parsed = urlparse(raw_url)
            host = parsed.hostname
            if not host:
                return False

            if parsed.scheme in {'postgres', 'postgresql'}:
                default_port = 5432
            elif parsed.scheme in {'redis', 'rediss'}:
                default_port = 6379
            elif parsed.scheme == 'https':
                default_port = 443
            else:
                default_port = 80

            port = parsed.port or default_port
            with socket.create_connection((host, port), timeout=2):
                return True
        except OSError:
            return False


# Global health monitor instance
health_monitor = HealthMonitor()
