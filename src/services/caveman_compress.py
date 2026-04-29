from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from src.core.config import settings
from src.services.response_style import compress_text, normalize_response_style

_FENCED_CODE_RE = re.compile(r"```[\s\S]*?```", re.MULTILINE)
_INLINE_CODE_RE = re.compile(r"`[^`]+`")
_URL_RE = re.compile(r"https?://[^\s)]+")
_WIN_PATH_RE = re.compile(r"[A-Za-z]:\\[^\s)]+")
_UNIX_PATH_RE = re.compile(r"(?:\./|\.\./|/)[A-Za-z0-9._\-/]+")


def _safe_file_path(file_path: str | Path) -> Path:
    p = Path(file_path).expanduser().resolve()
    if settings.allow_unsafe_file_reads:
        return p
    root = Path(settings.workspace_root).resolve()
    if p != root and root not in p.parents:
        raise ValueError(f'file outside workspace root: {p}')
    return p


def _token_count(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text))


def _protect_tokens(text: str) -> tuple[str, dict[str, str]]:
    placeholders: dict[str, str] = {}
    idx = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal idx
        key = f"__VB_P_{idx}__"
        placeholders[key] = match.group(0)
        idx += 1
        return key

    protected = _INLINE_CODE_RE.sub(repl, text)
    protected = _URL_RE.sub(repl, protected)
    protected = _WIN_PATH_RE.sub(repl, protected)
    protected = _UNIX_PATH_RE.sub(repl, protected)
    return protected, placeholders


def _restore_tokens(text: str, placeholders: dict[str, str]) -> str:
    restored = text
    for key, value in placeholders.items():
        restored = restored.replace(key, value)
    return restored


def _compress_line(line: str, style: str) -> str:
    if not line.strip():
        return line

    stripped = line.lstrip()
    if stripped.startswith('#'):
        return line
    if stripped.startswith('|'):
        return line
    if re.match(r"^\s*[-]{3,}\s*$", line):
        return line

    prefix = ''
    body = line

    bullet = re.match(r"^(\s*(?:[-*+]|\d+\.)\s+)(.*)$", line)
    if bullet:
        prefix, body = bullet.group(1), bullet.group(2)

    quote = re.match(r"^(\s*>\s+)(.*)$", body)
    quote_prefix = ''
    if quote:
        quote_prefix, body = quote.group(1), quote.group(2)

    protected, placeholders = _protect_tokens(body)
    compressed = compress_text(protected, style)
    restored = _restore_tokens(compressed, placeholders)
    return f"{prefix}{quote_prefix}{restored}".rstrip()


def compress_markdown_text(text: str, style: str = 'full') -> str:
    mode = normalize_response_style(style)
    parts = _FENCED_CODE_RE.split(text)
    blocks = _FENCED_CODE_RE.findall(text)

    out: list[str] = []
    for i, chunk in enumerate(parts):
        if chunk:
            lines = chunk.splitlines()
            processed = [_compress_line(line, mode) for line in lines]
            out.append('\n'.join(processed))
        if i < len(blocks):
            out.append(blocks[i])

    return '\n'.join(out)


def _extract_headings(text: str) -> list[str]:
    return re.findall(r"^#{1,6}\s+.*$", text, flags=re.MULTILINE)


def _extract_code_blocks(text: str) -> list[str]:
    return _FENCED_CODE_RE.findall(text)


def _extract_urls(text: str) -> list[str]:
    return _URL_RE.findall(text)


def _extract_paths(text: str) -> list[str]:
    return _WIN_PATH_RE.findall(text) + _UNIX_PATH_RE.findall(text)


def _extract_commands(text: str) -> list[str]:
    pattern = r"(?:^|\n)(?:\s{0,4})(?:python|pip|npm|node|docker|git|claude|codex|velocitybrain|powershell|bash)\b[^\n]*"
    return re.findall(pattern, text, flags=re.IGNORECASE)


def validate_preservation(original: str, compressed: str) -> dict[str, Any]:
    checks = {
        'headings': _extract_headings(original) == _extract_headings(compressed),
        'code_blocks': _extract_code_blocks(original) == _extract_code_blocks(compressed),
        'urls': _extract_urls(original) == _extract_urls(compressed),
        'paths': _extract_paths(original) == _extract_paths(compressed),
        'commands': _extract_commands(original) == _extract_commands(compressed),
    }
    return {
        'ok': all(checks.values()),
        'checks': checks,
    }


def caveman_compress_file(file_path: str | Path, style: str = 'full', write_backup: bool = True) -> dict[str, Any]:
    path = _safe_file_path(file_path)
    if not path.exists():
        raise FileNotFoundError(f'file not found: {path}')

    original = path.read_text(encoding='utf-8')
    compressed = compress_markdown_text(original, style=style)
    validation = validate_preservation(original, compressed)

    if not validation['ok']:
        failed = [name for name, passed in validation['checks'].items() if not passed]
        raise ValueError(f'compression validation failed: {", ".join(failed)}')

    backup_path = None
    if write_backup:
        backup_path = path.with_name(path.name + '.original.md')
        backup_path.write_text(original, encoding='utf-8')

    path.write_text(compressed, encoding='utf-8')

    before_tokens = _token_count(original)
    after_tokens = _token_count(compressed)

    return {
        'file': str(path),
        'backup_file': str(backup_path) if backup_path else None,
        'response_style': normalize_response_style(style),
        'before_tokens': before_tokens,
        'after_tokens': after_tokens,
        'reduction_ratio': round((before_tokens - after_tokens) / max(before_tokens, 1), 4),
        'validation': validation,
    }
