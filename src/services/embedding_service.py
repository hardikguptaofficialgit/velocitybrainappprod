import hashlib
from typing import Protocol
import httpx

from src.core.config import settings
from src.core.logging_config import get_logger


class EmbeddingProvider(Protocol):
    def embed(self, text: str) -> list[float]: ...


class DeterministicEmbeddingProvider:
    """Local fallback embedding provider for deterministic, offline-safe behavior."""

    def __init__(self, dim: int):
        self.dim = dim

    def embed(self, text: str) -> list[float]:
        seed = hashlib.sha256(text.encode('utf-8', errors='ignore')).digest()
        out: list[float] = []
        for i in range(self.dim):
            b = seed[i % len(seed)]
            out.append((float(b) / 255.0) * 2.0 - 1.0)
        return out


class OpenAICompatibleEmbeddingProvider:
    """Hosted embedding provider for OpenAI-compatible APIs."""

    def __init__(self, *, api_key: str, model: str, dim: int, url: str):
        self.api_key = api_key
        self.model = model
        self.dim = dim
        self.url = url

    def embed(self, text: str) -> list[float]:
        response = httpx.post(
            self.url,
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'input': text or '',
                'model': self.model,
            },
            timeout=20.0,
        )
        response.raise_for_status()
        payload = response.json()
        data = payload.get('data') or []
        if not data or 'embedding' not in data[0]:
            raise RuntimeError('Embedding API returned no embedding vector')
        vector = [float(value) for value in data[0]['embedding']]
        if len(vector) != self.dim:
            raise RuntimeError(f'Embedding dimension mismatch: expected {self.dim}, got {len(vector)}')
        return vector


class EmbeddingService:
    def __init__(self):
        self.logger = get_logger('embedding_service')
        self.provider_name = settings.embedding_provider
        self.model = settings.embedding_model
        self.dim = settings.embed_dim
        self._provider = self._build_provider()

    def _build_provider(self) -> EmbeddingProvider:
        if self.provider_name == 'openai-compatible' and settings.embedding_api_key:
            try:
                return OpenAICompatibleEmbeddingProvider(
                    api_key=settings.embedding_api_key,
                    model=self.model,
                    dim=self.dim,
                    url=settings.embedding_service_url,
                )
            except Exception as exc:
                self.logger.warning('Falling back to deterministic embeddings after provider init failure: %s', exc)
        return DeterministicEmbeddingProvider(self.dim)

    def embed_text(self, text: str) -> dict:
        try:
            vector = self._provider.embed(text or '')
        except Exception as exc:
            if not isinstance(self._provider, DeterministicEmbeddingProvider):
                self.logger.warning('Embedding request failed, falling back to deterministic provider: %s', exc)
                self._provider = DeterministicEmbeddingProvider(self.dim)
                self.provider_name = 'local'
                self.model = f'deterministic-fallback:{settings.embedding_model}'
                vector = self._provider.embed(text or '')
            else:
                raise
        return {
            'provider': self.provider_name,
            'model': self.model,
            'dim': self.dim,
            'vector': vector,
        }
