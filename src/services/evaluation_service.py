from collections import Counter
from src.services.retrieval_engine import RetrievalEngine


class EvaluationService:
    def __init__(self):
        self.retrieval = RetrievalEngine()

    def eval_query(self, question: str, expected_slugs: list[str], k: int = 5, org_key: str | None = None) -> dict:
        hits = self.retrieval.hybrid_search(question, limit=max(k, 1), org_key=org_key)
        got = [h.get('slug') for h in hits[:k]]
        expected_set = set(expected_slugs)
        hit_count = sum(1 for slug in got if slug in expected_set)
        precision_at_k = round(hit_count / max(1, k), 4)
        recall_at_k = round(hit_count / max(1, len(expected_set)), 4) if expected_set else 0.0

        groundedness = self._groundedness(hits[:k])
        hallucination_risk = round(max(0.0, 1.0 - groundedness), 4)

        return {
            'question': question,
            'k': k,
            'precision_at_k': precision_at_k,
            'recall_at_k': recall_at_k,
            'groundedness': groundedness,
            'hallucination_risk': hallucination_risk,
            'returned_slugs': got,
            'expected_slugs': expected_slugs,
            'type_distribution': Counter([h.get('type', 'unknown') for h in hits]),
        }

    def _groundedness(self, hits: list[dict]) -> float:
        if not hits:
            return 0.0
        supported = 0
        for h in hits:
            text = (h.get('compiled_truth_md') or '').strip()
            if len(text) >= 40:
                supported += 1
        return round(supported / len(hits), 4)
