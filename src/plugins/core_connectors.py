from datetime import datetime, timezone


class CoreConnectors:
    def _not_configured(self, channel: str, payload: dict, *, provider: str | None = None, action: str | None = None) -> dict:
        return {
            'status': 'not_configured',
            'channel': channel,
            'provider': provider,
            'action': action,
            'payload': payload,
            'at': datetime.now(timezone.utc).isoformat(),
            'message': f'{channel} connector is not configured for real delivery.',
        }

    def send_email(self, payload: dict) -> dict:
        return self._not_configured('email', payload)

    def schedule_calendar(self, payload: dict) -> dict:
        return self._not_configured('calendar', payload)

    def send_message(self, payload: dict) -> dict:
        return self._not_configured('messaging', payload)

    def google_workspace(self, action: str, payload: dict) -> dict:
        supported = {'gmail.send', 'calendar.schedule', 'drive.create_note'}
        if action not in supported:
            return {
                'status': 'unsupported_action',
                'provider': 'google_workspace',
                'supported_actions': sorted(supported),
                'requested_action': action,
                'payload': payload,
            }
        return self._not_configured('google_workspace', payload, provider='google_workspace', action=action)
