"""
Tests for VelocityBrain Skills Framework
"""

import pytest
import asyncio
from src.skills.registry import SkillRegistry
from src.skills.examples.summarize_skill import SummarizeSkill
from src.skills.examples.extract_skill import ExtractSkill
from src.skills.examples.translate_skill import TranslateSkill


class TestSkillRegistry:
    """Test cases for SkillRegistry."""
    
    def test_registry_initialization(self):
        """Test registry initialization."""
        registry = SkillRegistry()
        assert registry is not None
        assert hasattr(registry, '_skills')
        assert hasattr(registry, '_skill_metadata')
    
    def test_register_skill(self):
        """Test skill registration."""
        registry = SkillRegistry()
        skill = SummarizeSkill()
        
        registry.register_skill(skill)
        
        assert "summarize" in registry._skills
        assert registry._skills["summarize"] == skill
        assert "summarize" in registry._skill_metadata
    
    def test_get_skill(self):
        """Test getting a skill by name."""
        registry = SkillRegistry()
        skill = SummarizeSkill()
        registry.register_skill(skill)
        
        retrieved_skill = registry.get_skill("summarize")
        assert retrieved_skill == skill
        
        # Test non-existent skill
        non_existent = registry.get_skill("non_existent")
        assert non_existent is None
    
    def test_list_skills(self):
        """Test listing skills."""
        registry = SkillRegistry()
        registry.register_skill(SummarizeSkill())
        registry.register_skill(ExtractSkill())
        registry.register_skill(TranslateSkill())
        
        # List all skills
        all_skills = registry.list_skills()
        assert len(all_skills) == 3
        
        skill_names = [skill["name"] for skill in all_skills]
        assert "summarize" in skill_names
        assert "extract" in skill_names
        assert "translate" in skill_names
        
        # List by category
        enrichment_skills = registry.list_skills(category="enrichment")
        assert len(enrichment_skills) == 3  # All example skills are enrichment
        
        # List by tier
        free_skills = registry.list_skills(user_tier="free")
        assert len(free_skills) == 2  # summarize and extract
        
        pro_skills = registry.list_skills(user_tier="pro")
        assert len(pro_skills) == 3  # All skills available to pro
    
    def test_list_categories(self):
        """Test listing categories."""
        registry = SkillRegistry()
        registry.register_skill(SummarizeSkill())
        registry.register_skill(ExtractSkill())
        registry.register_skill(TranslateSkill())
        
        categories = registry.list_categories()
        assert "enrichment" in categories
    
    def test_is_skill_available(self):
        """Test skill availability by tier."""
        registry = SkillRegistry()
        registry.register_skill(SummarizeSkill())  # free tier
        registry.register_skill(TranslateSkill())  # pro tier
        
        # Free tier can access free skill
        assert registry.is_skill_available("summarize", "free") is True
        
        # Free tier cannot access pro skill
        assert registry.is_skill_available("translate", "free") is False
        
        # Pro tier can access both
        assert registry.is_skill_available("summarize", "pro") is True
        assert registry.is_skill_available("translate", "pro") is True
        
        # Non-existent skill
        assert registry.is_skill_available("non_existent", "free") is False


class TestSummarizeSkill:
    """Test cases for SummarizeSkill."""
    
    def test_skill_properties(self):
        """Test skill properties."""
        skill = SummarizeSkill()
        
        assert skill.name == "summarize"
        assert skill.description == "Summarize text content into concise bullet points or paragraphs"
        assert skill.category == "enrichment"
        assert skill.version == "1.0.0"
        assert skill.required_tier == "free"
        assert "summarization" in skill.tags
        assert "nlp" in skill.tags
    
    def test_parameters_schema(self):
        """Test parameters schema."""
        skill = SummarizeSkill()
        schema = skill.parameters_schema
        
        assert schema["type"] == "object"
        assert "text" in schema["properties"]
        assert "text" in schema["required"]
        assert "style" in schema["properties"]
        assert "max_length" in schema["properties"]
        
        # Test parameter validation
        assert skill.validate_parameters({"text": "Test content"}) is True
        
        # Test missing required parameter
        with pytest.raises(ValueError):
            skill.validate_parameters({})
    
    @pytest.mark.asyncio
    async def test_execute_success(self):
        """Test successful skill execution."""
        skill = SummarizeSkill()
        
        long_text = "This is a very long text that should be summarized. " * 20
        
        result = await skill.execute(
            parameters={
                "text": long_text,
                "style": "bullets",
                "max_length": 50
            },
            response_style="normal"
        )
        
        assert result.success is True
        assert "summary" in result.result
        assert result.execution_time > 0
        assert result.confidence > 0
        assert "summarized successfully" in result.message
    
    @pytest.mark.asyncio
    async def test_execute_different_styles(self):
        """Test skill execution with different styles."""
        skill = SummarizeSkill()
        
        text = "This is a test text for summarization."
        
        # Test bullets style
        result_bullets = await skill.execute(
            parameters={"text": text, "style": "bullets"},
            response_style="normal"
        )
        assert result_bullets.success is True
        
        # Test paragraph style
        result_paragraph = await skill.execute(
            parameters={"text": text, "style": "paragraph"},
            response_style="normal"
        )
        assert result_paragraph.success is True
        
        # Test executive style
        result_executive = await skill.execute(
            parameters={"text": text, "style": "executive"},
            response_style="normal"
        )
        assert result_executive.success is True
        assert "Executive Summary" in result_executive.result["summary"]


class TestExtractSkill:
    """Test cases for ExtractSkill."""
    
    def test_skill_properties(self):
        """Test skill properties."""
        skill = ExtractSkill()
        
        assert skill.name == "extract"
        assert "extract" in skill.description.lower()
        assert skill.category == "enrichment"
        assert skill.version == "1.0.0"
        assert skill.required_tier == "free"
        assert "extraction" in skill.tags
        assert "entities" in skill.tags
    
    @pytest.mark.asyncio
    async def test_execute_success(self):
        """Test successful skill execution."""
        skill = ExtractSkill()
        
        text_with_entities = """
        John Smith emailed john.smith@company.com on 01/15/2024.
        Visit https://example.com for more information.
        Call 555-123-4567 for details.
        """
        
        result = await skill.execute(
            parameters={
                "text": text_with_entities,
                "extract_types": ["names", "emails", "dates", "urls", "phone_numbers"],
                "format": "json"
            },
            response_style="normal"
        )
        
        assert result.success is True
        assert "extracted_data" in result.result
        assert "total_extractions" in result.result
        
        extracted = result.result["extracted_data"]
        assert len(extracted.get("emails", [])) > 0
        assert len(extracted.get("dates", [])) > 0
        assert len(extracted.get("urls", [])) > 0


class TestTranslateSkill:
    """Test cases for TranslateSkill."""
    
    def test_skill_properties(self):
        """Test skill properties."""
        skill = TranslateSkill()
        
        assert skill.name == "translate"
        assert "translate" in skill.description.lower()
        assert skill.category == "enrichment"
        assert skill.version == "1.0.0"
        assert skill.required_tier == "pro"
        assert "translation" in skill.tags
        assert "language" in skill.tags
    
    @pytest.mark.asyncio
    async def test_execute_success(self):
        """Test successful skill execution."""
        skill = TranslateSkill()
        
        result = await skill.execute(
            parameters={
                "text": "Hello world",
                "from_language": "en",
                "to_language": "es",
                "preserve_formatting": True
            },
            response_style="normal"
        )
        
        assert result.success is True
        assert "translation" in result.result
        
        translation = result.result["translation"]
        assert translation["original_text"] == "Hello world"
        assert translation["to_language"] == "es"
        assert "translated_text" in translation
        assert translation["preserve_formatting"] is True
    
    @pytest.mark.asyncio
    async def test_execute_different_response_styles(self):
        """Test skill execution with different response styles."""
        skill = TranslateSkill()
        
        # Test lite style
        result_lite = await skill.execute(
            parameters={
                "text": "Test",
                "to_language": "es"
            },
            response_style="lite"
        )
        assert result_lite.success is True
        
        # Test full style
        result_full = await skill.execute(
            parameters={
                "text": "Test",
                "to_language": "es"
            },
            response_style="full"
        )
        assert result_full.success is True
        assert "Translation Result" in result_full.result["formatted_output"]
        
        # Test ultra style
        result_ultra = await skill.execute(
            parameters={
                "text": "Test",
                "to_language": "es"
            },
            response_style="ultra"
        )
        assert result_ultra.success is True
        assert "Comprehensive Translation Report" in result_ultra.result["formatted_output"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
