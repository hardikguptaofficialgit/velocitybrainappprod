from typing import Any


ROLE_ORDER = {
    'viewer': 10,
    'editor': 20,
    'admin': 30,
    'owner': 40,
}


class PermissionService:
    def _level(self, role: str | None) -> int:
        return ROLE_ORDER.get((role or 'viewer').lower(), 0)

    def can_write(self, role: str | None) -> bool:
        return self._level(role) >= ROLE_ORDER['editor']

    def can_admin(self, role: str | None) -> bool:
        return self._level(role) >= ROLE_ORDER['admin']

    def can_read_entity(self, entity: dict[str, Any], actor: str | None, role: str | None, org_key: str | None) -> bool:
        access = (entity.get('access_level') or 'private').lower()
        metadata = entity.get('metadata') or {}
        allowed_org = metadata.get('org_key')
        owners = set(metadata.get('owners', []))

        if access == 'public':
            return True

        if allowed_org and org_key and allowed_org == org_key:
            if access == 'restricted':
                return self._level(role) >= ROLE_ORDER['viewer']
            return self._level(role) >= ROLE_ORDER['editor']

        if actor and actor in owners:
            return True

        if access == 'restricted':
            return self._level(role) >= ROLE_ORDER['admin']

        return self._level(role) >= ROLE_ORDER['owner']

    def enforce_write(self, role: str | None) -> None:
        if not self.can_write(role):
            raise PermissionError('write permission denied (requires editor/admin/owner role)')
