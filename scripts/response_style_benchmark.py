from __future__ import annotations

import json
import re
from pathlib import Path

from src.services.response_style import ALLOWED_RESPONSE_STYLES, compress_text

DATASET_PATH = Path('data/response_style_benchmark.json')


def token_count(text: str) -> int:
    try:
        import tiktoken  # type: ignore

        enc = tiktoken.get_encoding('cl100k_base')
        return len(enc.encode(text))
    except Exception:
        return len(re.findall(r"\w+|[^\w\s]", text))


def benchmark(dataset_path: Path) -> dict:
    samples = json.loads(dataset_path.read_text(encoding='utf-8'))
    rows = []
    totals = {style: 0 for style in ALLOWED_RESPONSE_STYLES}

    for sample in samples:
        text = sample['text']
        row = {'id': sample['id']}
        for style in sorted(ALLOWED_RESPONSE_STYLES):
            rendered = text if style == 'normal' else compress_text(text, style)
            count = token_count(rendered)
            row[style] = count
            totals[style] += count
        rows.append(row)

    baseline = max(totals.get('normal', 1), 1)
    reduction = {}
    for style in sorted(ALLOWED_RESPONSE_STYLES):
        if style == 'normal':
            reduction[style] = 0.0
            continue
        reduction[style] = round((baseline - totals[style]) / baseline, 4)

    return {
        'count': len(rows),
        'token_totals': totals,
        'reduction_vs_normal': reduction,
        'rows': rows,
    }


def main() -> int:
    if not DATASET_PATH.exists():
        raise SystemExit(f'Dataset not found: {DATASET_PATH}')

    report = benchmark(DATASET_PATH)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
