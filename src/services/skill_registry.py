import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from src.core.logging_config import get_logger, log_error
from src.core.security import validator

DEFAULT_WORKFLOW = [
    'validate_input',
    'brain_first_lookup',
    'execute_core_steps',
    'validate_output',
    'write_audit',
]

DEFAULT_OUTPUT_STRUCTURE = {
    'status': 'success',
    'summary': '',
    'confidence': 0.0,
    'references': [],
    'payload': {},
}

CATEGORY_ALIASES = {
    'automation': 'execution',
    'intelligence': 'enrichment',
}


class SkillRegistry:
    def __init__(self, skills_root: str = 'skills'):
        self.skills_root = Path(skills_root)
        self.logger = get_logger('skill_registry')
        self._validate_skills_directory()

    def _validate_skills_directory(self) -> None:
        """Validate skills directory exists and is accessible."""
        if not self.skills_root.exists():
            self.logger.error(f"Skills directory does not exist: {self.skills_root}")
            raise FileNotFoundError(f"Skills directory not found: {self.skills_root}")
        
        if not self.skills_root.is_dir():
            self.logger.error(f"Skills path is not a directory: {self.skills_root}")
            raise NotADirectoryError(f"Skills path is not a directory: {self.skills_root}")
    
    def list_skills(self) -> List[Dict[str, Any]]:
        """List all skills with proper error handling and validation."""
        out = []
        errors = []
        
        try:
            skill_files = list(self.skills_root.rglob('*.json'))
            if not skill_files:
                self.logger.warning(f"No skill files found in {self.skills_root}")
                return []
            
            for fp in skill_files:
                try:
                    # Validate file size
                    if fp.stat().st_size > 1024 * 1024:  # 1MB
                        self.logger.warning(f"Skill file too large, skipping: {fp}")
                        continue
                    
                    # Read and parse JSON
                    content = fp.read_text(encoding='utf-8')
                    if not content.strip():
                        self.logger.warning(f"Empty skill file: {fp}")
                        continue
                    
                    skill_data = json.loads(content)
                    skill_data = self._normalize_skill_data(skill_data)
                    
                    # Validate skill structure
                    if not self._validate_skill_structure(skill_data, fp):
                        continue
                    
                    # Add file metadata
                    skill_data['file_path'] = str(fp.relative_to(self.skills_root))
                    skill_data['file_size'] = fp.stat().st_size
                    
                    out.append(skill_data)
                    
                except json.JSONDecodeError as exc:
                    error_msg = f"Invalid JSON in skill file {fp}: {exc}"
                    errors.append(error_msg)
                    self.logger.error(error_msg)
                except UnicodeDecodeError as exc:
                    error_msg = f"Encoding error in skill file {fp}: {exc}"
                    errors.append(error_msg)
                    self.logger.error(error_msg)
                except Exception as exc:
                    error_msg = f"Error processing skill file {fp}: {exc}"
                    errors.append(error_msg)
                    log_error(exc, {"file": str(fp), "operation": "skill_load"})
            
            if errors:
                self.logger.warning(f"Encountered {len(errors)} errors while loading skills")
            
            # Sort by category and name
            sorted_skills = sorted(out, key=lambda x: (x.get('category', ''), x.get('name', '')))
            self.logger.info(f"Successfully loaded {len(sorted_skills)} skills")
            return sorted_skills
            
        except Exception as exc:
            log_error(exc, {"operation": "list_skills", "directory": str(self.skills_root)})
            raise RuntimeError(f"Failed to list skills: {exc}") from exc

    def _normalize_skill_data(self, skill: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize older manifest shapes to the current contract."""
        normalized = dict(skill)

        category = normalized.get('category')
        if isinstance(category, str):
            normalized['category'] = CATEGORY_ALIASES.get(category, category)

        workflow = normalized.get('workflow')
        if not isinstance(workflow, list) or not workflow:
            normalized['workflow'] = list(DEFAULT_WORKFLOW)
        else:
            existing = {str(step) for step in workflow}
            normalized['workflow'] = workflow + [step for step in DEFAULT_WORKFLOW if step not in existing]

        output_structure = normalized.get('output_structure')
        if not isinstance(output_structure, dict):
            normalized['output_structure'] = dict(DEFAULT_OUTPUT_STRUCTURE)
        else:
            merged_output = dict(DEFAULT_OUTPUT_STRUCTURE)
            merged_output.update(output_structure)
            normalized['output_structure'] = merged_output

        validation_rules = normalized.get('validation_rules')
        if not isinstance(validation_rules, list) or not validation_rules:
            normalized['validation_rules'] = ['validate_required_fields']

        triggers = normalized.get('trigger_conditions')
        if not isinstance(triggers, list) or not triggers:
            normalized['trigger_conditions'] = ['general']

        return normalized
    
    def _validate_skill_structure(self, skill: Dict[str, Any], file_path: Path) -> bool:
        """Validate skill structure and required fields."""
        required_fields = ['skill_key', 'name', 'category', 'version', 'trigger_conditions', 'workflow', 'validation_rules', 'output_structure']
        
        for field in required_fields:
            if field not in skill:
                self.logger.error(f"Missing required field '{field}' in skill file: {file_path}")
                return False
        
        # Validate skill_key format
        skill_key = skill['skill_key']
        if not isinstance(skill_key, str) or not skill_key.strip():
            self.logger.error(f"Invalid skill_key in skill file: {file_path}")
            return False
        
        # Validate category
        category = skill['category']
        allowed_categories = {'ingestion', 'query', 'planning', 'execution', 'enrichment', 'monitoring', 'maintenance', 'research'}
        if category not in allowed_categories:
            self.logger.warning(f"Unknown category '{category}' in skill file: {file_path}")
        
        return True

    def resolve(self, intent: str) -> List[Dict[str, Any]]:
        """Resolve intent to matching skills with validation."""
        if not intent or not intent.strip():
            self.logger.warning("Empty intent provided to resolve")
            return []
        
        try:
            q = validator.sanitize_sql_input(intent.lower().strip())
            matches = []
            
            for skill in self.list_skills():
                try:
                    triggers = skill.get('trigger_conditions', [])
                    if not isinstance(triggers, list):
                        self.logger.warning(f"Invalid trigger_conditions in skill: {skill.get('skill_key')}")
                        continue
                    
                    # Convert triggers to searchable string
                    trigger_text = ' '.join(str(t) for t in triggers).lower()
                    
                    # Check for matches
                    if any(t in q for t in trigger_text.split()):
                        # Add match score
                        score = self._calculate_match_score(q, trigger_text)
                        skill['match_score'] = score
                        matches.append(skill)
                        
                except Exception as exc:
                    self.logger.error(f"Error processing skill {skill.get('skill_key')}: {exc}")
                    continue
            
            # Sort by match score and limit to top 8
            matches.sort(key=lambda x: x.get('match_score', 0), reverse=True)
            result = matches[:8]
            
            self.logger.info(f"Resolved intent '{intent}' to {len(result)} skills")
            return result
            
        except Exception as exc:
            log_error(exc, {"intent": intent, "operation": "resolve_intent"})
            raise RuntimeError(f"Failed to resolve intent: {exc}") from exc
    
    def _calculate_match_score(self, query: str, triggers: str) -> float:
        """Calculate match score between query and triggers."""
        query_words = set(query.split())
        trigger_words = set(triggers.split())
        
        if not query_words or not trigger_words:
            return 0.0
        
        # Simple Jaccard similarity
        intersection = query_words.intersection(trigger_words)
        union = query_words.union(trigger_words)
        
        return len(intersection) / len(union) if union else 0.0
