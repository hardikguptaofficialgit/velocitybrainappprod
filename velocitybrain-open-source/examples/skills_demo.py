#!/usr/bin/env python3
"""
VelocityBrain Skills Framework Demo

This example demonstrates the skills framework functionality.
"""

import asyncio
from src.skills.registry import SkillRegistry
from src.skills.examples.summarize_skill import SummarizeSkill
from src.skills.examples.extract_skill import ExtractSkill
from src.skills.examples.translate_skill import TranslateSkill


async def main():
    """Demonstrate VelocityBrain skills framework."""
    
    print("🛠️  VelocityBrain Skills Framework Demo")
    print("=" * 40)
    
    # Create skill registry
    registry = SkillRegistry()
    
    # Register example skills
    print("\n📝 Registering skills...")
    registry.register_skill(SummarizeSkill())
    registry.register_skill(ExtractSkill())
    registry.register_skill(TranslateSkill())
    
    # List available skills
    print("\n📋 Available Skills:")
    skills = registry.list_skills()
    for skill in skills:
        print(f"  • {skill['name']} - {skill['description']}")
        print(f"    Category: {skill['category']}, Tier: {skill['required_tier']}")
    
    # Demo content
    sample_text = """
    John Smith met with Sarah Johnson from Acme Corporation on January 15, 2024.
    They discussed the new AI project timeline and budget allocation.
    John can be reached at john.smith@company.com or 555-123-4567.
    Sarah's email is sarah.j@acme.com. The project deadline is March 30, 2024.
    More information is available at https://project.company.com/ai-timeline.
    """
    
    print(f"\n📄 Sample Text:")
    print(sample_text.strip())
    
    # Test summarize skill
    print("\n🔍 Testing Summarize Skill:")
    try:
        result = await registry.execute_skill(
            skill_name="summarize",
            parameters={
                "text": sample_text,
                "style": "bullets",
                "max_length": 30
            },
            response_style="normal"
        )
        
        if result['success']:
            print("✅ Summary:")
            print(result['result']['summary'])
            print(f"Compression ratio: {result['result']['compression_ratio']:.2f}")
        else:
            print(f"❌ Failed: {result['message']}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test extract skill
    print("\n🔍 Testing Extract Skill:")
    try:
        result = await registry.execute_skill(
            skill_name="extract",
            parameters={
                "text": sample_text,
                "extract_types": ["names", "emails", "dates", "urls", "phone_numbers"],
                "format": "json"
            },
            response_style="normal"
        )
        
        if result['success']:
            print("✅ Extracted Information:")
            extracted = result['result']['extracted_data']
            for key, values in extracted.items():
                if values:
                    print(f"  {key.title()}: {', '.join(values)}")
            print(f"Total extractions: {result['result']['total_extractions']}")
        else:
            print(f"❌ Failed: {result['message']}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test translate skill (requires pro tier)
    print("\n🔍 Testing Translate Skill:")
    try:
        result = await registry.execute_skill(
            skill_name="translate",
            parameters={
                "text": "Hello, this is a test of the translation system.",
                "from_language": "en",
                "to_language": "es",
                "preserve_formatting": True
            },
            response_style="normal",
            user_tier="pro"  # Use pro tier for translation
        )
        
        if result['success']:
            print("✅ Translation:")
            translation = result['result']['translation']
            print(f"Original: {translation['original_text']}")
            print(f"Translated: {translation['translated_text']}")
            print(f"From: {translation['from_language_name']} → To: {translation['to_language_name']}")
        else:
            print(f"❌ Failed: {result['message']}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test tier restrictions
    print("\n🔍 Testing Tier Restrictions:")
    try:
        result = await registry.execute_skill(
            skill_name="translate",
            parameters={
                "text": "Test translation",
                "to_language": "es"
            },
            response_style="normal",
            user_tier="free"  # Try with free tier
        )
        
        if not result['success']:
            print(f"✅ Correctly blocked free tier: {result['message']}")
        else:
            print("❌ Should have blocked free tier")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n🎉 Skills demo completed!")


if __name__ == "__main__":
    asyncio.run(main())
