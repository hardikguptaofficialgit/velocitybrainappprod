"""
VelocityBrain Extract Skill

Example skill for extracting structured information from text.
"""

from typing import Dict, Any, Optional, List
from ..base import BaseSkill, SkillResult


class ExtractSkill(BaseSkill):
    """Skill for extracting structured information from text."""
    
    @property
    def description(self) -> str:
        return "Extract structured information like names, dates, emails, and other entities from text"
    
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
                    "description": "Text to extract information from",
                    "minLength": 10
                },
                "extract_types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["names", "emails", "dates", "urls", "phone_numbers", "organizations"]
                    },
                    "default": ["names", "emails", "dates"],
                    "description": "Types of information to extract"
                },
                "format": {
                    "type": "string",
                    "enum": ["json", "markdown", "csv"],
                    "default": "json",
                    "description": "Output format for extracted information"
                }
            },
            "required": ["text"]
        }
    
    @property
    def tags(self) -> list:
        return ["extraction", "nlp", "structured-data", "entities"]
    
    async def execute(
        self,
        parameters: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
        response_style: str = "normal"
    ) -> SkillResult:
        """Execute the extract skill."""
        import time
        import re
        import json
        
        start_time = time.time()
        
        try:
            text = parameters["text"]
            extract_types = parameters.get("extract_types", ["names", "emails", "dates"])
            output_format = parameters.get("format", "json")
            
            extracted_data = {}
            
            # Extract emails
            if "emails" in extract_types:
                email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
                emails = re.findall(email_pattern, text)
                extracted_data["emails"] = list(set(emails))
            
            # Extract dates
            if "dates" in extract_types:
                date_patterns = [
                    r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',  # MM/DD/YYYY or MM-DD-YYYY
                    r'\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b',    # YYYY/MM/DD or YYYY-MM-DD
                    r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b'  # Month Day, Year
                ]
                dates = []
                for pattern in date_patterns:
                    dates.extend(re.findall(pattern, text, re.IGNORECASE))
                extracted_data["dates"] = list(set(dates))
            
            # Extract URLs
            if "urls" in extract_types:
                url_pattern = r'https?://[^\s<>"{}|\\^`[\]]+'
                urls = re.findall(url_pattern, text)
                extracted_data["urls"] = list(set(urls))
            
            # Extract phone numbers (simple pattern)
            if "phone_numbers" in extract_types:
                phone_pattern = r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b'
                phones = re.findall(phone_pattern, text)
                extracted_data["phone_numbers"] = list(set(phones))
            
            # Extract names (simple capitalization pattern)
            if "names" in extract_types:
                # This is a very basic pattern - real implementation would use NLP
                name_pattern = r'\b[A-Z][a-z]+ [A-Z][a-z]+\b'
                names = re.findall(name_pattern, text)
                extracted_data["names"] = list(set(names))
            
            # Extract organizations (simple pattern)
            if "organizations" in extract_types:
                org_pattern = r'\b[A-Z][a-z]+ (?:Inc|Corp|LLC|Ltd|Company|Corporation)\b'
                orgs = re.findall(org_pattern, text, re.IGNORECASE)
                extracted_data["organizations"] = list(set(orgs))
            
            # Format output
            if output_format == "json":
                output = json.dumps(extracted_data, indent=2)
            elif output_format == "markdown":
                output = "# Extracted Information\n\n"
                for key, values in extracted_data.items():
                    if values:
                        output += f"## {key.title()}\n\n"
                        for value in values:
                            output += f"- {value}\n"
                        output += "\n"
            elif output_format == "csv":
                output = "Type,Value\n"
                for key, values in extracted_data.items():
                    for value in values:
                        output += f"{key},{value}\n"
            else:
                output = str(extracted_data)
            
            # Format response based on response style
            formatted_output = self.format_response(output, response_style)
            
            execution_time = time.time() - start_time
            
            return SkillResult(
                success=True,
                result={
                    "extracted_data": extracted_data,
                    "formatted_output": formatted_output,
                    "total_extractions": sum(len(values) for values in extracted_data.values()),
                    "format": output_format
                },
                message="Information extracted successfully",
                execution_time=execution_time,
                confidence=0.75  # Lower confidence due to simple regex patterns
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            return SkillResult(
                success=False,
                result={},
                message=f"Extraction failed: {str(e)}",
                execution_time=execution_time
            )
