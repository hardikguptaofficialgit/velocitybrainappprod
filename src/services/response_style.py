from __future__ import annotations

import re
from typing import Any

ALLOWED_RESPONSE_STYLES = {'normal', 'lite', 'full', 'ultra'}

_FILLER_PATTERNS = [
    (r'\bthe reason is\b', ''),
    (r'\bit is likely that\b', ''),
    (r'\bthis means that\b', 'means'),
    (r'\byou should\b', ''),
    (r'\bplease\b', ''),
    (r'\bbasically\b', ''),
    (r'\bsimply\b', ''),
    (r'\bjust\b', ''),
    (r'\bcurrently\b', 'now'),
]

_STOPWORDS = {
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'to',
    'of',
    'for',
    'that',
    'this',
    'with',
    'and',
    'or',
    'by',
    'from',
    'it',
    'as',
    'be',
    'been',
    'being',
    'at',
    'on',
    'in',
}


def normalize_response_style(style: str | None) -> str:
    normalized = (style or 'normal').strip().lower()
    if normalized not in ALLOWED_RESPONSE_STYLES:
        return 'normal'
    return normalized


def _collapse_spaces(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def _compress_lite(text: str) -> str:
    compact = text
    for pattern, replacement in _FILLER_PATTERNS:
        compact = re.sub(pattern, replacement, compact, flags=re.IGNORECASE)
    compact = compact.replace(' because ', ' b/c ')
    compact = compact.replace(' and ', ' + ')
    return _collapse_spaces(compact)


def _compress_full(text: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9_./:-]+|[^\w\s]", text)
    kept: list[str] = []

    for token in tokens:
        if re.fullmatch(r"[^\w\s]", token):
            if token in {'.', ',', ';'}:
                continue
            kept.append(token)
            continue

        lower = token.lower()
        if lower in _STOPWORDS:
            continue
        kept.append(token)

    collapsed = ' '.join(kept)
    collapsed = collapsed.replace(' / ', '/')
    collapsed = collapsed.replace(' : ', ': ')
    return _collapse_spaces(collapsed)


def _compress_ultra(text: str) -> str:
    base = _compress_full(text)
    compact = base
    replacements = {
        'database': 'db',
        'request': 'req',
        'response': 'res',
        'configuration': 'config',
        'implementation': 'impl',
        'function': 'fn',
        'because': '->',
        'causes': '->',
        'returns': '->',
    }
    for source, target in replacements.items():
        compact = re.sub(rf'\b{re.escape(source)}\b', target, compact, flags=re.IGNORECASE)

    compact = compact.replace(' + ', ' ')
    compact = compact.replace(' -> ', ' -> ')
    compact = re.sub(r'\s+', ' ', compact)
    compact = compact.replace(' .', '')
    return compact.strip()


def compress_text(text: str, style: str | None) -> str:
    mode = normalize_response_style(style)
    if mode == 'normal':
        return text
    if mode == 'lite':
        return _compress_lite(text)
    if mode == 'full':
        return _compress_full(text)
    return _compress_ultra(text)


def apply_response_style(payload: dict[str, Any], style: str | None) -> dict[str, Any]:
    mode = normalize_response_style(style)
    transformed = dict(payload)

    for key in ('answer', 'reasoning_summary'):
        value = transformed.get(key)
        if isinstance(value, str) and value:
            transformed[key] = compress_text(value, mode)

    transformed['response_style'] = mode
    return transformed
