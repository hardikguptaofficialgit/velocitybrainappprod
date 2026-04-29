import base64
import hashlib
import hmac
import json
import time
from pathlib import Path

from src.core.config import settings


class AccessControlService:
    def __init__(self):
        secret = (getattr(settings, 'app_name', 'velocitybrain') + '::' + settings.database_url).encode('utf-8')
        self.key = hashlib.sha256(secret).digest()
        self.storage = Path(settings.local_storage_path)
        self.storage.mkdir(parents=True, exist_ok=True)

    def _xor_crypt(self, data: bytes) -> bytes:
        stream = hashlib.pbkdf2_hmac('sha256', self.key, b'velocitybrain-legacy', 10000, dklen=max(len(data), 32))
        return bytes(b ^ stream[i % len(stream)] for i, b in enumerate(data))

    def _sign(self, msg: bytes) -> str:
        return hmac.new(self.key, msg, hashlib.sha256).hexdigest()

    def mint_access_token(self, actor: str, scopes: list[str], ttl_seconds: int = 3600) -> dict:
        payload = {
            'actor': actor,
            'scopes': scopes,
            'exp': int(time.time()) + max(60, int(ttl_seconds)),
        }
        raw = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        token = base64.urlsafe_b64encode(raw).decode('utf-8') + '.' + self._sign(raw)
        return {'token': token, 'payload': payload}

    def verify_access_token(self, token: str) -> dict:
        body, sig = token.split('.', 1)
        raw = base64.urlsafe_b64decode(body.encode('utf-8'))
        if not hmac.compare_digest(sig, self._sign(raw)):
            raise PermissionError('invalid token signature')
        payload = json.loads(raw.decode('utf-8'))
        if int(payload.get('exp', 0)) < int(time.time()):
            raise PermissionError('token expired')
        return payload

    def save_legacy_plan(self, owner: str, beneficiaries: list[str], instructions: str) -> dict:
        doc = {
            'owner': owner,
            'beneficiaries': beneficiaries,
            'instructions': instructions,
            'updated_at': int(time.time()),
        }
        raw = json.dumps(doc, ensure_ascii=False).encode('utf-8')
        encrypted = self._xor_crypt(raw)
        out = self.storage / f'legacy_{owner}.enc'
        out.write_bytes(encrypted)
        return {'owner': owner, 'path': str(out), 'encrypted': True}

    def load_legacy_plan(self, owner: str) -> dict:
        p = self.storage / f'legacy_{owner}.enc'
        if not p.exists():
            raise FileNotFoundError(f'legacy plan not found for owner={owner}')
        raw = self._xor_crypt(p.read_bytes())
        return json.loads(raw.decode('utf-8'))
