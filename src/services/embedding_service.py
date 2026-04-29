import hashlib
from typing import Protocol

from src.core.config import settings


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


class EmbeddingService:
    def __init__(self):
        self.provider_name = settings.embedding_provider
        self.model = settings.embedding_model
        self.dim = settings.embed_dim
        self._provider: EmbeddingProvider = DeterministicEmbeddingProvider(self.dim)

    def embed_text(self, text: str) -> dict:
        vector = self._provider.embed(text or '')
        return {
            'provider': self.provider_name,
            'model': self.model,
            'dim': self.dim,
            'vector': vector,
        }
