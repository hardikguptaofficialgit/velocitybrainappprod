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
            'status': 'not_configured',
            'connector': c,
            'action': action,
            'payload': payload,
            'at': datetime.now(timezone.utc).isoformat(),
            'message': f'{c} connector is not configured for real execution.',
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
