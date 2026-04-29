#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from src.services.evaluation_service import EvaluationService
from src.services.memory_engine import MemoryEngine

DEFAULT_DATASET = Path('data/retrieval_benchmark.json')


def load_cases(dataset_path: Path) -> list[dict]:
    return json.loads(dataset_path.read_text(encoding='utf-8'))


def seed_cases(cases: list[dict]) -> None:
    engine = MemoryEngine()
    for case in cases:
        seed_content = case.get('seed_content')
        if seed_content:
            engine.upsert_from_text(case.get('source', 'benchmark'), seed_content)


def run_benchmark(cases: list[dict], k: int) -> dict:
    evaluator = EvaluationService()
    results = []
    precision_total = 0.0
    recall_total = 0.0
    groundedness_total = 0.0

    for case in cases:
        result = evaluator.eval_query(case['question'], case.get('expected_slugs', []), k=k)
        results.append({**case, **result})
        precision_total += result['precision_at_k']
        recall_total += result['recall_at_k']
        groundedness_total += result['groundedness']

    count = max(1, len(cases))
    return {
        'count': len(cases),
        'k': k,
        'precision_at_k': round(precision_total / count, 4),
        'recall_at_k': round(recall_total / count, 4),
        'groundedness': round(groundedness_total / count, 4),
        'results': results,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Run the Velocity Brain retrieval benchmark.')
    parser.add_argument('--dataset', default=str(DEFAULT_DATASET), help='Path to benchmark dataset JSON.')
    parser.add_argument('--k', type=int, default=5, help='Top-k to score.')
    parser.add_argument('--seed', action='store_true', help='Seed benchmark content into the local brain before running.')
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    dataset_path = Path(args.dataset)
    cases = load_cases(dataset_path)

    if args.seed:
        seed_cases(cases)

    summary = run_benchmark(cases, k=args.k)
    print(json.dumps(summary, indent=2, ensure_ascii=False, default=str))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
