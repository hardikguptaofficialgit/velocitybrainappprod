from collections import Counter
from src.services.retrieval_engine import RetrievalEngine


class PredictiveEngine:
    def __init__(self):
        self.retrieval = RetrievalEngine()

    def forecast(self, subject: str, horizon_days: int = 30) -> dict:
        hits = self.retrieval.hybrid_search(subject, limit=12)
        if not hits:
            return {
                'subject': subject,
                'horizon_days': horizon_days,
                'forecast': 'insufficient_internal_signal',
                'confidence': 0.2,
                'drivers': [],
            }

        types = Counter([h['type'] for h in hits])
        dominant = types.most_common(1)[0][0]
        if dominant in {'project', 'company'}:
            forecast = 'likely_growth_or_activity_increase'
        elif dominant in {'person'}:
            forecast = 'likely_interaction_or_followup'
        else:
            forecast = 'likely_information_accumulation'

        confidence = min(0.9, 0.45 + len(hits) * 0.03)
        return {
            'subject': subject,
            'horizon_days': horizon_days,
            'forecast': forecast,
            'confidence': round(confidence, 3),
            'drivers': [{'slug': h['slug'], 'title': h['title']} for h in hits[:6]],
        }
