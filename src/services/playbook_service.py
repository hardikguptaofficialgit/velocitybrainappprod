from datetime import datetime, timezone
from typing import Any


class PlaybookService:
    def create(self, signal: str, steps: list[dict[str, Any]]) -> dict:
        return {
            'signal': signal,
            'steps': steps,
            'requires_approval': any(self._destructive(s) for s in steps),
            'created_at': datetime.now(timezone.utc).isoformat(),
        }

    def execute(self, playbook: dict[str, Any], approve: bool = False) -> dict:
        destructive = any(self._destructive(s) for s in playbook.get('steps', []))
        if destructive and not approve:
            return {
                'status': 'blocked',
                'reason': 'approval_required',
                'requires_approval': True,
            }
        actions = []
        for step in playbook.get('steps', []):
            actions.append({'step': step.get('step', 'unnamed'), 'status': 'simulated_success'})
        return {
            'status': 'completed',
            'actions': actions,
            'executed_at': datetime.now(timezone.utc).isoformat(),
        }

    def _destructive(self, step: dict[str, Any]) -> bool:
        action = (step.get('action_type') or '').lower()
        return any(k in action for k in ['delete', 'sync_brain', 'put_page'])
