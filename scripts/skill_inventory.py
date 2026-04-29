#!/usr/bin/env python3
import json
from pathlib import Path

from src.services.skill_validation import validate_skill_inventory

root = Path('skills')
all_skills = [json.loads(p.read_text(encoding='utf-8')) for p in root.rglob('*.json')]
report = validate_skill_inventory(all_skills)

print(f"skills={report['count']}")
print(f"valid={report['valid_count']}")
print(f"invalid={report['invalid_count']}")

for skill in sorted(report['valid_skills'], key=lambda x: x['skill_key'])[:5]:
    print(skill['skill_key'])

if report['invalid_skills']:
    print('invalid_skills:')
    for skill in report['invalid_skills']:
        print(f"- {skill['skill_key']}: {', '.join(skill['errors'])}")
