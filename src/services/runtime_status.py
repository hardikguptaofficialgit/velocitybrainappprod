from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from src.core.config import settings
from src.services.compliance_service import ComplianceService
from src.services.openclaw_profile import build_openclaw_profile
from src.services.reuse_service import ReuseService
from src.services.skill_registry import SkillRegistry


def build_runtime_status(audit_limit: int = 5) -> dict[str, Any]:
    skills = SkillRegistry(settings.skills_path).list_skills()
    categories = sorted({skill.get('category', 'uncategorized') for skill in skills})

    openclaw_profile = build_openclaw_profile()
    openclaw_capabilities = openclaw_profile.get('capabilities', {})

    audit_available = True
    audit_summary: dict[str, Any] = {
        'count': 0,
        'latest_event': None,
        'limit': audit_limit,
    }
    try:
        recent = ComplianceService().recent_audit(limit=audit_limit)
        events = recent.get('events', [])
        audit_summary = {
            'count': int(recent.get('count', len(events))),
            'latest_event': events[0] if events else None,
            'limit': audit_limit,
        }
    except Exception as exc:
        audit_available = False
        audit_summary = {
            'count': 0,
            'latest_event': None,
            'limit': audit_limit,
            'error': str(exc),
        }

    return {
        'app': settings.app_name,
        'env': settings.env,
        'health': {'ok': True, 'service': 'velocitybrain-api'},
        'skills': {
            'count': len(skills),
            'categories': categories,
        },
        'openclaw': {
            'server': openclaw_profile.get('server', {}),
            'tool_count': int(openclaw_capabilities.get('tool_count', 0)),
            'skill_count': int(openclaw_capabilities.get('skill_count', 0)),
            'recommended_smoke_flow': openclaw_profile.get('recommended_smoke_flow', []),
        },
        'audit': {
            'available': audit_available,
            **audit_summary,
        },
        'savings': ReuseService().get_savings_overview(),
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }
