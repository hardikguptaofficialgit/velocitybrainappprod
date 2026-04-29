from src.services.retrieval_engine import RetrievalEngine


class SimulationEngine:
    def __init__(self):
        self.retrieval = RetrievalEngine()

    def run(self, scenario: str, options: list[str]) -> dict:
        context = self.retrieval.hybrid_search(scenario, limit=10)
        if not options:
            options = ['do_nothing', 'incremental_change', 'aggressive_move']

        scored = []
        base = max(1, len(context))
        for idx, opt in enumerate(options):
            score = round(0.4 + (base * 0.03) - (idx * 0.04), 3)
            scored.append(
                {
                    'option': opt,
                    'expected_outcome': 'positive' if score >= 0.5 else 'mixed',
                    'score': max(0.1, min(0.95, score)),
                    'rationale': f'Estimated from internal pattern density ({base} context hits).',
                }
            )

        return {
            'scenario': scenario,
            'results': scored,
            'recommended': sorted(scored, key=lambda x: x['score'], reverse=True)[0],
            'references': [{'slug': c['slug'], 'title': c['title']} for c in context[:6]],
        }
