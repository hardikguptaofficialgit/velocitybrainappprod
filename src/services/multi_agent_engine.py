from src.services.retrieval_engine import RetrievalEngine


class MultiAgentEngine:
    def __init__(self):
        self.retrieval = RetrievalEngine()

    def collaborate(self, objective: str, agents: list[str]) -> dict:
        context = self.retrieval.hybrid_search(objective, limit=8)
        briefs = []
        for a in agents:
            role = a.lower()
            if 'research' in role:
                brief = 'Collect supporting evidence and contradictions from internal memory.'
            elif 'plan' in role:
                brief = 'Convert evidence into sequenced plan with dependencies.'
            elif 'exec' in role:
                brief = 'Translate plan into executable actions and accountability items.'
            else:
                brief = 'Contribute domain-specific perspective.'
            briefs.append({'agent': a, 'brief': brief})

        merged_plan = [
            {'step': 'research_pass', 'owner': 'researcher'},
            {'step': 'planning_pass', 'owner': 'planner'},
            {'step': 'execution_pass', 'owner': 'executor'},
        ]

        return {
            'objective': objective,
            'agents': briefs,
            'shared_context': [{'slug': c['slug'], 'title': c['title']} for c in context],
            'merged_plan': merged_plan,
            'confidence': 0.78 if context else 0.52,
        }
