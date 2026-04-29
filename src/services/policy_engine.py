from typing import Any

from src.core.config import settings
from src.services.compliance_service import ComplianceService


class PolicyEngine:
    DESTRUCTIVE_TOOLS = {'delete_page', 'put_page', 'sync_brain'}

    def __init__(self):
        self.compliance = ComplianceService()

    def _audit_destructive_tool(self, name: str, arguments: dict[str, Any], allowed: bool, actor: str = 'mcp') -> None:
        approval = bool(arguments.get('approve'))
        payload = {
            'tool': name,
            'actor': actor,
            'allowed': allowed,
            'approval_flag': approval,
            'policy_override_enabled': settings.mcp_allow_destructive_tools,
            'argument_keys': sorted(arguments.keys()),
        }
        if not allowed:
            payload['reason'] = 'blocked_by_policy'
        event_type = 'destructive_tool_allowed' if allowed else 'destructive_tool_blocked'
        try:
            self.compliance.log_event(event_type, actor, payload)
        except Exception:
            pass

    def check_tool_call(self, name: str, arguments: dict[str, Any] | None = None) -> None:
        args = arguments or {}
        if name in self.DESTRUCTIVE_TOOLS:
            allow = settings.mcp_allow_destructive_tools or bool(args.get('approve'))
            self._audit_destructive_tool(name, args, allow)
            if not allow:
                raise PermissionError(
                    f"Tool '{name}' is destructive and blocked by policy. "
                    "Pass approve=true and set MCP_ALLOW_DESTRUCTIVE_TOOLS=true to enable."
                )
