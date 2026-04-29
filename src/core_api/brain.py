"""
VelocityBrain Core API - Brain Functions

Core brain functions: query, ingest, run agent tasks.
These endpoints interface with the proprietary core engine.
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from core_api.auth import get_current_user, get_rate_limit_info
from services.agent_loop import AgentLoop
from services.memory_engine import MemoryEngine
from services.retrieval_engine import RetrievalEngine
from core.logging_config import get_logger

logger = get_logger("core_api.brain")

# Models
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    response_style: str = Field(default="normal", pattern="^(normal|lite|full|ultra)$")
    max_results: int = Field(default=10, ge=1, le=100)
    filters: Optional[Dict[str, Any]] = None

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

class RunRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=2000)
    response_style: str = Field(default="normal", pattern="^(normal|lite|full|ultra)$")
    context: Optional[Dict[str, Any]] = None

class RunResponse(BaseModel):
    task: str
    result: str
    steps: List[Dict[str, Any]]
    confidence: float
    response_style: str
    processing_time: float

def create_brain_router() -> APIRouter:
    """Create brain functions router."""
    router = APIRouter(prefix="/v1", tags=["brain"])
    
    # Initialize core services
    agent_loop = AgentLoop()
    memory_engine = MemoryEngine()
    retrieval_engine = RetrievalEngine()
    
    @router.post("/query", response_model=QueryResponse)
    async def query_brain(
        request: QueryRequest,
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """Query the VelocityBrain memory system."""
        import time
        start_time = time.time()
        
        try:
            logger.info(f"Query from {rate_info['tier']} user: {request.question[:100]}...")
            
            # Use proprietary retrieval engine
            results = retrieval_engine.query(
                question=request.question,
                max_results=request.max_results,
                filters=request.filters,
                user_tier=rate_info["tier"]
            )
            
            # Generate response using agent loop
            answer = agent_loop.process_query(
                question=request.question,
                retrieved_context=results,
                response_style=request.response_style
            )
            
            processing_time = time.time() - start_time
            
            return QueryResponse(
                question=request.question,
                answer=answer["text"],
                sources=results.get("sources", []),
                confidence=answer.get("confidence", 0.0),
                response_style=request.response_style,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Query error: {str(e)}")
            raise HTTPException(status_code=500, detail="Query processing failed")
    
    @router.post("/ingest", response_model=IngestResponse)
    async def ingest_content(
        request: IngestRequest,
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """Ingest content into VelocityBrain memory."""
        import time
        start_time = time.time()
        
        try:
            logger.info(f"Ingest from {rate_info['tier']} user: {request.source}")
            
            # Use proprietary memory engine
            result = memory_engine.ingest(
                content=request.content,
                source=request.source,
                metadata=request.metadata or {},
                tags=request.tags or [],
                user_tier=rate_info["tier"]
            )
            
            processing_time = time.time() - start_time
            
            return IngestResponse(
                success=True,
                document_id=result["document_id"],
                processing_time=processing_time,
                message="Content ingested successfully"
            )
            
        except Exception as e:
            logger.error(f"Ingest error: {str(e)}")
            raise HTTPException(status_code=500, detail="Content ingestion failed")
    
    @router.post("/ingest/file", response_model=IngestResponse)
    async def ingest_file(
        file: UploadFile = File(...),
        source: str = Form(default="file"),
        metadata: Optional[str] = Form(None),
        tags: Optional[str] = Form(None),
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """Ingest a file into VelocityBrain memory."""
        import time
        import json
        start_time = time.time()
        
        try:
            logger.info(f"File ingest from {rate_info['tier']} user: {file.filename}")
            
            # Read file content
            content = await file.read()
            
            # Parse metadata and tags if provided
            parsed_metadata = {}
            if metadata:
                try:
                    parsed_metadata = json.loads(metadata)
                except:
                    logger.warning("Invalid metadata JSON")
            
            parsed_tags = []
            if tags:
                try:
                    parsed_tags = json.loads(tags)
                except:
                    parsed_tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
            
            # Use proprietary memory engine for file processing
            result = memory_engine.ingest_file(
                file_content=content,
                filename=file.filename,
                source=source,
                metadata=parsed_metadata,
                tags=parsed_tags,
                user_tier=rate_info["tier"]
            )
            
            processing_time = time.time() - start_time
            
            return IngestResponse(
                success=True,
                document_id=result["document_id"],
                processing_time=processing_time,
                message=f"File '{file.filename}' ingested successfully"
            )
            
        except Exception as e:
            logger.error(f"File ingest error: {str(e)}")
            raise HTTPException(status_code=500, detail="File ingestion failed")
    
    @router.post("/run", response_model=RunResponse)
    async def run_agent(
        request: RunRequest,
        current_user: Dict[str, Any] = Depends(get_current_user),
        rate_info: Dict[str, Any] = Depends(get_rate_limit_info)
    ):
        """Run an agent task with VelocityBrain."""
        import time
        start_time = time.time()
        
        try:
            logger.info(f"Run task from {rate_info['tier']} user: {request.task[:100]}...")
            
            # Use proprietary agent loop
            result = agent_loop.run_task(
                task=request.task,
                context=request.context or {},
                response_style=request.response_style,
                user_tier=rate_info["tier"]
            )
            
            processing_time = time.time() - start_time
            
            return RunResponse(
                task=request.task,
                result=result["text"],
                steps=result.get("steps", []),
                confidence=result.get("confidence", 0.0),
                response_style=request.response_style,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Run task error: {str(e)}")
            raise HTTPException(status_code=500, detail="Task execution failed")
    
    return router
