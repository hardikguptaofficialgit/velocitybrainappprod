from pathlib import Path

from src.services.caveman_compress import caveman_compress_file, validate_preservation


def test_caveman_compress_preserves_structural_tokens(tmp_path: Path, monkeypatch):
    monkeypatch.setattr('src.services.caveman_compress.settings.allow_unsafe_file_reads', True)

    sample = tmp_path / 'sample.md'
    sample.write_text(
        """# API Integration Guide

Use endpoint https://example.com/v1/items to fetch records.

Run command: velocitybrain query \"What changed?\"

Path: C:\\repo\\project\\README.md and ./docs/CLIENT_INTEGRATIONS.md

```python
print('keep this code unchanged')
```

- The reason is that the request is too broad and this means that you should filter more.
""",
        encoding='utf-8',
    )

    out = caveman_compress_file(sample, style='full', write_backup=True)

    assert out['validation']['ok'] is True
    backup = sample.with_name('sample.md.original.md')
    assert backup.exists()

    compressed = sample.read_text(encoding='utf-8')
    original = backup.read_text(encoding='utf-8')
    checks = validate_preservation(original, compressed)
    assert checks['ok'] is True
    assert '# API Integration Guide' in compressed
    assert "print('keep this code unchanged')" in compressed
    assert 'https://example.com/v1/items' in compressed


def test_caveman_compress_rejects_missing_file(monkeypatch):
    monkeypatch.setattr('src.services.caveman_compress.settings.allow_unsafe_file_reads', True)

    missing = Path('definitely-missing-file.md')
    try:
        caveman_compress_file(missing, style='full', write_backup=False)
        assert False, 'expected FileNotFoundError'
    except FileNotFoundError:
        assert True
