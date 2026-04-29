#!/usr/bin/env python3
"""
VelocityBrain Client SDK - Basic Usage Example

This example demonstrates basic usage of the VelocityBrain client SDK.
"""

import os
import asyncio
from src.client import VelocityBrainClient
from src.client.exceptions import VelocityBrainError


async def main():
    """Demonstrate basic VelocityBrain client usage."""
    
    # Get API key from environment
    api_key = os.getenv("VELOCITYBRAIN_API_KEY")
    if not api_key:
        print("Error: VELOCITYBRAIN_API_KEY environment variable is required")
        print("Get your API key at https://velocitybrain.ai")
        return
    
    base_url = os.getenv("VELOCITYBRAIN_BASE_URL", "https://api.velocitybrain.ai")
    
    print("  VelocityBrain Client SDK - Basic Usage Example")
    print("=" * 50)
    
    try:
        # Initialize client
        print("\n📡 Connecting to VelocityBrain...")
        async with VelocityBrainClient(api_key, base_url) as client:
            print("✅ Connected successfully!")
            
            # Check system health
            print("\n🏥 Checking system health...")
            health = await client.get_health()
            print(f"Status: {health['status']}")
            print(f"Version: {health.get('version', 'Unknown')}")
            
            # Ingest some content
            print("\n📥 Ingesting content...")
            content = """
            # AI Project Meeting Notes
            
            Date: 2024-01-15
            Attendees: Alice, Bob, Charlie
            
            ## Discussion Topics
            1. Project timeline review
            2. Budget allocation
            3. Technical architecture decisions
            
            ## Key Decisions
            - Adopt microservices architecture
            - Use React for frontend
            - Implement CI/CD pipeline
            - Budget increased by 20%
            
            ## Action Items
            - Alice: Setup development environment
            - Bob: Create technical documentation
            - Charlie: Review and approve budget
            """
            
            ingest_result = await client.ingest(
                content=content,
                source="meeting_notes",
                tags=["meeting", "project", "ai"],
                metadata={"date": "2024-01-15", "attendees": 3}
            )
            print(f"✅ Content ingested with ID: {ingest_result['document_id']}")
            
            # Query the memory
            print("\n🔍 Querying memory...")
            query_result = await client.query(
                question="What decisions were made about the AI project?",
                response_style="normal",
                max_results=5
            )
            
            print(f"Question: {query_result['question']}")
            print(f"Answer: {query_result['answer']}")
            print(f"Confidence: {query_result['confidence']:.2f}")
            
            # List available skills
            print("\n🛠️  Listing available skills...")
            skills_result = await client.list_skills()
            print(f"Found {skills_result['total']} skills:")
            for skill in skills_result['skills'][:3]:  # Show first 3
                print(f"  • {skill['name']} - {skill['description']}")
                print(f"    Category: {skill['category']}, Tier: {skill['required_tier']}")
            
            # Execute a skill
            print("\n  Executing summarize skill...")
            skill_result = await client.execute_skill(
                skill_name="summarize",
                parameters={
                    "text": content,
                    "style": "bullets",
                    "max_length": 50
                },
                response_style="normal"
            )
            
            if skill_result['success']:
                print("✅ Skill executed successfully!")
                print(f"Summary: {skill_result['result']['summary']}")
            else:
                print(f"❌ Skill execution failed: {skill_result['message']}")
            
            # Run an agent task
            print("\n🤖 Running agent task...")
            task_result = await client.run(
                task="Prepare a brief summary of the AI project meeting",
                response_style="lite"
            )
            
            print(f"Task: {task_result['task']}")
            print(f"Result: {task_result['result']}")
            print(f"Confidence: {task_result['confidence']:.2f}")
            
            # Get usage statistics
            print("\n📊 Getting usage statistics...")
            usage = await client.get_usage_stats()
            print(f"API calls today: {usage['api_calls_today']}")
            print(f"Documents ingested: {usage['documents_ingested']}")
            print(f"Queries executed: {usage['queries_executed']}")
            
            print("\n🎉 Example completed successfully!")
            
    except VelocityBrainError as e:
        print(f"❌ VelocityBrain Error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
