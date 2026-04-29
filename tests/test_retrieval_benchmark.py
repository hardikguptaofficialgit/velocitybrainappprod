from scripts import retrieval_benchmark


def test_benchmark_loader_reads_dataset():
    cases = retrieval_benchmark.load_cases(retrieval_benchmark.DEFAULT_DATASET)
    assert len(cases) >= 3
    assert cases[0]['question']


def test_benchmark_runner_aggregates_scores(monkeypatch):
    cases = [
        {'question': 'What do I know about Hardik Gupta?', 'expected_slugs': ['jane-doe']},
        {'question': 'Prepare me for meeting with Raj Patel.', 'expected_slugs': ['raj-patel']},
    ]

    class FakeEvaluationService:
        def eval_query(self, question, expected_slugs, k=5, org_key=None):
            return {
                'question': question,
                'k': k,
                'precision_at_k': 1.0,
                'recall_at_k': 1.0,
                'groundedness': 1.0,
                'hallucination_risk': 0.0,
                'returned_slugs': expected_slugs,
                'expected_slugs': expected_slugs,
                'type_distribution': {'person': 1},
            }

    monkeypatch.setattr(retrieval_benchmark, 'EvaluationService', FakeEvaluationService)

    summary = retrieval_benchmark.run_benchmark(cases, k=3)

    assert summary['count'] == 2
    assert summary['precision_at_k'] == 1.0
    assert summary['recall_at_k'] == 1.0
