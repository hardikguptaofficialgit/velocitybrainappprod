from __future__ import annotations

from src.services.response_style import ALLOWED_RESPONSE_STYLES
from src.services.skill_registry import SkillRegistry


def build_openclaw_profile() -> dict:
    skills = SkillRegistry('skills').list_skills()
    tool_names = [
        'run_agent',
        'usage',
    ]
    return {
        'name': 'velocitybrain',
        'client': 'openclaw',
        'server': {
            'command': 'velocitybrain',
            'args': ['serve', 'mcp'],
        },
        'defaults': {
            'destructive_tools_allowed': False,
            'preferred_modes': ['usage', 'run_agent'],
            'traceability': True,
        },
        'capabilities': {
            'tool_count': len(tool_names),
            'tools': tool_names,
            'skill_count': len(skills),
            'skill_categories': sorted({skill.get('category', 'uncategorized') for skill in skills}),
            'response_styles': sorted(ALLOWED_RESPONSE_STYLES),
        },
        'recommended_smoke_flow': [
            'usage',
            'run_agent',
        ],
    }
