from datetime import datetime, timezone
from typing import Any


class ConnectorHubService:
    SUPPORTED = {
        'slack',
        'whatsapp',
        'telegram',
        'google_workspace',
        'notion',
        'github',
        'jira',
    }

    def dispatch(self, connector: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        c = connector.strip().lower()
        if c not in self.SUPPORTED:
            return {
                'status': 'unsupported_connector',
                'connector': c,
                'supported': sorted(self.SUPPORTED),
            }
        return {
            'status': 'simulated_success',
            'connector': c,
            'action': action,
            'payload': payload,
            'at': datetime.now(timezone.utc).isoformat(),
        }

    def unified_sync(self, objective: str, connectors: list[str]) -> dict[str, Any]:
        results = []
        for c in connectors:
            results.append(self.dispatch(c, 'sync.pull', {'objective': objective}))
        return {
            'objective': objective,
            'connectors': connectors,
            'results': results,
        }
