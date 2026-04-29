from src.services.simulation_engine import SimulationEngine


class DecisionEngine:
    def __init__(self):
        self.simulator = SimulationEngine()

    def analyze(self, decision: str, options: list[str], constraints: dict) -> dict:
        sim = self.simulator.run(decision, options)
        penalties = constraints.get('penalties', {}) if isinstance(constraints, dict) else {}

        adjusted = []
        for row in sim['results']:
            penalty = float(penalties.get(row['option'], 0.0))
            adjusted_score = max(0.0, round(row['score'] - penalty, 3))
            adjusted.append({**row, 'adjusted_score': adjusted_score, 'tradeoff_penalty': penalty})

        best = sorted(adjusted, key=lambda x: x['adjusted_score'], reverse=True)[0]
        return {
            'decision': decision,
            'analysis': adjusted,
            'recommendation': best,
            'reasoning_summary': 'Scenario simulation with constraint-aware score adjustment.',
            'references': sim['references'],
            'confidence': round(min(0.92, 0.45 + len(adjusted) * 0.08), 3),
        }
