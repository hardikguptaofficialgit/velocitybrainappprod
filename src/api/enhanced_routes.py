"""
Enhanced API Routes for Advanced VelocityBrain Features
Provides endpoints for codebase indexing, call graph analysis, multi-agent collaboration, and token optimization
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from fastapi.responses import JSONResponse
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import asyncio

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.security import get_current_user, validate_api_key
from src.services.codebase_indexer import codebase_indexer
from src.services.call_graph_analyzer import call_graph_analyzer
from src.services.intelligent_context_engine import intelligent_context_engine, ContextType
from src.services.multi_agent_collaboration import multi_agent_collaboration, AgentRole, TaskStatus
from src.services.token_optimizer import token_optimizer

router = APIRouter(prefix="/v2", tags=["enhanced"])
logger = get_logger('enhanced_api')


# Pydantic Models
class CodebaseIndexRequest(BaseModel):
    repo_path: str = Field(..., description="Path to the repository to index")
    force_reindex: bool = Field(False, description="Force reindexing even if unchanged")
    language_filters: Optional[List[str]] = Field(None, description="Filter by programming languages")


class ContextQueryRequest(BaseModel):
    query: str = Field(..., description="Context query string")
    max_results: int = Field(50, description="Maximum number of results")
    max_hops: int = Field(5, description="Maximum hops for context expansion")
    context_types: Optional[List[str]] = Field(None, description="Types of context to retrieve")
    include_code_context: bool = Field(True, description="Include code context")
    include_semantic_search: bool = Field(True, description="Include semantic search")


class AgentRegistrationRequest(BaseModel):
    name: str = Field(..., description="Agent name")
    role: str = Field(..., description="Agent role")
    capabilities: List[str] = Field(default_factory=list, description="Agent capabilities")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    context_sharing_enabled: bool = Field(True, description="Enable context sharing")
    max_concurrent_tasks: int = Field(3, description="Maximum concurrent tasks")


class TaskCreationRequest(BaseModel):
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Task description")
    coordinator_id: str = Field(..., description="Coordinator agent ID")
    participants: List[str] = Field(..., description="Participant agent IDs")
    priority: int = Field(5, description="Task priority (1-10)")
    deadline: Optional[datetime] = Field(None, description="Task deadline")
    context_requirements: List[str] = Field(default_factory=list, description="Context requirements")


class ContextShareRequest(BaseModel):
    source_agent_id: str = Field(..., description="Source agent ID")
    target_agent_ids: List[str] = Field(..., description="Target agent IDs")
    context_type: str = Field(..., description="Context type")
    content: Dict[str, Any] = Field(..., description="Context content")
    relevance_score: float = Field(1.0, description="Relevance score")
    expires_hours: Optional[int] = Field(None, description="Expiration in hours")


class TokenOptimizationRequest(BaseModel):
    content: str = Field(..., description="Content to optimize")
    target_tokens: Optional[int] = Field(None, description="Target token count")
    compression_method: Optional[str] = Field(None, description="Compression method")
    preserve_structure: bool = Field(True, description="Preserve structure")


# Codebase Indexing Endpoints
@router.post("/index/repository", summary="Index a repository")
async def index_repository(
    request: CodebaseIndexRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Index an entire repository with tree-sitter parsing"""
    try:
        # Start indexing in background
        background_tasks.add_task(
            codebase_indexer.index_repository,
            request.repo_path,
            request.force_reindex
        )
        
        return {
            "status": "started",
            "message": f"Repository indexing started for: {request.repo_path}",
            "repo_path": request.repo_path,
            "force_reindex": request.force_reindex,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Repository indexing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/index/status", summary="Get indexing status")
async def get_indexing_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current indexing status and statistics"""
    try:
        # Get indexing statistics from database
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Get code statistics
                cur.execute("""
                    SELECT language, COUNT(*) as total_elements,
                           COUNT(CASE WHEN type = 'function' THEN 1 END) as functions,
                           COUNT(CASE WHEN type = 'class' THEN 1 END) as classes,
                           COUNT(DISTINCT file_path) as files_indexed,
                           MAX(updated_at) as last_indexed
                    FROM code_elements
                    GROUP BY language
                """)
                code_stats = cur.fetchall()
                
                # Get relationship statistics
                cur.execute("""
                    SELECT relationship_type, COUNT(*) as count
                    FROM code_relationships
                    GROUP BY relationship_type
                """)
                rel_stats = cur.fetchall()
        
        return {
            "code_statistics": code_stats,
            "relationship_statistics": rel_stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get indexing status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/code", summary="Search code elements")
async def search_code(
    query: str = Query(..., description="Search query"),
    language: Optional[str] = Query(None, description="Filter by language"),
    element_type: Optional[str] = Query(None, description="Filter by element type"),
    limit: int = Query(50, description="Maximum results"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Search for code elements"""
    try:
        results = await codebase_indexer.search_elements(
            query, language, element_type, limit
        )
        
        return {
            "query": query,
            "language": language,
            "element_type": element_type,
            "results": results,
            "total_found": len(results),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Code search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Call Graph Analysis Endpoints
@router.post("/call-graph/build", summary="Build call graphs")
async def build_call_graphs(
    repo_path: Optional[str] = Query(None, description="Repository path"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Build call graphs from indexed code"""
    try:
        await call_graph_analyzer.build_graphs(repo_path)
        
        stats = await call_graph_analyzer.get_graph_statistics()
        
        return {
            "status": "success",
            "message": "Call graphs built successfully",
            "statistics": stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Call graph building failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/call-graph/element/{element_id}/context", summary="Get element context")
async def get_element_context(
    element_id: str,
    max_hops: int = Query(5, description="Maximum hops"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get expanded context for a code element"""
    try:
        context = await call_graph_analyzer.get_related_context(element_id, max_hops)
        
        return {
            "element_id": element_id,
            "max_hops": max_hops,
            "context": [asdict(node) for node in context],
            "total_found": len(context),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get element context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/call-graph/element/{element_id}/callers", summary="Get element callers")
async def get_element_callers(
    element_id: str,
    max_depth: int = Query(3, description="Maximum depth"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get all functions that call the given element"""
    try:
        callers = await call_graph_analyzer.get_callers(element_id, max_depth)
        
        return {
            "element_id": element_id,
            "max_depth": max_depth,
            "callers": [asdict(caller) for caller in callers],
            "total_found": len(callers),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get element callers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/call-graph/element/{element_id}/callees", summary="Get element callees")
async def get_element_callees(
    element_id: str,
    max_depth: int = Query(3, description="Maximum depth"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get all functions called by the given element"""
    try:
        callees = await call_graph_analyzer.get_callees(element_id, max_depth)
        
        return {
            "element_id": element_id,
            "max_depth": max_depth,
            "callees": [asdict(callee) for callee in callees],
            "total_found": len(callees),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get element callees: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Intelligent Context Engine Endpoints
@router.post("/context/query", summary="Query intelligent context")
async def query_intelligent_context(
    request: ContextQueryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Query the intelligent context engine"""
    try:
        result = await intelligent_context_engine.query_context(
            request.query,
            max_results=request.max_results,
            max_hops=request.max_hops,
            context_types=[ContextType(ct) for ct in request.context_types] if request.context_types else None,
            include_code_context=request.include_code_context,
            include_semantic_search=request.include_semantic_search
        )
        
        return {
            "query": result.query.query,
            "intent_type": result.query.intent_type,
            "chunks": [asdict(chunk) for chunk in result.chunks],
            "total_found": result.total_found,
            "search_time_ms": result.search_time_ms,
            "expansion_stats": result.expansion_stats,
            "confidence_score": result.confidence_score,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Context query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/context/summary", summary="Get context summary")
async def get_context_summary(
    query: str = Query(..., description="Query string"),
    max_length: int = Query(500, description="Maximum summary length"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get a concise summary of context for a query"""
    try:
        summary = await intelligent_context_engine.get_context_summary(query, max_length)
        
        return {
            "query": query,
            "summary": summary,
            "max_length": max_length,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Context summary failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Multi-Agent Collaboration Endpoints
@router.post("/agents/register", summary="Register an agent")
async def register_agent(
    request: AgentRegistrationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Register a new agent in the collaboration system"""
    try:
        from src.services.multi_agent_collaboration import Agent
        
        agent = Agent(
            id=f"agent_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(request.name)}",
            name=request.name,
            role=AgentRole(request.role),
            capabilities=request.capabilities,
            status="active",
            last_active=datetime.now(timezone.utc),
            metadata=request.metadata,
            context_sharing_enabled=request.context_sharing_enabled,
            max_concurrent_tasks=request.max_concurrent_tasks
        )
        
        success = await multi_agent_collaboration.register_agent(agent)
        
        if success:
            return {
                "status": "success",
                "agent_id": agent.id,
                "message": f"Agent '{request.name}' registered successfully",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to register agent")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Agent registration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agents", summary="List all agents")
async def list_agents(current_user: Dict[str, Any] = Depends(get_current_user)):
    """List all registered agents"""
    try:
        agents = list(multi_agent_collaboration.agents.values())
        
        return {
            "agents": [asdict(agent) for agent in agents],
            "total_count": len(agents),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to list agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/create", summary="Create collaborative task")
async def create_collaborative_task(
    request: TaskCreationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new collaborative task"""
    try:
        task_id = await multi_agent_collaboration.create_collaborative_task(
            title=request.title,
            description=request.description,
            coordinator_id=request.coordinator_id,
            participants=request.participants,
            priority=request.priority,
            deadline=request.deadline,
            context_requirements=request.context_requirements
        )
        
        if task_id:
            return {
                "status": "success",
                "task_id": task_id,
                "message": f"Task '{request.title}' created successfully",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create task")
            
    except Exception as e:
        logger.error(f"Task creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks", summary="List tasks")
async def list_tasks(
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """List collaborative tasks"""
    try:
        if agent_id:
            tasks = await multi_agent_collaboration.get_agent_tasks(agent_id, TaskStatus(status) if status else None)
        else:
            tasks = list(multi_agent_collaboration.tasks.values())
            if status:
                tasks = [task for task in tasks if task.status.value == status]
        
        return {
            "tasks": [asdict(task) for task in tasks],
            "total_count": len(tasks),
            "agent_id": agent_id,
            "status_filter": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to list tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/context/share", summary="Share context between agents")
async def share_context_between_agents(
    request: ContextShareRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Share context between agents"""
    try:
        share_id = await multi_agent_collaboration.share_context(
            source_agent_id=request.source_agent_id,
            target_agent_ids=request.target_agent_ids,
            context_type=request.context_type,
            content=request.content,
            relevance_score=request.relevance_score,
            expires_hours=request.expires_hours
        )
        
        if share_id:
            return {
                "status": "success",
                "share_id": share_id,
                "message": f"Context shared to {len(request.target_agent_ids)} agents",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to share context")
            
    except Exception as e:
        logger.error(f"Context sharing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agents/{agent_id}/context", summary="Get agent's shared context")
async def get_agent_shared_context(
    agent_id: str,
    context_type: Optional[str] = Query(None, description="Filter by context type"),
    min_relevance: float = Query(0.0, description="Minimum relevance score"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get shared context for an agent"""
    try:
        context_shares = await multi_agent_collaboration.get_shared_context(
            agent_id, context_type, min_relevance
        )
        
        return {
            "agent_id": agent_id,
            "context_type": context_type,
            "min_relevance": min_relevance,
            "context_shares": [asdict(share) for share in context_shares],
            "total_found": len(context_shares),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get agent context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Token Optimization Endpoints
@router.post("/optimize/tokens", summary="Optimize content tokens")
async def optimize_content_tokens(
    request: TokenOptimizationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Optimize content to reduce token usage"""
    try:
        compressed_content, stats = await token_optimizer.optimize_content(
            content=request.content,
            target_tokens=request.target_tokens,
            compression_method=request.compression_method,
            preserve_structure=request.preserve_structure
        )
        
        return {
            "original_content": request.content,
            "compressed_content": compressed_content,
            "statistics": asdict(stats),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Token optimization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize/batch", summary="Batch optimize multiple contents")
async def batch_optimize_content(
    contents: List[str],
    target_tokens_per_item: Optional[int] = Query(None, description="Target tokens per item"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Optimize multiple content items in batch"""
    try:
        results = await token_optimizer.batch_optimize(contents, target_tokens_per_item)
        
        processed_results = []
        for i, (compressed_content, stats) in enumerate(results):
            processed_results.append({
                "index": i,
                "original_content": contents[i],
                "compressed_content": compressed_content,
                "statistics": asdict(stats)
            })
        
        return {
            "results": processed_results,
            "total_items": len(contents),
            "target_tokens_per_item": target_tokens_per_item,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Batch optimization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/optimize/stats", summary="Get optimization statistics")
async def get_optimization_stats(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get token optimization statistics"""
    try:
        stats = token_optimizer.get_optimization_stats()
        
        return {
            "statistics": stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get optimization stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# System Status and Insights
@router.get("/insights/collaboration", summary="Get collaboration insights")
async def get_collaboration_insights(
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get insights about collaboration patterns"""
    try:
        insights = await multi_agent_collaboration.get_collaboration_insights(agent_id)
        
        return {
            "insights": insights,
            "agent_id": agent_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get collaboration insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup", summary="Clean up expired data")
async def cleanup_expired_data(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Clean up expired data and caches"""
    try:
        await multi_agent_collaboration.cleanup_expired_data()
        intelligent_context_engine.clear_cache()
        token_optimizer.clear_cache()
        
        return {
            "status": "success",
            "message": "Expired data cleanup completed",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health/enhanced", summary="Enhanced health check")
async def enhanced_health_check(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Comprehensive health check for enhanced features"""
    try:
        health_status = {
            "codebase_indexer": "healthy",
            "call_graph_analyzer": "healthy",
            "intelligent_context_engine": "healthy",
            "multi_agent_collaboration": "healthy",
            "token_optimizer": "healthy",
            "database": "healthy"
        }
        
        # Check database connectivity
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute('SELECT 1')
        except Exception:
            health_status["database"] = "unhealthy"
        
        # Check if services are initialized
        if not codebase_indexer.parsers:
            health_status["codebase_indexer"] = "degraded"
        
        if call_graph_analyzer.call_graph.number_of_nodes() == 0:
            health_status["call_graph_analyzer"] = "no_data"
        
        overall_status = "healthy" if all(status == "healthy" for status in health_status.values()) else "degraded"
        
        return {
            "status": overall_status,
            "services": health_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Enhanced health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
