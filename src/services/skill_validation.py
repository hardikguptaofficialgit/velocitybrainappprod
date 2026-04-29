from __future__ import annotations

from typing import Any


REQUIRED_FIELDS = {'skill_key', 'name', 'category', 'version', 'trigger_conditions', 'workflow', 'validation_rules', 'output_structure'}
REQUIRED_WORKFLOW_STEPS = {
    'validate_input',
    'brain_first_lookup',
    'execute_core_steps',
    'validate_output',
    'write_audit',
}
REQUIRED_OUTPUT_FIELDS = {'status', 'summary', 'confidence', 'references', 'payload'}


def validate_skill_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    missing = REQUIRED_FIELDS - set(manifest.keys())
    for field in sorted(missing):
        errors.append(f'missing field: {field}')

    workflow = manifest.get('workflow')
    if not isinstance(workflow, list):
        errors.append('workflow must be a list')
    else:
        workflow_steps = set(str(step) for step in workflow)
        missing_steps = REQUIRED_WORKFLOW_STEPS - workflow_steps
        for step in sorted(missing_steps):
            errors.append(f'missing workflow step: {step}')

    output_structure = manifest.get('output_structure')
    if not isinstance(output_structure, dict):
        errors.append('output_structure must be an object')
    else:
        missing_output = REQUIRED_OUTPUT_FIELDS - set(output_structure.keys())
        for field in sorted(missing_output):
            errors.append(f'missing output field: {field}')

    triggers = manifest.get('trigger_conditions')
    if not isinstance(triggers, list) or not triggers:
        errors.append('trigger_conditions must be a non-empty list')

    validation_rules = manifest.get('validation_rules')
    if not isinstance(validation_rules, list) or not validation_rules:
        errors.append('validation_rules must be a non-empty list')

    return errors


def validate_skill_inventory(skills: list[dict[str, Any]]) -> dict[str, Any]:
    validated = []
    invalid = []

    for skill in skills:
        errors = validate_skill_manifest(skill)
        record = {
            'skill_key': skill.get('skill_key', 'unknown'),
            'name': skill.get('name', 'unknown'),
            'category': skill.get('category', 'unknown'),
            'errors': errors,
        }
        if errors:
            invalid.append(record)
        else:
            validated.append(record)

    return {
        'count': len(skills),
        'valid_count': len(validated),
        'invalid_count': len(invalid),
        'valid_skills': validated,
        'invalid_skills': invalid,
    }