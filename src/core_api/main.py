"""
VelocityBrain Core API Main Application

FastAPI application for the proprietary core engine API.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import time
import sys
import os
import httpx
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.core.config import settings
from src.core.logging_config import get_logger
from src.core_api import create_auth_router, create_brain_router, create_skills_router, create_monitoring_router
from src.core_api.auth import validate_api_key_with_backend

logger = get_logger("core_api.main")

# Create FastAPI application
app = FastAPI(
    title="VelocityBrain Core API",
    description="Proprietary core engine API for VelocityBrain",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware for production
if settings.env in {"prod", "production"}:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["api.velocitybrain.ai", "*.velocitybrain.ai"]
    )

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting and request logging middleware."""
    start_time = time.time()
    
    # Check for API key in header (for CLI integration)
    api_key = request.headers.get("X-API-Key")
    if api_key:
        try:
            # Validate API key with backend
            key_info = await validate_api_key_with_backend(api_key)
            if not key_info:
                logger.warning(f"Invalid API key in request: {api_key[:8]}...")
                return JSONResponse(
                    status_code=401,
                    content={"error": "Invalid API key"}
                )
            # Add user info to request state
            request.state.user = {
                "api_key": api_key,
                "tier": key_info["tier"],
                "user_id": key_info.get("user_id")
            }
        except Exception as e:
            logger.error(f"API key validation error: {e}")
            # Continue without API key auth if validation fails
            pass
    
    # Log request
    logger.info(f"Request: {request.method} {request.url.path}")
    
    # Process request
    response = await call_next(request)
    
    # Log response
    process_time = time.time() - start_time
    logger.info(f"Response: {response.status_code} in {process_time:.3f}s")
    
    # Add processing time header
    response.headers["X-Process-Time"] = str(process_time)
    
    return response

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": "An unexpected error occurred"}
    )

# Include routers
app.include_router(create_auth_router())
app.include_router(create_brain_router())
app.include_router(create_skills_router())
app.include_router(create_monitoring_router())

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "VelocityBrain Core API",
        "version": "1.0.0",
        "status": "running",
        "environment": settings.env,
        "docs": "/docs"
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info("VelocityBrain Core API starting up...")
    logger.info(f"Environment: {settings.env}")
    logger.info(f"Database URL: {settings.database_url}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("VelocityBrain Core API shutting down...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.core_api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.env == "dev"
    )
