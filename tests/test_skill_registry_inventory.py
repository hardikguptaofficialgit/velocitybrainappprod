from src.services.skill_registry import SkillRegistry
from src.services.skill_validation import validate_skill_inventory


def test_skill_registry_has_expected_inventory_size():
    skills = SkillRegistry('skills').list_skills()
    assert len(skills) >= 65


def test_new_skill_manifests_are_registered():
    skills = SkillRegistry('skills').list_skills()
    keys = {skill.get('skill_key') for skill in skills}

    assert 'meeting-followup-planner' in keys
    assert 'webhook-dispatch-executor' in keys
    assert 'webhook-delivery-monitor' in keys
    assert 'context-gap-query' in keys
    assert 'skill-conformance-check' in keys
    assert 'operations-research' in keys


def test_skill_inventory_conformance_report_has_no_errors():
    skills = SkillRegistry('skills').list_skills()
    report = validate_skill_inventory(skills)

    assert report['invalid_count'] == 0
    assert report['valid_count'] == report['count']