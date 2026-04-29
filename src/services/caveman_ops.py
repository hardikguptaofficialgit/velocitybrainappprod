from __future__ import annotations

import re

from src.services.response_style import compress_text


def caveman_commit(message: str) -> str:
    compact = compress_text(message, 'full')
    compact = compact.strip().strip('.')
    compact = re.sub(r'\s+', ' ', compact)
    if not compact:
        return 'chore: update'

    subject = compact[:50].rstrip(' ,;:')
    if ':' in subject:
        return subject
    return f'chore: {subject}'


def caveman_review(message: str) -> str:
    compact = compress_text(message, 'full')
    compact = compact.strip()
    if not compact:
        return 'review: no issue found.'

    if not compact.lower().startswith('l'):
        return f'review: {compact}'
    return compact
