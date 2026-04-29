"""
Enhanced MCP Tools for Advanced VelocityBrain Features
Provides MCP tools for codebase indexing, call graph analysis, multi-agent collaboration, and token optimization
"""

import asyncio
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timezone

from src.services.codebase_indexer import codebase_indexer
from src.services.call_graph_analyzer import call_graph_analyzer
from src.services.intelligent_context_engine import intelligent_context_engine, ContextType
from src.services.multi_agent_collaboration import multi_agent_collaboration, AgentRole, TaskStatus
from src.services.token_optimizer import token_optimizer
from src.core.logging_config import get_logger

logger = get_logger('enhanced_mcp_tools')


async def index_repository_tool(repo_path: str, force_reindex: bool = False, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Index a repository with tree-sitter parsing"""
    try:
        result = await codebase_indexer.index_repository(repo_path, force_reindex)
        
        return {
            "status": result.get('status', 'unknown'),
            "repository_path": result.get('repository_path'),
            "files_processed": result.get('files_processed', 0),
            "elements_indexed": result.get('elements_indexed', 0),
            "relationships_found": result.get('relationships_found', 0),
            "duration_seconds": result.get('duration_seconds', 0),
            "timestamp": result.get('timestamp'),
            "message": f"Indexed {result.get('files_processed', 0)} files with {result.get('elements_indexed', 0)} elements"
        }
        
    except Exception as e:
        logger.error(f"Repository indexing MCP tool failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "message": f"Failed to index repository: {e}"
        }


async def search_code_elements_tool(query: str, language: Optional[str] = None, 
                                   element_type: Optional[str] = None, 
                                   limit: int = 20, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Search for code elements"""
    try:
        results = await codebase_indexer.search_elements(query, language, element_type, limit)
        
        # Format results for better MCP consumption
        formatted_results = []
        for result in results:
            formatted_result = {
                "id": result.get('id'),
                "name": result.get('name'),
                "type": result.get('type'),
                "language": result.get('language'),
                "file_path": result.get('file_path'),
                "location": f"{result.get('file_path', '')}:{result.get('start_line', '')}",
                "signature": result.get('signature'),
                "docstring": result.get('docstring'),
                "metadata": result.get('metadata', {})
            }
            formatted_results.append(formatted_result)
        
        return {
            "query": query,
            "language": language,
            "element_type": element_type,
            "results": formatted_results,
            "total_found": len(formatted_results),
            "message": f"Found {len(formatted_results)} code elements matching '{query}'"
        }
        
    except Exception as e:
        logger.error(f"Code search MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to search code elements: {e}",
            "results": []
        }


async def get_code_context_tool(element_id: str, max_hops: int = 3, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Get expanded context for a code element"""
    try:
        context_nodes = await call_graph_analyzer.get_related_context(element_id, max_hops)
        
        # Format context nodes
        formatted_context = []
        for node in context_nodes:
            formatted_node = {
                "element_id": node.element_id,
                "name": node.name,
                "type": node.type,
                "file_path": node.file_path,
                "relevance_score": node.relevance_score,
                "relationship_path": node.relationship_path,
                "hops": len(node.relationship_path) - 1,
                "metadata": node.metadata
            }
            formatted_context.append(formatted_node)
        
        return {
            "element_id": element_id,
            "max_hops": max_hops,
            "context": formatted_context,
            "total_found": len(formatted_context),
            "message": f"Found {len(formatted_context)} related elements within {max_hops} hops"
        }
        
    except Exception as e:
        logger.error(f"Code context MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to get code context: {e}",
            "context": []
        }


async def analyze_call_paths_tool(source_id: str, target_id: str, max_depth: int = 5, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Find call paths between functions"""
    try:
        call_paths = await call_graph_analyzer.find_call_paths(source_id, target_id, max_depth)
        
        # Format call paths
        formatted_paths = []
        for path in call_paths:
            formatted_path = {
                "source": path.source,
                "target": path.target,
                "path": path.path,
                "depth": path.depth,
                "confidence": path.confidence,
                "context": path.context
            }
            formatted_paths.append(formatted_path)
        
        return {
            "source_id": source_id,
            "target_id": target_id,
            "max_depth": max_depth,
            "call_paths": formatted_paths,
            "total_paths": len(formatted_paths),
            "message": f"Found {len(formatted_paths)} call paths from {source_id} to {target_id}"
        }
        
    except Exception as e:
        logger.error(f"Call path analysis MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to analyze call paths: {e}",
            "call_paths": []
        }


async def query_intelligent_context_tool(query: str, max_results: int = 20, max_hops: int = 3,
                                       context_types: Optional[List[str]] = None,
                                       include_code_context: bool = True,
                                       include_semantic_search: bool = True, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Query the intelligent context engine"""
    try:
        # Convert context types strings to enums
        context_type_enums = None
        if context_types:
            context_type_enums = []
            for ct in context_types:
                try:
                    context_type_enums.append(ContextType(ct))
                except ValueError:
                    logger.warning(f"Invalid context type: {ct}")
        
        result = await intelligent_context_engine.query_context(
            query,
            max_results=max_results,
            max_hops=max_hops,
            context_types=context_type_enums,
            include_code_context=include_code_context,
            include_semantic_search=include_semantic_search
        )
        
        # Format chunks for MCP consumption
        formatted_chunks = []
        for chunk in result.chunks:
            formatted_chunk = {
                "id": chunk.id,
                "content": chunk.content,
                "context_type": chunk.context_type.value,
                "source": chunk.source,
                "relevance_score": chunk.relevance_score,
                "metadata": chunk.metadata
            }
            formatted_chunks.append(formatted_chunk)
        
        return {
            "query": result.query.query,
            "intent_type": result.query.intent_type,
            "chunks": formatted_chunks,
            "total_found": result.total_found,
            "search_time_ms": result.search_time_ms,
            "expansion_stats": result.expansion_stats,
            "confidence_score": result.confidence_score,
            "message": f"Found {result.total_found} context chunks for query '{query}'"
        }
        
    except Exception as e:
        logger.error(f"Intelligent context query MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to query intelligent context: {e}",
            "chunks": []
        }


async def get_context_summary_tool(query: str, max_length: int = 300, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Get a concise summary of context for a query"""
    try:
        summary = await intelligent_context_engine.get_context_summary(query, max_length)
        
        return {
            "query": query,
            "summary": summary,
            "max_length": max_length,
            "actual_length": len(summary),
            "message": f"Generated {len(summary)} character summary for query '{query}'"
        }
        
    except Exception as e:
        logger.error(f"Context summary MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to generate context summary: {e}",
            "summary": ""
        }


async def register_agent_tool(name: str, role: str, capabilities: Optional[List[str]] = None,
                            context_sharing_enabled: bool = True, 
                            max_concurrent_tasks: int = 3, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Register a new agent in the collaboration system"""
    try:
        from src.services.multi_agent_collaboration import Agent
        
        agent = Agent(
            id=f"agent_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(name)}",
            name=name,
            role=AgentRole(role),
            capabilities=capabilities or [],
            status="active",
            last_active=datetime.now(timezone.utc),
            metadata={},
            context_sharing_enabled=context_sharing_enabled,
            max_concurrent_tasks=max_concurrent_tasks
        )
        
        success = await multi_agent_collaboration.register_agent(agent)
        
        if success:
            return {
                "status": "success",
                "agent_id": agent.id,
                "name": agent.name,
                "role": agent.role.value,
                "capabilities": agent.capabilities,
                "message": f"Agent '{name}' registered successfully with ID {agent.id}"
            }
        else:
            return {
                "status": "error",
                "message": "Failed to register agent"
            }
            
    except ValueError as e:
        return {
            "status": "error",
            "error": str(e),
            "message": f"Invalid agent configuration: {e}"
        }
    except Exception as e:
        logger.error(f"Agent registration MCP tool failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "message": f"Failed to register agent: {e}"
        }


async def create_collaborative_task_tool(title: str, description: str, coordinator_id: str,
                                       participants: List[str], priority: int = 5,
                                       context_requirements: Optional[List[str]] = None, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Create a collaborative task"""
    try:
        task_id = await multi_agent_collaboration.create_collaborative_task(
            title=title,
            description=description,
            coordinator_id=coordinator_id,
            participants=participants,
            priority=priority,
            context_requirements=context_requirements
        )
        
        if task_id:
            return {
                "status": "success",
                "task_id": task_id,
                "title": title,
                "coordinator_id": coordinator_id,
                "participants": participants,
                "priority": priority,
                "message": f"Task '{title}' created successfully with ID {task_id}"
            }
        else:
            return {
                "status": "error",
                "message": "Failed to create collaborative task"
            }
            
    except Exception as e:
        logger.error(f"Task creation MCP tool failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "message": f"Failed to create task: {e}"
        }


async def share_context_tool(source_agent_id: str, target_agent_ids: List[str],
                           context_type: str, content: Dict[str, Any],
                           relevance_score: float = 1.0,
                           expires_hours: Optional[int] = None, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Share context between agents"""
    try:
        share_id = await multi_agent_collaboration.share_context(
            source_agent_id=source_agent_id,
            target_agent_ids=target_agent_ids,
            context_type=context_type,
            content=content,
            relevance_score=relevance_score,
            expires_hours=expires_hours
        )
        
        if share_id:
            return {
                "status": "success",
                "share_id": share_id,
                "source_agent_id": source_agent_id,
                "target_agent_ids": target_agent_ids,
                "context_type": context_type,
                "relevance_score": relevance_score,
                "message": f"Context shared from {source_agent_id} to {len(target_agent_ids)} agents"
            }
        else:
            return {
                "status": "error",
                "message": "Failed to share context"
            }
            
    except Exception as e:
        logger.error(f"Context sharing MCP tool failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "message": f"Failed to share context: {e}"
        }


async def get_agent_context_tool(agent_id: str, context_type: Optional[str] = None,
                                min_relevance: float = 0.0, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Get shared context for an agent"""
    try:
        context_shares = await multi_agent_collaboration.get_shared_context(
            agent_id, context_type, min_relevance
        )
        
        # Format context shares
        formatted_shares = []
        for share in context_shares:
            formatted_share = {
                "id": share.id,
                "source_agent_id": share.source_agent_id,
                "context_type": share.context_type,
                "content": share.content,
                "relevance_score": share.relevance_score,
                "created_at": share.created_at.isoformat(),
                "access_count": share.access_count
            }
            formatted_shares.append(formatted_share)
        
        return {
            "agent_id": agent_id,
            "context_type": context_type,
            "min_relevance": min_relevance,
            "context_shares": formatted_shares,
            "total_found": len(formatted_shares),
            "message": f"Found {len(formatted_shares)} context shares for agent {agent_id}"
        }
        
    except Exception as e:
        logger.error(f"Agent context retrieval MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to get agent context: {e}",
            "context_shares": []
        }


async def optimize_tokens_tool(content: str, target_tokens: Optional[int] = None,
                             compression_method: Optional[str] = None,
                             preserve_structure: bool = True, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Optimize content to reduce token usage"""
    try:
        compressed_content, stats = await token_optimizer.optimize_content(
            content=content,
            target_tokens=target_tokens,
            compression_method=compression_method,
            preserve_structure=preserve_structure
        )
        
        return {
            "original_content": content,
            "compressed_content": compressed_content,
            "original_tokens": stats.original_tokens,
            "compressed_tokens": stats.compressed_tokens,
            "compression_ratio": stats.compression_ratio,
            "compression_time_ms": stats.compression_time_ms,
            "quality_score": stats.quality_score,
            "method_used": stats.method_used,
            "token_reduction": stats.original_tokens - stats.compressed_tokens,
            "message": f"Reduced content from {stats.original_tokens} to {stats.compressed_tokens} tokens ({stats.compression_ratio:.2f} ratio)"
        }
        
    except Exception as e:
        logger.error(f"Token optimization MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to optimize tokens: {e}",
            "compressed_content": content,
            "original_tokens": len(content.split()),
            "compressed_tokens": len(content.split()),
            "compression_ratio": 1.0
        }


async def batch_optimize_tool(contents: List[str], target_tokens_per_item: Optional[int] = None, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Optimize multiple content items in batch"""
    try:
        results = await token_optimizer.batch_optimize(contents, target_tokens_per_item)
        
        formatted_results = []
        total_original_tokens = 0
        total_compressed_tokens = 0
        
        for i, (compressed_content, stats) in enumerate(results):
            result_item = {
                "index": i,
                "original_content": contents[i],
                "compressed_content": compressed_content,
                "original_tokens": stats.original_tokens,
                "compressed_tokens": stats.compressed_tokens,
                "compression_ratio": stats.compression_ratio,
                "quality_score": stats.quality_score,
                "method_used": stats.method_used
            }
            formatted_results.append(result_item)
            total_original_tokens += stats.original_tokens
            total_compressed_tokens += stats.compressed_tokens
        
        overall_ratio = total_compressed_tokens / total_original_tokens if total_original_tokens > 0 else 1.0
        
        return {
            "results": formatted_results,
            "total_items": len(contents),
            "total_original_tokens": total_original_tokens,
            "total_compressed_tokens": total_compressed_tokens,
            "overall_compression_ratio": overall_ratio,
            "total_token_reduction": total_original_tokens - total_compressed_tokens,
            "message": f"Batch optimized {len(contents)} items, overall compression ratio: {overall_ratio:.2f}"
        }
        
    except Exception as e:
        logger.error(f"Batch optimization MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to batch optimize: {e}",
            "results": []
        }


async def get_collaboration_insights_tool(agent_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Get insights about collaboration patterns"""
    try:
        insights = await multi_agent_collaboration.get_collaboration_insights(agent_id)
        
        return {
            "insights": insights,
            "agent_id": agent_id,
            "message": f"Retrieved collaboration insights{' for agent ' + agent_id if agent_id else ''}"
        }
        
    except Exception as e:
        logger.error(f"Collaboration insights MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to get collaboration insights: {e}",
            "insights": {}
        }


async def analyze_function_complexity_tool(element_id: str, **kwargs) -> Dict[str, Any]:
    """MCP Tool: Analyze complexity metrics for a function"""
    try:
        complexity = await call_graph_analyzer.analyze_function_complexity(element_id)
        
        if 'error' in complexity:
            return {
                "error": complexity['error'],
                "message": f"Failed to analyze function complexity: {complexity['error']}"
            }
        
        return {
            "element_id": element_id,
            "function_name": complexity.get('function_name'),
            "cyclomatic_complexity": complexity.get('cyclomatic_complexity'),
            "fan_in": complexity.get('fan_in'),
            "fan_out": complexity.get('fan_out'),
            "max_call_depth": complexity.get('max_call_depth'),
            "total_callees": complexity.get('total_callees'),
            "total_callers": complexity.get('total_callers'),
            "complexity_score": complexity.get('complexity_score'),
            "message": f"Analyzed complexity for function {complexity.get('function_name', element_id)}"
        }
        
    except Exception as e:
        logger.error(f"Function complexity analysis MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to analyze function complexity: {e}"
        }


async def get_optimization_stats_tool(**kwargs) -> Dict[str, Any]:
    """MCP Tool: Get token optimization statistics"""
    try:
        stats = token_optimizer.get_optimization_stats()
        
        return {
            "statistics": stats,
            "message": "Retrieved token optimization statistics"
        }
        
    except Exception as e:
        logger.error(f"Optimization stats MCP tool failed: {e}")
        return {
            "error": str(e),
            "message": f"Failed to get optimization stats: {e}",
            "statistics": {}
        }


# Registry of enhanced MCP tools
ENHANCED_MCP_TOOLS = {
    "index_repository": index_repository_tool,
    "search_code_elements": search_code_elements_tool,
    "get_code_context": get_code_context_tool,
    "analyze_call_paths": analyze_call_paths_tool,
    "query_intelligent_context": query_intelligent_context_tool,
    "get_context_summary": get_context_summary_tool,
    "register_agent": register_agent_tool,
    "create_collaborative_task": create_collaborative_task_tool,
    "share_context": share_context_tool,
    "get_agent_context": get_agent_context_tool,
    "optimize_tokens": optimize_tokens_tool,
    "batch_optimize": batch_optimize_tool,
    "get_collaboration_insights": get_collaboration_insights_tool,
    "analyze_function_complexity": analyze_function_complexity_tool,
    "get_optimization_stats": get_optimization_stats_tool,
}


async def call_enhanced_mcp_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """Call an enhanced MCP tool by name"""
    if tool_name not in ENHANCED_MCP_TOOLS:
        return {
            "error": f"Unknown tool: {tool_name}",
            "message": f"Tool '{tool_name}' not found in enhanced MCP tools registry"
        }
    
    try:
        tool_func = ENHANCED_MCP_TOOLS[tool_name]
        result = await tool_func(**kwargs)
        
        # Add tool metadata
        result["tool_name"] = tool_name
        result["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        return result
        
    except Exception as e:
        logger.error(f"Enhanced MCP tool '{tool_name}' execution failed: {e}")
        return {
            "tool_name": tool_name,
            "error": str(e),
            "message": f"Tool execution failed: {e}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def list_enhanced_mcp_tools() -> List[Dict[str, Any]]:
    """List all available enhanced MCP tools"""
    tools = []
    
    for tool_name, tool_func in ENHANCED_MCP_TOOLS.items():
        # Get tool description from docstring
        description = tool_func.__doc__ or "No description available"
        description = description.strip().replace("MCP Tool: ", "")
        
        tools.append({
            "name": tool_name,
            "description": description,
            "type": "enhanced"
        })
    
    return tools
