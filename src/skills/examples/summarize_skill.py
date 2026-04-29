"""
VelocityBrain Summarize Skill

Example skill for summarizing text content.
"""

from typing import Dict, Any, Optional
from ..base import BaseSkill, SkillResult


class SummarizeSkill(BaseSkill):
    """Skill for summarizing text content."""
    
    @property
    def description(self) -> str:
        return "Summarize text content into concise bullet points or paragraphs"
    
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
                    "description": "Text content to summarize",
                    "minLength": 10
                },
                "style": {
                    "type": "string",
                    "enum": ["bullets", "paragraph", "executive"],
                    "default": "bullets",
                    "description": "Summary style format"
                },
                "max_length": {
                    "type": "integer",
                    "default": 200,
                    "minimum": 50,
                    "maximum": 1000,
                    "description": "Maximum summary length in words"
                }
            },
            "required": ["text"]
        }
    
    @property
    def tags(self) -> list:
        return ["summarization", "nlp", "content-processing"]
    
    async def execute(
        self,
        parameters: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
        response_style: str = "normal"
    ) -> SkillResult:
        """Execute the summarize skill."""
        import time
        import re
        
        start_time = time.time()
        
        try:
            text = parameters["text"]
            style = parameters.get("style", "bullets")
            max_length = parameters.get("max_length", 200)
            
            # In a real implementation, this would call the core API
            # For now, we'll simulate summarization
            sentences = re.split(r'[.!?]+', text)
            sentences = [s.strip() for s in sentences if s.strip()]
            
            # Simple extractive summarization
            # Take first few sentences up to max_length
            summary_sentences = []
            current_length = 0
            
            for sentence in sentences:
                words = len(sentence.split())
                if current_length + words <= max_length:
                    summary_sentences.append(sentence)
                    current_length += words
                else:
                    break
            
            # Format based on style
            if style == "bullets":
                summary = "\n".join(f"• {sentence}" for sentence in summary_sentences)
            elif style == "executive":
                summary = f"Executive Summary:\n\n{'. '.join(summary_sentences)}."
            else:  # paragraph
                summary = '. '.join(summary_sentences) + '.'
            
            # Format response based on response style
            formatted_summary = self.format_response(summary, response_style)
            
            execution_time = time.time() - start_time
            
            return SkillResult(
                success=True,
                result={
                    "summary": formatted_summary,
                    "original_length": len(text.split()),
                    "summary_length": len(summary.split()),
                    "compression_ratio": len(summary.split()) / len(text.split()),
                    "style": style
                },
                message="Text summarized successfully",
                execution_time=execution_time,
                confidence=0.85
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            return SkillResult(
                success=False,
                result={},
                message=f"Summarization failed: {str(e)}",
                execution_time=execution_time
            )
