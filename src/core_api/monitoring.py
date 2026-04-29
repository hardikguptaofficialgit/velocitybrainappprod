"""
VelocityBrain Core API - Monitoring & Status

System health, status, and usage monitoring endpoints.
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from core_api.auth import get_current_user, get_rate_limit_info
from monitoring.health_monitor import HealthMonitor
from services.metrics_service import MetricsService
from core.logging_config import get_logger

logger = get_logger("core_api.monitoring")

# Models
class HealthCheckResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    checks: Dict[str, Any]

class StatusResponse(BaseModel):
    status: str
    uptime: float
    version: str
    environment: str
    services: Dict[str, str]

class UsageStatsResponse(BaseModel):
    api_calls_today: int
    api_calls_month: int
    documents_ingested: int
    queries_executed: int
    tasks_completed: int
    tier_limits: Dict[str, int]

def create_monitoring_router() -> APIRouter:
    """Create monitoring router."""
    router = APIRouter(prefix="/v1", tags=["monitoring"])
    
    # Initialize monitoring services
    health_monitor = HealthMonitor()
    metrics_service = MetricsService()
    
    @router.get("/health", response_model=HealthCheckResponse)
    async def health_check():
        """Basic health check endpoint."""
        try:
            health_status = health_monitor.get_basic_health()
            
            return HealthCheckResponse(
                status=health_status["status"],
                timestamp=health_status["timestamp"],
                version=health_status["version"],
                checks=health_status["checks"]
            )
            
        except Exception as e:
            logger.error(f"Health check error: {str(e)}")
            raise HTTPException(status_code=500, detail="Health check failed")
    
    @router.get("/status", response_model=StatusResponse)
    async def get_status(
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """Get system status."""
        try:
            logger.info(f"Status requested by {rate_info['tier']} user")
            
            status_info = health_monitor.get_detailed_status()
            
            return StatusResponse(
                status=status_info["status"],
                uptime=status_info["uptime"],
                version=status_info["version"],
                environment=status_info["environment"],
                services=status_info["services"]
            )
            
        except Exception as e:
            logger.error(f"Status error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get status")
    
    @router.get("/usage", response_model=UsageStatsResponse)
    async def get_usage_stats(
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """Get usage statistics for the current user."""
        try:
            logger.info(f"Usage stats requested by {rate_info['tier']} user")
            
            # Get usage metrics for the user
            usage = metrics_service.get_user_usage(
                api_key=current_user["api_key"],
                tier=rate_info["tier"]
            )
            
            # Get tier limits
            tier_limits = metrics_service.get_tier_limits(rate_info["tier"])
            
            return UsageStatsResponse(
                api_calls_today=usage["api_calls_today"],
                api_calls_month=usage["api_calls_month"],
                documents_ingested=usage["documents_ingested"],
                queries_executed=usage["queries_executed"],
                tasks_completed=usage["tasks_completed"],
                tier_limits=tier_limits
            )
            
        except Exception as e:
            logger.error(f"Usage stats error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get usage statistics")
    
    return router
