"""
VelocityBrain Open-Source CLI

Command-line interface for VelocityBrain client SDK.
"""

import argparse
import sys
import json
from typing import Optional, Dict, Any
from pathlib import Path

# Import client SDK
from src.client import VelocityBrainClient
from src.client.exceptions import VelocityBrainError, AuthenticationError, RateLimitError


def load_config() -> Dict[str, Any]:
    """Load configuration from environment or config file."""
    import os
    
    # Try to get API key from environment
    api_key = os.getenv("VELOCITYBRAIN_API_KEY")
    
    # If not found, try to load from config file
    if not api_key:
        config_path = Path.home() / ".velocitybrain" / "config.json"
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = json.load(f)
                api_key = config.get("api_key")
    
    if not api_key:
        print("Error: VelocityBrain API key not found.")
        print("Set VELOCITYBRAIN_API_KEY environment variable or create ~/.velocitybrain/config.json")
        sys.exit(1)
    
    base_url = os.getenv("VELOCITYBRAIN_BASE_URL", "https://api.velocitybrain.ai")
    
    return {
        "api_key": api_key,
        "base_url": base_url
    }


def cmd_query(args):
    """Handle query command."""
    try:
        config = load_config()
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            result = client.query(
                question=args.question,
                response_style=args.style,
                max_results=args.max_results
            )
            
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(f"Question: {result['question']}")
                print(f"Answer: {result['answer']}")
                print(f"Confidence: {result['confidence']:.2f}")
                if result.get('sources'):
                    print("Sources:")
                    for source in result['sources']:
                        print(f"  - {source.get('title', 'Unknown')}")
                        
    except VelocityBrainError as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_ingest(args):
    """Handle ingest command."""
    try:
        config = load_config()
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            
            if args.file:
                # Ingest file
                result = client.ingest_file(
                    file_path=args.file,
                    source=args.source,
                    metadata=json.loads(args.metadata) if args.metadata else None,
                    tags=args.tags.split(',') if args.tags else None
                )
            else:
                # Ingest text content
                content = args.content if args.content else sys.stdin.read()
                result = client.ingest(
                    content=content,
                    source=args.source,
                    metadata=json.loads(args.metadata) if args.metadata else None,
                    tags=args.tags.split(',') if args.tags else None
                )
            
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(f"✓ {result['message']}")
                print(f"Document ID: {result['document_id']}")
                
    except VelocityBrainError as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_run(args):
    """Handle run command."""
    try:
        config = load_config()
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            result = client.run(
                task=args.task,
                response_style=args.style,
                context=json.loads(args.context) if args.context else None
            )
            
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(f"Task: {result['task']}")
                print(f"Result: {result['result']}")
                print(f"Confidence: {result['confidence']:.2f}")
                
    except VelocityBrainError as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_skills(args):
    """Handle skills command."""
    try:
        config = load_config()
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            if args.list:
                result = client.list_skills(category=args.category)
                
                if args.json:
                    print(json.dumps(result, indent=2))
                else:
                    print(f"Available Skills ({result['total']}):")
                    for skill in result['skills']:
                        print(f"  • {skill['name']} - {skill['description']}")
                        print(f"    Category: {skill['category']}, Tier: {skill['required_tier']}")
                        
            elif args.execute:
                # Execute skill
                params = json.loads(args.parameters) if args.parameters else {}
                result = client.execute_skill(
                    skill_name=args.execute,
                    parameters=params,
                    response_style=args.style
                )
                
                if args.json:
                    print(json.dumps(result, indent=2))
                else:
                    print(f"Skill: {result['skill_name']}")
                    print(f"Success: {result['success']}")
                    print(f"Result: {result['result']}")
                    
    except VelocityBrainError as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_status(args):
    """Handle status command."""
    try:
        config = load_config()
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            if args.health:
                result = client.get_health()
            else:
                result = client.get_status()
            
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(f"Status: {result['status']}")
                if 'version' in result:
                    print(f"Version: {result['version']}")
                if 'uptime' in result:
                    print(f"Uptime: {result['uptime']:.2f}s")
                    
    except VelocityBrainError as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_config(args):
    """Handle configuration."""
    if args.show:
        config = load_config()
        print("Current Configuration:")
        print(f"  Base URL: {config['base_url']}")
        print(f"  API Key: {'*' * 20}{config['api_key'][-8:]}")
    elif args.set_key:
        # Save API key to config file
        config_dir = Path.home() / ".velocitybrain"
        config_dir.mkdir(exist_ok=True)
        
        config_path = config_dir / "config.json"
        config = {"api_key": args.set_key}
        
        if args.base_url:
            config["base_url"] = args.base_url
        
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"✓ Configuration saved to {config_path}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="VelocityBrain Open-Source CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  velocitybrain query "What do I know about AI?"
  velocitybrain ingest --content "Meeting notes..."
  velocitybrain ingest --file notes.txt --source meeting
  velocitybrain run "Prepare summary of recent activities"
  velocitybrain skills --list
  velocitybrain skills --execute summarize --parameters '{"text": "Long text..."}'
  velocitybrain status --health
        """
    )
    
    parser.add_argument("--json", action="store_true", help="Output JSON format")
    parser.add_argument("--style", choices=["normal", "lite", "full", "ultra"], 
                       default="normal", help="Response style")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Query command
    query_parser = subparsers.add_parser("query", help="Query VelocityBrain")
    query_parser.add_argument("question", help="Question to ask")
    query_parser.add_argument("--max-results", type=int, default=10, 
                             help="Maximum number of results")
    query_parser.set_defaults(func=cmd_query)
    
    # Ingest command
    ingest_parser = subparsers.add_parser("ingest", help="Ingest content")
    ingest_group = ingest_parser.add_mutually_exclusive_group(required=True)
    ingest_group.add_argument("--content", help="Text content to ingest")
    ingest_group.add_argument("--file", help="File path to ingest")
    ingest_parser.add_argument("--source", default="note", help="Source identifier")
    ingest_parser.add_argument("--metadata", help="JSON metadata")
    ingest_parser.add_argument("--tags", help="Comma-separated tags")
    ingest_parser.set_defaults(func=cmd_ingest)
    
    # Run command
    run_parser = subparsers.add_parser("run", help="Run agent task")
    run_parser.add_argument("task", help="Task to execute")
    run_parser.add_argument("--context", help="JSON context")
    run_parser.set_defaults(func=cmd_run)
    
    # Skills command
    skills_parser = subparsers.add_parser("skills", help="Manage skills")
    skills_group = skills_parser.add_mutually_exclusive_group(required=True)
    skills_group.add_argument("--list", action="store_true", help="List available skills")
    skills_group.add_argument("--execute", help="Execute specific skill")
    skills_parser.add_argument("--category", help="Filter by category")
    skills_parser.add_argument("--parameters", help="JSON parameters for skill execution")
    skills_parser.set_defaults(func=cmd_skills)
    
    # Status command
    status_parser = subparsers.add_parser("status", help="Get system status")
    status_parser.add_argument("--health", action="store_true", help="Health check")
    status_parser.set_defaults(func=cmd_status)
    
    # Config command
    config_parser = subparsers.add_parser("config", help="Manage configuration")
    config_group = config_parser.add_mutually_exclusive_group(required=True)
    config_group.add_argument("--show", action="store_true", help="Show current config")
    config_group.add_argument("--set-key", help="Set API key")
    config_parser.add_argument("--base-url", help="Set base URL")
    config_parser.set_defaults(func=cmd_config)
    
    # Parse arguments
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Execute command
    args.func(args)


if __name__ == "__main__":
    main()
