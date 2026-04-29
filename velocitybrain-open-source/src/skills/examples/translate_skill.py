"""
VelocityBrain Translate Skill

Example skill for translating text between languages.
"""

from typing import Dict, Any, Optional
from ..base import BaseSkill, SkillResult


class TranslateSkill(BaseSkill):
    """Skill for translating text between languages."""
    
    @property
    def description(self) -> str:
        return "Translate text from one language to another"
    
    @property
    def category(self) -> str:
        return "enrichment"
    
    @property
    def version(self) -> str:
        return "1.0.0"
    
    @property
    def parameters_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Text to translate",
                    "minLength": 1
                },
                "from_language": {
                    "type": "string",
                    "description": "Source language code (e.g., 'en', 'es', 'fr')",
                    "default": "auto"
                },
                "to_language": {
                    "type": "string", 
                    "description": "Target language code (e.g., 'en', 'es', 'fr')",
                    "enum": ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ru", "ar"]
                },
                "preserve_formatting": {
                    "type": "boolean",
                    "default": True,
                    "description": "Preserve original formatting and structure"
                }
            },
            "required": ["text", "to_language"]
        }
    
    @property
    def tags(self) -> list:
        return ["translation", "language", "nlp", "multilingual"]
    
    @property
    def required_tier(self) -> str:
        return "pro"  # Translation requires pro tier
    
    async def execute(
        self,
        parameters: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
        response_style: str = "normal"
    ) -> SkillResult:
        """Execute the translate skill."""
        import time
        
        start_time = time.time()
        
        try:
            text = parameters["text"]
            to_language = parameters.get("to_language", "en")
            from_language = parameters.get("from_language", "auto")
            preserve_formatting = parameters.get("preserve_formatting", True)
            
            # Language names mapping
            language_names = {
                "en": "English",
                "es": "Spanish", 
                "fr": "French",
                "de": "German",
                "it": "Italian",
                "pt": "Portuguese",
                "zh": "Chinese",
                "ja": "Japanese",
                "ko": "Korean",
                "ru": "Russian",
                "ar": "Arabic"
            }
            
            # In a real implementation, this would call the core API translation service
            # For now, we'll simulate translation
            detected_language = from_language if from_language != "auto" else "en"
            
            # Simulate translation (in reality, this would use a translation service)
            translated_text = f"[Translated to {language_names.get(to_language, to_language)}] {text}"
            
            if preserve_formatting:
                # Preserve original line breaks and structure
                translated_text = translated_text.replace("\n", "\n")
            
            # Add translation metadata
            translation_info = {
                "original_text": text,
                "translated_text": translated_text,
                "from_language": detected_language,
                "to_language": to_language,
                "from_language_name": language_names.get(detected_language, detected_language),
                "to_language_name": language_names.get(to_language, to_language),
                "preserve_formatting": preserve_formatting,
                "character_count": len(text),
                "word_count": len(text.split())
            }
            
            # Format response based on response style
            if response_style == "lite":
                output = translated_text
            elif response_style == "full":
                output = f"""# Translation Result

## Original ({translation_info['from_language_name']})
{translation_info['original_text']}

## Translation ({translation_info['to_language_name']})
{translation_info['translated_text']}

## Translation Details
- Source Language: {translation_info['from_language']} ({translation_info['from_language_name']})
- Target Language: {translation_info['to_language']} ({translation_info['to_language_name']})
- Character Count: {translation_info['character_count']}
- Word Count: {translation_info['word_count']}
- Formatting Preserved: {translation_info['preserve_formatting']}
"""
            elif response_style == "ultra":
                output = f"""# Comprehensive Translation Report

## Document Information
- **Source Language**: {translation_info['from_language']} ({translation_info['from_language_name']})
- **Target Language**: {translation_info['to_language']} ({translation_info['to_language_name']})
- **Character Count**: {translation_info['character_count']}
- **Word Count**: {translation_info['word_count']}
- **Formatting Preservation**: {translation_info['preserve_formatting']}

## Source Text
```
{translation_info['original_text']}
```

## Translated Text
```
{translation_info['translated_text']}
```

## Translation Metadata
- **Translation Engine**: VelocityBrain Core API
- **Skill Version**: {self.version}
- **Required Tier**: {self.required_tier}
- **Execution Timestamp**: {time.strftime('%Y-%m-%d %H:%M:%S UTC')}
- **Response Style**: {response_style}
"""
            else:  # normal
                output = f"""Translation ({translation_info['from_language_name']} → {translation_info['to_language_name']}):

{translation_info['translated_text']}

---
*Original text preserved formatting: {translation_info['preserve_formatting']}*
"""
            
            formatted_output = self.format_response(output, response_style)
            
            execution_time = time.time() - start_time
            
            return SkillResult(
                success=True,
                result={
                    "translation": translation_info,
                    "formatted_output": formatted_output
                },
                message="Text translated successfully",
                execution_time=execution_time,
                confidence=0.90
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            return SkillResult(
                success=False,
                result={},
                message=f"Translation failed: {str(e)}",
                execution_time=execution_time
            )
