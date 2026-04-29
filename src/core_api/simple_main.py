#!/usr/bin/env python3
"""
VelocityBrain Core API - Simple Test Version

Standalone FastAPI server for testing without database dependencies.
"""

import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import time
import uuid

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Create FastAPI application
app = FastAPI(
    title="VelocityBrain Core API",
    description="Proprietary core engine API for VelocityBrain - Test Version",
    version="1.0.0-test",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class AuthRequest(BaseModel):
    api_key: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    response_style: str = Field(default="normal", pattern="^(normal|lite|full|ultra)$")
    max_results: int = Field(default=10, ge=1, le=100)

class QueryResponse(BaseModel):
    question: str
    answer: str
    sources: List[Dict[str, Any]]
    confidence: float
    response_style: str
    processing_time: float

class IngestRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=100000)
    source: str = Field(default="note", min_length=1, max_length=100)
    metadata: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None

class IngestResponse(BaseModel):
    success: bool
    document_id: str
    processing_time: float
    message: str

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    checks: Dict[str, Any]

# In-memory storage for testing
api_keys = {
    "vb_test_key_123": {"tier": "free", "rate_limit": 100},
    "vb_pro_key_456": {"tier": "pro", "rate_limit": 10000},
    "vb_enterprise_789": {"tier": "enterprise", "rate_limit": 100000}
}

tokens = {}
documents = []

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "VelocityBrain Core API",
        "version": "1.0.0-test",
        "status": "running",
        "environment": "test",
        "docs": "/docs"
    }

# Health check
@app.get("/v1/health", response_model=HealthResponse)
async def health_check():
    """Basic health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        version="1.0.0-test",
        checks={
            "database": "skipped (test mode)",
            "api": "healthy",
            "memory": "healthy"
        }
    )

# Authentication
@app.post("/v1/auth/authorize", response_model=AuthResponse)
async def authorize(request: AuthRequest):
    """Authorize API key and return access token."""
    api_key = request.api_key
    
    if api_key not in api_keys:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Generate simple token (in production, use JWT)
    token = f"test_token_{uuid.uuid4().hex}"
    tokens[token] = {
        "api_key": api_key,
        "tier": api_keys[api_key]["tier"],
        "expires_at": time.time() + 3600
    }
    
    return AuthResponse(
        access_token=token,
        expires_in=3600
    )

# Query endpoint
@app.post("/v1/query", response_model=QueryResponse)
async def query_brain(request: QueryRequest):
    """Query the VelocityBrain memory system."""
    start_time = time.time()
    
    # Simulate processing
    await asyncio.sleep(0.1)  # Simulate processing time
    
    # Mock response
    answer = f"This is a test response to: '{request.question}'. In production, this would use your proprietary core engine to retrieve relevant information from your memory."
    
    processing_time = time.time() - start_time
    
    return QueryResponse(
        question=request.question,
        answer=answer,
        sources=[{"title": "Test Source", "url": "https://example.com"}],
        confidence=0.85,
        response_style=request.response_style,
        processing_time=processing_time
    )

# Ingest endpoint
@app.post("/v1/ingest", response_model=IngestResponse)
async def ingest_content(request: IngestRequest):
    """Ingest content into VelocityBrain memory."""
    start_time = time.time()
    
    # Simulate processing
    await asyncio.sleep(0.1)  # Simulate processing time
    
    # Store document
    document_id = f"doc_{uuid.uuid4().hex[:8]}"
    documents.append({
        "id": document_id,
        "content": request.content,
        "source": request.source,
        "metadata": request.metadata or {},
        "tags": request.tags or [],
        "timestamp": time.time()
    })
    
    processing_time = time.time() - start_time
    
    return IngestResponse(
        success=True,
        document_id=document_id,
        processing_time=processing_time,
        message="Content ingested successfully (test mode)"
    )

# Skills list endpoint
@app.get("/v1/skills")
async def list_skills():
    """List available skills."""
    return {
        "skills": [
            {
                "name": "summarize",
                "description": "Summarize text content",
                "category": "enrichment",
                "version": "1.0.0",
                "required_tier": "free"
            },
            {
                "name": "extract",
                "description": "Extract structured information",
                "category": "enrichment", 
                "version": "1.0.0",
                "required_tier": "free"
            },
            {
                "name": "translate",
                "description": "Translate text between languages",
                "category": "enrichment",
                "version": "1.0.0",
                "required_tier": "pro"
            }
        ],
        "total": 3,
        "categories": ["enrichment"]
    }

# Status endpoint
@app.get("/v1/status")
async def get_status():
    """Get system status."""
    return {
        "status": "running",
        "uptime": time.time(),
        "version": "1.0.0-test",
        "environment": "test",
        "services": {
            "api": "running",
            "database": "skipped (test mode)",
            "cache": "skipped (test mode)"
        }
    }

# Usage stats endpoint
@app.get("/v1/usage")
async def get_usage_stats():
    """Get usage statistics."""
    return {
        "api_calls_today": 42,
        "api_calls_month": 1250,
        "documents_ingested": len(documents),
        "queries_executed": 15,
        "tasks_completed": 8,
        "tier_limits": {
            "free": {"daily_requests": 100},
            "pro": {"daily_requests": 10000},
            "enterprise": {"daily_requests": -1}
        }
    }

# Add asyncio import
import asyncio

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting VelocityBrain Core API (Test Version)")
    print("📖 API Documentation: http://localhost:8000/docs")
    print("🔑 Test API Keys:")
    print("  Free: vb_test_key_123")
    print("  Pro: vb_pro_key_456") 
    print("  Enterprise: vb_enterprise_789")
    print()
    
    uvicorn.run(
        "simple_main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
