"""
VelocityBrain MCP Server

Model Context Protocol server implementation for VelocityBrain.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import (
    Resource, Tool, TextContent, ImageContent, EmbeddedResource,
    CallToolRequest, GetResourceRequest, ListResourcesRequest, ListToolsRequest
)

from src.client import VelocityBrainClient
from src.client.exceptions import VelocityBrainError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("velocitybrain.mcp")

# Initialize MCP server
server = Server("velocitybrain")

# Global client instance
client: Optional[VelocityBrainClient] = None


def get_client() -> VelocityBrainClient:
    """Get or create VelocityBrain client."""
    global client
    if client is None:
        import os
        
        api_key = os.getenv("VELOCITYBRAIN_API_KEY")
        if not api_key:
            raise ValueError("VELOCITYBRAIN_API_KEY environment variable is required")
        
        base_url = os.getenv("VELOCITYBRAIN_BASE_URL", "https://api.velocitybrain.ai")
        
        client = VelocityBrainClient(api_key, base_url)
        logger.info("VelocityBrain client initialized")
    
    return client


@server.list_tools()
async def handle_list_tools() -> List[Tool]:
    """List available MCP tools."""
    return [
        Tool(
            name="query",
            description="Query VelocityBrain memory system",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "Question to ask VelocityBrain"
                    },
                    "response_style": {
                        "type": "string",
                        "enum": ["normal", "lite", "full", "ultra"],
                        "default": "normal",
                        "description": "Response style"
                    },
                    "max_results": {
                        "type": "integer",
                        "default": 10,
                        "minimum": 1,
                        "maximum": 100,
                        "description": "Maximum number of results"
                    }
                },
                "required": ["question"]
            }
        ),
        Tool(
            name="ingest_text",
            description="Ingest text content into VelocityBrain",
            inputSchema={
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "Text content to ingest"
                    },
                    "source": {
                        "type": "string",
                        "default": "note",
                        "description": "Source identifier"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Optional metadata"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional tags"
                    }
                },
                "required": ["content"]
            }
        ),
        Tool(
            name="run_agent",
            description="Run an agent task with VelocityBrain",
            inputSchema={
                "type": "object",
                "properties": {
                    "task": {
                        "type": "string",
                        "description": "Task to execute"
                    },
                    "response_style": {
                        "type": "string",
                        "enum": ["normal", "lite", "full", "ultra"],
                        "default": "normal",
                        "description": "Response style"
                    },
                    "context": {
                        "type": "object",
                        "description": "Optional context for the task"
                    }
                },
                "required": ["task"]
            }
        ),
        Tool(
            name="execute_skill",
            description="Execute a specific VelocityBrain skill",
            inputSchema={
                "type": "object",
                "properties": {
                    "skill_name": {
                        "type": "string",
                        "description": "Name of the skill to execute"
                    },
                    "parameters": {
                        "type": "object",
                        "description": "Parameters for the skill"
                    },
                    "response_style": {
                        "type": "string",
                        "enum": ["normal", "lite", "full", "ultra"],
                        "default": "normal",
                        "description": "Response style"
                    }
                },
                "required": ["skill_name"]
            }
        ),
        Tool(
            name="list_skills",
            description="List available VelocityBrain skills",
            inputSchema={
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Filter by category"
                    }
                }
            }
        ),
        Tool(
            name="healthz",
            description="Check VelocityBrain system health",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """Handle tool calls."""
    try:
        client = get_client()
        
        if name == "query":
            result = client.query(
                question=arguments["question"],
                response_style=arguments.get("response_style", "normal"),
                max_results=arguments.get("max_results", 10)
            )
            
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
        
        elif name == "ingest_text":
            result = client.ingest(
                content=arguments["content"],
                source=arguments.get("source", "note"),
                metadata=arguments.get("metadata"),
                tags=arguments.get("tags")
            )
            
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
        
        elif name == "run_agent":
            result = client.run(
                task=arguments["task"],
                response_style=arguments.get("response_style", "normal"),
                context=arguments.get("context")
            )
            
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
        
        elif name == "execute_skill":
            result = client.execute_skill(
                skill_name=arguments["skill_name"],
                parameters=arguments.get("parameters", {}),
                response_style=arguments.get("response_style", "normal")
            )
            
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
        
        elif name == "list_skills":
            result = client.list_skills(
                category=arguments.get("category")
            )
            
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
        
        elif name == "healthz":
            result = client.get_health()
            
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )]
        
        else:
            raise ValueError(f"Unknown tool: {name}")
            
    except VelocityBrainError as e:
        logger.error(f"Tool error ({name}): {e}")
        return [TextContent(
            type="text",
            text=f"Error: {str(e)}"
        )]
    except Exception as e:
        logger.error(f"Unexpected error ({name}): {e}")
        return [TextContent(
            type="text",
            text=f"Unexpected error: {str(e)}"
        )]


@server.list_resources()
async def handle_list_resources() -> List[Resource]:
    """List available resources."""
    return []


@server.get_resource()
async def handle_get_resource(uri: str) -> str:
    """Get resource content."""
    raise ValueError(f"Resource not found: {uri}")


async def main():
    """Main MCP server entry point."""
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    logger.info("Starting VelocityBrain MCP server")
    
    # Run the server
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="velocitybrain",
                server_version="1.0.0",
                capabilities={
                    "tools": {},
                    "resources": {}
                }
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
