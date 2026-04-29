import re
from datetime import datetime, timezone


class MeetingCopilotService:
    def summarize_transcript(self, transcript: str) -> dict:
        lines = [ln.strip() for ln in transcript.splitlines() if ln.strip()]
        actions = []
        for ln in lines:
            if re.search(r'\b(will|should|need to|todo|action)\b', ln.lower()):
                actions.append(ln)
        return {
            'summary': ' '.join(lines[:6])[:600],
            'action_items': actions[:20],
            'followup_draft': self._followup(actions[:5]),
            'at': datetime.now(timezone.utc).isoformat(),
        }

    def _followup(self, actions: list[str]) -> str:
        if not actions:
            return 'Thanks everyone. No explicit action items were captured.'
        bullets = '\n'.join([f'- {a}' for a in actions])
        return f"Thanks everyone. Recap of agreed action items:\n{bullets}\nPlease confirm owners and due dates."
