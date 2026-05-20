from __future__ import annotations

import gzip
import hashlib
import math
import os
import threading
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import tiktoken
from psycopg.types.json import Json

from src.core.db import get_conn
from src.core.config import settings
from src.core.logging_config import get_logger
from src.services.embedding_service import EmbeddingService


ARTIFACT_KINDS = {
    'repo_map',
    'summary',
    'plan',
    'decision',
    'answer',
    'debug_trace',
    'diff_explanation',
}
REUSE_HIT_TYPES = {'none', 'exact', 'semantic', 'repo_context'}
CACHE_MAX_ENTRIES = 256
REPO_ARTIFACT_CAP = 500
REUSE_CONFIDENCE_THRESHOLD = 0.5
BORDERLINE_CONFIDENCE_THRESHOLD = 0.65


@dataclass
class Artifact:
    artifact_id: str
    workspace_id: str
    repo_id: str
    branch: str | None
    commit: str | None
    task_type: str
    fingerprint: str
    artifact_kind: str
    compressed_text: bytes
    text_is_compressed: bool
    embedding: list[float] | None
    source_run_id: str
    context_paths: list[str]
    file_hashes: dict[str, str]
    base_confidence: float
    quality_confidence: float
    reuse_successes: int
    reuse_failures: int
    token_cost_to_create: int
    created_at: str
    last_used_at: str | None = None
    blacklisted_fingerprints: list[str] | None = None


class ReuseService:
    _artifacts: list[Artifact] = []
    _artifacts_by_repo: dict[str, list[Artifact]] = {}
    _task_runs: list[dict[str, Any]] = []
    _run_logs: list[dict[str, Any]] = []
    _user_metrics: dict[str, dict[str, Any]] = {}
    _repo_metrics: dict[str, dict[str, Any]] = {}
    _repeat_index: dict[str, dict[str, Any]] = {}
    _low_value_users: list[dict[str, Any]] = []
    _reuse_decisions: list[dict[str, Any]] = []
    _savings_events: list[dict[str, Any]] = []
    _failure_events: list[dict[str, Any]] = []
    _latency_events: list[dict[str, float]] = []
    _exact_cache: OrderedDict[str, str] = OrderedDict()
    _state_loaded = False
    _state_backend: str | None = None
    _lock = threading.RLock()

    def __init__(self) -> None:
        self.logger = get_logger('reuse_service')
        self.embedding = EmbeddingService()
        self.encoding = self._load_encoding()
        self.state_key = os.getenv('VELOCITYBRAIN_REUSE_STATE_KEY', 'global')
        self.persistence_backend = os.getenv('VELOCITYBRAIN_REUSE_BACKEND', 'database').strip().lower() or 'database'
        self.persistence_required = os.getenv(
            'VELOCITYBRAIN_REQUIRE_PERSISTENCE',
            '1' if settings.env in {'prod', 'production'} else '0',
        ) != '0'
        self._inside_persisted_mutation = False
        self._ensure_state_loaded()

    def _load_encoding(self):
        try:
            return tiktoken.get_encoding('cl100k_base')
        except Exception as exc:
            self.logger.warning(
                'Falling back to approximate token counting because tiktoken encoding could not be loaded: %s',
                exc,
            )
            return None

    def _ensure_state_loaded(self) -> None:
        with self._lock:
            if ReuseService._state_loaded and ReuseService._state_backend == self.persistence_backend:
                return
            ReuseService._state_backend = self.persistence_backend
            try:
                if self.persistence_backend == 'database':
                    snapshot = self._load_snapshot_from_database()
                    if snapshot:
                        self.restore_state(snapshot, persist=False)
                    else:
                        self.reset_state(persist=False)
                        self._persist_state_locked()
                else:
                    self.reset_state(persist=False)
                ReuseService._state_loaded = True
            except Exception as exc:
                if self.persistence_required:
                    raise RuntimeError(f'VelocityBrain persistence initialization failed: {exc}') from exc
                self.logger.warning('Reuse persistence unavailable, continuing with in-memory state: %s', exc)
                self.persistence_backend = 'memory'
                ReuseService._state_backend = self.persistence_backend
                self.reset_state(persist=False)
                ReuseService._state_loaded = True

    def _persist_state_locked(self) -> None:
        if self.persistence_backend != 'database':
            return
        try:
            snapshot = self.snapshot_state()
            self._save_snapshot_to_database(snapshot)
        except Exception as exc:
            if self.persistence_required:
                raise RuntimeError(f'VelocityBrain persistence write failed: {exc}') from exc
            self.logger.warning('Reuse persistence write skipped after error: %s', exc)

    def _load_snapshot_from_database(self) -> dict[str, Any] | None:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS runtime_state (
                      state_key TEXT PRIMARY KEY,
                      state_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                      version BIGINT NOT NULL DEFAULT 1,
                      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    "SELECT state_payload FROM runtime_state WHERE state_key = %s",
                    (self.state_key,),
                )
                row = cur.fetchone()
                conn.commit()
        if not row:
            return None
        return row.get('state_payload') or None

    def _save_snapshot_to_database(self, snapshot: dict[str, Any]) -> None:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS runtime_state (
                      state_key TEXT PRIMARY KEY,
                      state_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                      version BIGINT NOT NULL DEFAULT 1,
                      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    "SELECT version FROM runtime_state WHERE state_key = %s",
                    (self.state_key,),
                )
                row = cur.fetchone()
                if row:
                    cur.execute(
                        """
                        UPDATE runtime_state
                        SET state_payload = %s,
                            version = %s,
                            updated_at = NOW()
                        WHERE state_key = %s
                        """,
                        (Json(snapshot), int(row['version']) + 1, self.state_key),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO runtime_state (state_key, state_payload, version)
                        VALUES (%s, %s, 1)
                        """,
                        (self.state_key, Json(snapshot)),
                    )
                conn.commit()

    def _refresh_state_locked(self) -> None:
        if self.persistence_backend != 'database' or self._inside_persisted_mutation:
            return
        snapshot = self._load_snapshot_from_database()
        if snapshot:
            self.restore_state(snapshot, persist=False)

    def _run_state_mutation(self, mutator):
        with self._lock:
            if self.persistence_backend != 'database':
                return mutator()
            try:
                self._inside_persisted_mutation = True
                snapshot = self._load_snapshot_from_database()
                if snapshot:
                    self.restore_state(snapshot, persist=False)
                else:
                    self.reset_state(persist=False)
                result = mutator()
                self._persist_state_locked()
                return result
            finally:
                self._inside_persisted_mutation = False

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _normalize_text(self, text: str) -> str:
        return ' '.join((text or '').replace('\r\n', '\n').replace('\r', '\n').strip().split())[:12000]

    def _normalize_prompt_structure(self, text: str) -> str:
        return self._normalize_text(text).lower()

    def _normalize_context_paths(self, metadata: dict[str, Any] | None) -> list[str]:
        raw_paths = (metadata or {}).get('context_paths') or []
        normalized = {
            str(Path(raw_path)).replace('\\', '/').lower()
            for raw_path in raw_paths
            if raw_path
        }
        return sorted(normalized)

    def _normalize_file_hashes(self, metadata: dict[str, Any] | None) -> dict[str, str]:
        raw_hashes = (metadata or {}).get('file_hashes') or {}
        return {
            str(Path(path)).replace('\\', '/').lower(): str(file_hash)
            for path, file_hash in raw_hashes.items()
            if path and file_hash
        }

    def _default_workspace(self, metadata: dict[str, Any] | None) -> tuple[str, str, str | None, str | None]:
        meta = metadata or {}
        workspace_id = str(meta.get('workspace_id') or meta.get('workspace') or 'default-workspace')
        repo_id = str(meta.get('repo_id') or meta.get('repo') or workspace_id)
        return workspace_id, repo_id, meta.get('branch'), meta.get('commit')

    def _user_id(self, metadata: dict[str, Any] | None) -> str:
        meta = metadata or {}
        return str(meta.get('user_id') or meta.get('api_key') or meta.get('workspace_id') or 'anonymous')

    def _classify_task_type(self, text: str) -> str:
        lowered = (text or '').lower()
        if any(token in lowered for token in ['auth', 'billing', 'api key', 'repo', 'architecture']):
            return 'repo_analysis'
        if any(token in lowered for token in ['review', 'pr', 'diff']):
            return 'review'
        if any(token in lowered for token in ['debug', 'bug', 'fix', 'error']):
            return 'debug'
        if any(token in lowered for token in ['plan', 'prepare', 'map']):
            return 'planning'
        return 'general'

    def compute_fingerprint(
        self,
        input_context: dict[str, Any] | None = None,
        *,
        repo_id: str | None = None,
        task_type: str | None = None,
        prompt: str | None = None,
        context_paths: list[str] | None = None,
    ) -> str:
        source = input_context or {}
        resolved_repo_id = str(repo_id or source.get('repo_id') or 'default-repo')
        resolved_task_type = str(task_type or source.get('task_type') or 'general')
        resolved_prompt = str(prompt or source.get('prompt') or source.get('task_text') or '')
        normalized_paths = sorted(context_paths or source.get('context_paths') or [])
        payload = '::'.join([
            resolved_repo_id,
            resolved_task_type,
            '|'.join(normalized_paths),
            self._normalize_prompt_structure(resolved_prompt),
        ])
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()

    def _repeat_key(self, *, repo_id: str, task_text: str) -> str:
        payload = f"{repo_id}::{self._normalize_prompt_structure(task_text)}"
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()

    def serialize_prompt(self, *, task_text: str, context_text: str, reused: bool) -> str:
        label = 'REUSED_CONTEXT' if reused else 'FULL_REPO_CONTEXT'
        return f'TASK\n{self._normalize_prompt_structure(task_text)}\n\n{label}\n{context_text}'

    def _estimate_tokens(self, text: str) -> int:
        normalized = (text or '').strip()
        if not normalized:
            return 1
        if self.encoding is not None:
            return max(1, len(self.encoding.encode(normalized)))
        # Approximate fallback for offline/sandboxed environments.
        return max(1, math.ceil(len(normalized) / 4))

    def _estimate_cost(self, tokens: int) -> float:
        return round(tokens * 0.000003, 6)

    def _estimate_latency_saved_ms(self, avoided_tokens: int, hit_type: str) -> int:
        base = 0 if hit_type == 'none' else 10
        return int(base + (avoided_tokens * 1.2))

    def _assert_invariants(self, *, tokens_saved: int, percent_saved: float, reuse_confidence: float) -> None:
        if tokens_saved < 0:
            raise AssertionError('tokens_saved must be >= 0')
        if percent_saved < 0:
            raise AssertionError('percent_saved must be >= 0')
        if not 0.0 <= reuse_confidence <= 1.0:
            raise AssertionError('reuse_confidence must be within [0, 1]')

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(y * y for y in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _path_overlap(self, requested_paths: list[str], artifact_paths: list[str]) -> float:
        if not requested_paths or not artifact_paths:
            return 0.0
        requested = set(requested_paths)
        actual = set(artifact_paths)
        return len(requested & actual) / len(requested)

    def _hash_overlap(self, requested_hashes: dict[str, str], artifact_hashes: dict[str, str]) -> float:
        if not requested_hashes or not artifact_hashes:
            return 0.0
        overlap = 0
        for path, file_hash in requested_hashes.items():
            if artifact_hashes.get(path) == file_hash:
                overlap += 1
        return overlap / len(requested_hashes)

    def _decompress_text(self, compressed_text: bytes) -> str:
        return gzip.decompress(compressed_text).decode('utf-8')

    def _compress_text(self, normalized_text: str) -> tuple[bytes, bool]:
        raw_bytes = normalized_text.encode('utf-8')
        compressed = gzip.compress(raw_bytes)
        if len(compressed) < len(raw_bytes):
            return compressed, True
        return raw_bytes, False

    def _artifact_text(self, artifact: Artifact) -> str:
        if artifact.text_is_compressed:
            return self._decompress_text(artifact.compressed_text)
        return artifact.compressed_text.decode('utf-8')

    def _artifact_text_size(self, artifact: Artifact) -> int:
        return len(artifact.compressed_text)

    def _artifact_embedding(self, artifact: Artifact) -> list[float]:
        if artifact.embedding is None:
            artifact.embedding = self.embedding.embed_text(self._artifact_text(artifact))['vector']
        return artifact.embedding

    def _recency_weight(self, artifact: Artifact) -> float:
        reference = artifact.last_used_at or artifact.created_at
        try:
            age_seconds = max(0.0, (datetime.now(timezone.utc) - datetime.fromisoformat(reference)).total_seconds())
        except ValueError:
            return 1.0
        age_hours = age_seconds / 3600.0
        return round(max(0.55, 1.0 - min(age_hours / 168.0, 0.45)), 3)

    def _quality_score(self, artifact: Artifact) -> float:
        total = artifact.reuse_successes + artifact.reuse_failures
        success_rate = artifact.reuse_successes / total if total else 1.0
        score = artifact.base_confidence * success_rate * self._recency_weight(artifact)
        return round(max(0.1, min(1.0, score)), 3)

    def _remember_cache_entry(self, fingerprint: str, artifact_id: str) -> None:
        self._exact_cache[fingerprint] = artifact_id
        self._exact_cache.move_to_end(fingerprint)
        while len(self._exact_cache) > CACHE_MAX_ENTRIES:
            self._exact_cache.popitem(last=False)

    def _evict_repo_artifacts(self, repo_id: str) -> None:
        repo_artifacts = self._artifacts_by_repo.get(repo_id, [])
        if len(repo_artifacts) <= REPO_ARTIFACT_CAP:
            return
        ranked = sorted(
            repo_artifacts,
            key=lambda artifact: (artifact.last_used_at or artifact.created_at, artifact.created_at),
        )
        while len(repo_artifacts) > REPO_ARTIFACT_CAP and ranked:
            victim = ranked.pop(0)
            repo_artifacts.remove(victim)
            self._artifacts = [artifact for artifact in self._artifacts if artifact.artifact_id != victim.artifact_id]
            for key, value in list(self._exact_cache.items()):
                if value == victim.artifact_id:
                    self._exact_cache.pop(key, None)

    def _artifact_from_cache(self, fingerprint: str, requested_kinds: set[str]) -> Artifact | None:
        artifact_id = self._exact_cache.get(fingerprint)
        if not artifact_id:
            return None
        for artifact in reversed(self._artifacts):
            if artifact.artifact_id != artifact_id:
                continue
            if artifact.artifact_kind not in requested_kinds:
                return None
            if fingerprint in (artifact.blacklisted_fingerprints or []):
                return None
            self._exact_cache.move_to_end(fingerprint)
            return artifact
        return None

    def should_expect_reuse(self, task_text: str, metadata: dict[str, Any] | None = None) -> bool:
        _, repo_id, _, _ = self._default_workspace(metadata)
        requested_paths = self._normalize_context_paths(metadata)
        task_type = self._classify_task_type(task_text)
        fingerprint = self.compute_fingerprint(
            repo_id=repo_id,
            task_type=task_type,
            prompt=task_text,
            context_paths=requested_paths,
        )
        with self._lock:
            repo_artifacts = self._artifacts_by_repo.get(repo_id, [])
            return any(
                artifact.fingerprint == fingerprint or self._path_overlap(requested_paths, artifact.context_paths) > 0
                for artifact in repo_artifacts
            )

    def reset_state(self, *, persist: bool = True) -> None:
        with self._lock:
            self._artifacts.clear()
            self._artifacts_by_repo.clear()
            self._task_runs.clear()
            self._run_logs.clear()
            self._user_metrics.clear()
            self._repo_metrics.clear()
            self._repeat_index.clear()
            self._low_value_users.clear()
            self._reuse_decisions.clear()
            self._savings_events.clear()
            self._failure_events.clear()
            self._latency_events.clear()
            self._exact_cache.clear()
            if persist and ReuseService._state_loaded:
                self._persist_state_locked()

    def snapshot_state(self) -> dict[str, Any]:
        with self._lock:
            return {
                'artifacts': [self._snapshot_artifact_payload(artifact) for artifact in self._artifacts],
                'task_runs': list(self._task_runs),
                'run_logs': list(self._run_logs),
                'user_metrics': dict(self._user_metrics),
                'repo_metrics': dict(self._repo_metrics),
                'repeat_index': dict(self._repeat_index),
                'low_value_users': list(self._low_value_users),
                'reuse_decisions': list(self._reuse_decisions),
                'savings_events': list(self._savings_events),
                'failure_events': list(self._failure_events),
                'latency_events': list(self._latency_events),
                'exact_cache': list(self._exact_cache.items()),
            }

    def restore_state(self, snapshot: dict[str, Any] | None, *, persist: bool = True) -> None:
        self.reset_state(persist=False)
        if not snapshot:
            if persist:
                self._persist_state_locked()
            return
        with self._lock:
            for payload in snapshot.get('artifacts', []):
                legacy_text = payload.get('normalized_text', '')
                stored_text, text_is_compressed = self._compress_text(legacy_text)
                artifact = Artifact(
                    artifact_id=payload['artifact_id'],
                    workspace_id=payload['workspace_id'],
                    repo_id=payload['repo_id'],
                    branch=payload.get('branch'),
                    commit=payload.get('commit'),
                    task_type=payload['task_type'],
                    fingerprint=payload['fingerprint'],
                    artifact_kind=payload['artifact_kind'],
                    compressed_text=(
                        bytes.fromhex(payload['compressed_text_hex'])
                        if payload.get('compressed_text_hex')
                        else stored_text
                    ),
                    text_is_compressed=bool(
                        payload.get('text_is_compressed')
                        if payload.get('compressed_text_hex') is not None
                        else text_is_compressed
                    ),
                    embedding=payload.get('embedding'),
                    source_run_id=payload.get('source_run_id', 'restored'),
                    context_paths=payload.get('context_paths', []),
                    file_hashes=payload.get('file_hashes', {}),
                    base_confidence=float(payload.get('base_confidence', 0.74)),
                    quality_confidence=float(payload.get('quality_confidence', 0.74)),
                    reuse_successes=int(payload.get('reuse_successes', 0)),
                    reuse_failures=int(payload.get('reuse_failures', 0)),
                    token_cost_to_create=int(payload.get('token_cost_to_create', 0)),
                    created_at=payload.get('created_at', self._now()),
                    last_used_at=payload.get('last_used_at'),
                    blacklisted_fingerprints=payload.get('blacklisted_fingerprints', []),
                )
                self._artifacts.append(artifact)
                self._artifacts_by_repo.setdefault(artifact.repo_id, []).append(artifact)
            self._task_runs.extend(snapshot.get('task_runs', []))
            self._run_logs.extend(snapshot.get('run_logs', []))
            self._user_metrics.update(snapshot.get('user_metrics', {}))
            self._repo_metrics.update(snapshot.get('repo_metrics', {}))
            self._repeat_index.update(snapshot.get('repeat_index', {}))
            self._low_value_users.extend(snapshot.get('low_value_users', []))
            self._reuse_decisions.extend(snapshot.get('reuse_decisions', []))
            self._savings_events.extend(snapshot.get('savings_events', []))
            self._failure_events.extend(snapshot.get('failure_events', []))
            self._latency_events.extend(snapshot.get('latency_events', []))
            for key, value in snapshot.get('exact_cache', []):
                self._exact_cache[key] = value
            if persist:
                self._persist_state_locked()

    def _store_artifact_locked(
        self,
        *,
        task_text: str,
        artifact_text: str,
        artifact_kind: str = 'answer',
        source_run_id: str,
        metadata: dict[str, Any] | None = None,
        quality_confidence: float = 0.74,
    ) -> dict[str, Any]:
        kind = artifact_kind if artifact_kind in ARTIFACT_KINDS else 'answer'
        workspace_id, repo_id, branch, commit = self._default_workspace(metadata)
        context_paths = self._normalize_context_paths(metadata)
        file_hashes = self._normalize_file_hashes(metadata)
        task_type = self._classify_task_type(task_text)
        normalized_text = self._normalize_text(artifact_text)
        fingerprint = self.compute_fingerprint(
            repo_id=repo_id,
            task_type=task_type,
            prompt=task_text,
            context_paths=context_paths,
        )
        stored_text, text_is_compressed = self._compress_text(normalized_text)
        artifact = Artifact(
            artifact_id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            repo_id=repo_id,
            branch=branch,
            commit=commit,
            task_type=task_type,
            fingerprint=fingerprint,
            artifact_kind=kind,
            compressed_text=stored_text,
            text_is_compressed=text_is_compressed,
            embedding=None,
            source_run_id=source_run_id,
            context_paths=context_paths,
            file_hashes=file_hashes,
            base_confidence=quality_confidence,
            quality_confidence=quality_confidence,
            reuse_successes=1,
            reuse_failures=0,
            token_cost_to_create=self._estimate_tokens(normalized_text),
            created_at=self._now(),
            blacklisted_fingerprints=[],
        )
        self._artifacts.append(artifact)
        self._artifacts_by_repo.setdefault(repo_id, []).append(artifact)
        self._remember_cache_entry(fingerprint, artifact.artifact_id)
        self._evict_repo_artifacts(repo_id)
        return {
            'artifact_id': artifact.artifact_id,
            'workspace_id': workspace_id,
            'repo_id': repo_id,
            'artifact_kind': kind,
            'task_type': task_type,
            'token_cost_to_create': artifact.token_cost_to_create,
        }

    def store_artifact(
        self,
        *,
        task_text: str,
        artifact_text: str,
        artifact_kind: str = 'answer',
        source_run_id: str,
        metadata: dict[str, Any] | None = None,
        quality_confidence: float = 0.74,
    ) -> dict[str, Any]:
        return self._run_state_mutation(
            lambda: self._store_artifact_locked(
                task_text=task_text,
                artifact_text=artifact_text,
                artifact_kind=artifact_kind,
                source_run_id=source_run_id,
                metadata=metadata,
                quality_confidence=quality_confidence,
            )
        )

    def _validate_reuse_candidate(self, artifact: Artifact, requested_paths: list[str]) -> bool:
        if not requested_paths:
            return True
        text = self._artifact_text(artifact)
        required = [f'[{path}]' for path in requested_paths]
        coverage = sum(1 for marker in required if marker in text) / len(required)
        return coverage >= 0.5

    def _register_reuse_rejection(self, *, task_text: str, artifact: Artifact, confidence: float) -> None:
        failure_event = {
            'task': task_text,
            'artifact_id': artifact.artifact_id,
            'failure_type': 'reuse_rejected_after_validation',
            'confidence': confidence,
            'timestamp': self._now(),
        }
        self._failure_events.append(failure_event)

    def retrieve_reuse_context(
        self,
        task_text: str,
        *,
        metadata: dict[str, Any] | None = None,
        artifact_kinds: list[str] | None = None,
        include_debug: bool = False,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        with self._lock:
            self._refresh_state_locked()
        _, repo_id, _, _ = self._default_workspace(metadata)
        requested_paths = self._normalize_context_paths(metadata)
        requested_hashes = self._normalize_file_hashes(metadata)
        task_type = self._classify_task_type(task_text)
        fingerprint_started = time.perf_counter()
        fingerprint = self.compute_fingerprint(
            repo_id=repo_id,
            task_type=task_type,
            prompt=task_text,
            context_paths=requested_paths,
        )
        requested_kinds = set(artifact_kinds or ARTIFACT_KINDS)
        fingerprint_ms = (time.perf_counter() - fingerprint_started) * 1000

        cache_started = time.perf_counter()
        with self._lock:
            cache_artifact = self._artifact_from_cache(fingerprint, requested_kinds)
        cache_ms = (time.perf_counter() - cache_started) * 1000
        if cache_artifact:
            cache_artifact.last_used_at = self._now()
            result = self._build_reuse_result(
                hit_type='exact',
                reuse_confidence=1.0,
                artifact=cache_artifact,
                fingerprint=fingerprint,
                requested_paths=requested_paths,
                exact_count=1,
                repo_count=0,
                semantic_count=0,
                skipped=['retrieval pipeline skipped because exact cache hit'],
                include_debug=include_debug,
            )
            latency_sample = {
                'fingerprint_ms': fingerprint_ms,
                'cache_lookup_ms': cache_ms,
                'artifact_scan_ms': 0.0,
                'ranking_ms': 0.0,
                'total_ms': (time.perf_counter() - started) * 1000,
            }
            self._record_latency(latency_sample)
            if include_debug:
                result.setdefault('debug', {})['latency_ms'] = {
                    'fingerprint': round(latency_sample['fingerprint_ms'], 3),
                    'cache_lookup': round(latency_sample['cache_lookup_ms'], 3),
                    'artifact_scan': 0.0,
                    'ranking': 0.0,
                    'total': round(latency_sample['total_ms'], 3),
                }
            return result

        scan_started = time.perf_counter()
        task_embedding = self.embedding.embed_text(self._normalize_text(task_text))['vector']
        with self._lock:
            repo_artifacts = list(self._artifacts_by_repo.get(repo_id, []))
        exact_artifact = next(
            (
                artifact for artifact in reversed(repo_artifacts)
                if artifact.fingerprint == fingerprint
                and artifact.artifact_kind in requested_kinds
                and fingerprint not in (artifact.blacklisted_fingerprints or [])
            ),
            None,
        )
        repo_candidates = [
            artifact for artifact in repo_artifacts
            if artifact.artifact_kind in requested_kinds
            and fingerprint not in (artifact.blacklisted_fingerprints or [])
        ]
        scan_ms = (time.perf_counter() - scan_started) * 1000

        ranking_started = time.perf_counter()
        if exact_artifact:
            exact_artifact.last_used_at = self._now()
            with self._lock:
                self._remember_cache_entry(fingerprint, exact_artifact.artifact_id)
            result = self._build_reuse_result(
                hit_type='exact',
                reuse_confidence=1.0,
                artifact=exact_artifact,
                fingerprint=fingerprint,
                requested_paths=requested_paths,
                exact_count=1,
                repo_count=0,
                semantic_count=0,
                skipped=['repo-context and semantic matching skipped because exact fingerprint hit'],
                include_debug=include_debug,
            )
        else:
            repo_candidates.sort(
                key=lambda artifact: (
                    self._quality_score(artifact),
                    self._hash_overlap(requested_hashes, artifact.file_hashes),
                    self._path_overlap(requested_paths, artifact.context_paths),
                    self._cosine_similarity(task_embedding, self._artifact_embedding(artifact)),
                    artifact.last_used_at or artifact.created_at,
                ),
                reverse=True,
            )
            result = self._select_ranked_result(
                task_text=task_text,
                fingerprint=fingerprint,
                requested_paths=requested_paths,
                requested_hashes=requested_hashes,
                task_embedding=task_embedding,
                repo_candidates=repo_candidates,
                include_debug=include_debug,
            )
        ranking_ms = (time.perf_counter() - ranking_started) * 1000
        total_ms = (time.perf_counter() - started) * 1000
        latency_sample = {
            'fingerprint_ms': fingerprint_ms,
            'cache_lookup_ms': cache_ms,
            'artifact_scan_ms': scan_ms,
            'ranking_ms': ranking_ms,
            'total_ms': total_ms,
        }
        self._record_latency(latency_sample)
        if include_debug:
            result.setdefault('debug', {})['latency_ms'] = {
                'fingerprint': round(latency_sample['fingerprint_ms'], 3),
                'cache_lookup': round(latency_sample['cache_lookup_ms'], 3),
                'artifact_scan': round(latency_sample['artifact_scan_ms'], 3),
                'ranking': round(latency_sample['ranking_ms'], 3),
                'total': round(latency_sample['total_ms'], 3),
            }
        return result

    def _select_ranked_result(
        self,
        *,
        task_text: str,
        fingerprint: str,
        requested_paths: list[str],
        requested_hashes: dict[str, str],
        task_embedding: list[float],
        repo_candidates: list[Artifact],
        include_debug: bool,
    ) -> dict[str, Any]:
        if repo_candidates:
            top = repo_candidates[0]
            hash_overlap = self._hash_overlap(requested_hashes, top.file_hashes)
            path_overlap = self._path_overlap(requested_paths, top.context_paths)
            similarity = self._cosine_similarity(task_embedding, self._artifact_embedding(top))
            repeat_info = self._repeat_index.get(self._repeat_key(repo_id=top.repo_id, task_text=task_text), {})
            repeat_boost = 0.05 if int(repeat_info.get('repeat_count', 0)) > 0 else 0.0
            repo_confidence = round(min(0.95, 0.7 + (hash_overlap * 0.15) + (path_overlap * 0.1) + repeat_boost), 3)
            semantic_confidence = round(min(0.75, max(0.4, similarity + repeat_boost)), 3)
            if repo_confidence >= REUSE_CONFIDENCE_THRESHOLD and (hash_overlap > 0 or path_overlap > 0 or top.artifact_kind in {'repo_map', 'summary'}):
                if self._validate_reuse_candidate(top, requested_paths):
                    top.last_used_at = self._now()
                    return self._build_reuse_result(
                        hit_type='repo_context',
                        reuse_confidence=repo_confidence,
                        artifact=top,
                        fingerprint=fingerprint,
                        requested_paths=requested_paths,
                        exact_count=0,
                        repo_count=len(repo_candidates),
                        semantic_count=0,
                        skipped=['exact fingerprint miss'] + (['borderline repo-context confidence'] if repo_confidence < BORDERLINE_CONFIDENCE_THRESHOLD else []),
                        include_debug=include_debug,
                    )
                self._register_reuse_rejection(task_text=task_text, artifact=top, confidence=repo_confidence)

            if semantic_confidence >= REUSE_CONFIDENCE_THRESHOLD:
                if self._validate_reuse_candidate(top, requested_paths):
                    top.last_used_at = self._now()
                    return self._build_reuse_result(
                        hit_type='semantic',
                        reuse_confidence=semantic_confidence,
                        artifact=top,
                        fingerprint=fingerprint,
                        requested_paths=requested_paths,
                        exact_count=0,
                        repo_count=0,
                        semantic_count=1,
                        skipped=['exact fingerprint miss', 'repo overlap not strong enough'] + (['borderline semantic confidence'] if semantic_confidence < BORDERLINE_CONFIDENCE_THRESHOLD else []),
                        include_debug=include_debug,
                    )
                self._register_reuse_rejection(task_text=task_text, artifact=top, confidence=semantic_confidence)

        result = {
            'hit_type': 'none',
            'confidence': 0.0,
            'reuse_confidence': 0.0,
            'reused': False,
            'result': '',
            'artifacts': [],
        }
        if include_debug:
            result['debug'] = self._debug_payload(
                hit_type='none',
                task_type=self._classify_task_type(task_text),
                fingerprint=fingerprint,
                artifact=None,
                requested_paths=requested_paths,
                exact_count=0,
                repo_count=len(repo_candidates),
                semantic_count=len(repo_candidates),
                skipped=[
                    'exact fingerprint miss',
                    'no same-repo artifact matched overlapping files strongly enough',
                    'semantic confidence below threshold',
                ],
            )
        return result

    def _build_reuse_result(
        self,
        *,
        hit_type: str,
        reuse_confidence: float,
        artifact: Artifact,
        fingerprint: str,
        requested_paths: list[str],
        exact_count: int,
        repo_count: int,
        semantic_count: int,
        skipped: list[str],
        include_debug: bool,
    ) -> dict[str, Any]:
        result = {
            'hit_type': hit_type,
            'confidence': reuse_confidence,
            'reuse_confidence': reuse_confidence,
            'reused': True,
            'result': self._artifact_text(artifact),
            'artifacts': [self._artifact_payload(artifact)],
        }
        if include_debug:
            result['debug'] = self._debug_payload(
                hit_type=hit_type,
                task_type=artifact.task_type,
                fingerprint=fingerprint,
                artifact=artifact,
                requested_paths=requested_paths,
                exact_count=exact_count,
                repo_count=repo_count,
                semantic_count=semantic_count,
                skipped=skipped,
            )
        return result

    def record_reuse_decision(
        self,
        *,
        run_id: str,
        task_text: str,
        response_text: str,
        metadata: dict[str, Any] | None = None,
        artifact_kind: str = 'answer',
    ) -> dict[str, Any]:
        reuse = self.retrieve_reuse_context(
            task_text,
            metadata=metadata,
            artifact_kinds=[artifact_kind, 'summary', 'plan', 'repo_map'],
            include_debug=True,
        )
        reused_context = reuse['artifacts'][0]['normalized_text'] if reuse['artifacts'] else response_text
        baseline_context = response_text if not reuse['reused'] else f'{response_text}\n\n{reused_context}'
        baseline_prompt = self.serialize_prompt(task_text=task_text, context_text=baseline_context, reused=False)
        actual_prompt = self.serialize_prompt(task_text=task_text, context_text=reused_context, reused=reuse['reused'])
        return self.record_validation_run(
            run_id=run_id,
            task_text=task_text,
            artifact_text=response_text,
            baseline_prompt=baseline_prompt,
            actual_prompt=actual_prompt,
            reuse_lookup=reuse,
            metadata=metadata,
            artifact_kind=artifact_kind,
            correct_reuse=True,
        )

    def record_validation_run(
        self,
        *,
        run_id: str,
        task_text: str,
        artifact_text: str,
        baseline_prompt: str,
        actual_prompt: str,
        reuse_lookup: dict[str, Any],
        metadata: dict[str, Any] | None = None,
        artifact_kind: str = 'answer',
        expected_hit_types: list[str] | None = None,
        correct_reuse: bool = True,
    ) -> dict[str, Any]:
        expected = set(expected_hit_types or [])
        reused = bool(reuse_lookup.get('reused'))
        tokens_expected = self._estimate_tokens(baseline_prompt)
        tokens_used = self._estimate_tokens(actual_prompt)
        if tokens_expected < tokens_used:
            raise AssertionError('tokens_without_reuse must be >= tokens_with_reuse')
        tokens_saved = max(0, tokens_expected - tokens_used)
        saved_percent = round((tokens_saved / tokens_expected) * 100, 1) if tokens_expected else 0.0
        event = {
            'run_id': run_id,
            'result': artifact_text,
            'reuse': {
                'hit_type': reuse_lookup.get('hit_type', 'none'),
                'artifacts_used': [artifact['artifact_id'] for artifact in reuse_lookup.get('artifacts', [])],
                'confidence': reuse_lookup.get('confidence', 0.0),
                'reuse_confidence': reuse_lookup.get('reuse_confidence', 0.0),
                'reused': reused,
            },
            'savings': {
                'avoided_input_tokens': tokens_saved,
                'estimated_cost_without_reuse': self._estimate_cost(tokens_expected),
                'estimated_cost_actual': self._estimate_cost(tokens_used),
                'estimated_cost_saved': round(self._estimate_cost(tokens_expected) - self._estimate_cost(tokens_used), 6),
                'saved_percent': saved_percent,
                'estimated_latency_saved_ms': self._estimate_latency_saved_ms(tokens_saved, reuse_lookup.get('hit_type', 'none')),
                'input_tokens_actual': tokens_used,
                'input_tokens_without_reuse': tokens_expected,
            },
            'truth_report': {
                'reused': reused,
                'tokens_saved': tokens_saved,
                'percent_saved': saved_percent,
                'correct_reuse': correct_reuse,
            },
            'debug': reuse_lookup.get('debug', {}),
            'created_at': self._now(),
        }
        failures: list[str] = []
        if expected and reuse_lookup.get('hit_type') not in expected:
            failures.append('reuse_missed_when_expected')
        if reused and not correct_reuse:
            failures.append('reuse_triggered_but_incorrect')
        if reused and tokens_saved <= 0:
            failures.append('low_or_zero_token_savings')
        event['failures'] = failures

        self._assert_invariants(
            tokens_saved=tokens_saved,
            percent_saved=saved_percent,
            reuse_confidence=float(reuse_lookup.get('reuse_confidence', 0.0)),
        )

        def _mutate_state() -> dict[str, Any]:
            self._reuse_decisions.append(event)
            self._savings_events.append({
                'run_id': run_id,
                **event['savings'],
                'hit_type': reuse_lookup.get('hit_type', 'none'),
                'repo_id': self._default_workspace(metadata)[1],
                'user_id': self._user_id(metadata),
            })
            self._task_runs.append({
                'run_id': run_id,
                'task': task_text,
                'result': artifact_text,
                'reused': reused,
                'reuse_confidence': reuse_lookup.get('reuse_confidence', 0.0),
                'reuse_hit_type': reuse_lookup.get('hit_type', 'none'),
                'artifacts_used': event['reuse']['artifacts_used'],
                'savings': event['savings'],
                'truth_report': event['truth_report'],
                'failures': failures,
                'created_at': event['created_at'],
            })
            self._record_run_log_locked(
                run_id=run_id,
                task_text=task_text,
                metadata=metadata,
                event=event,
            )

            if failures:
                failure_event = {
                    'task': task_text,
                    'artifact_id': event['reuse']['artifacts_used'][0] if event['reuse']['artifacts_used'] else None,
                    'failure_type': failures[0],
                    'confidence': reuse_lookup.get('reuse_confidence', 0.0),
                    'repo_id': self._default_workspace(metadata)[1],
                    'timestamp': event['created_at'],
                }
                self._failure_events.append(failure_event)
                self._auto_correct_failure(
                    fingerprint=self.compute_fingerprint(
                        repo_id=self._default_workspace(metadata)[1],
                        task_type=self._classify_task_type(task_text),
                        prompt=task_text,
                        context_paths=self._normalize_context_paths(metadata),
                    ),
                    artifact_ids=event['reuse']['artifacts_used'],
                )
            if reused and event['reuse']['artifacts_used']:
                self._mark_success(event['reuse']['artifacts_used'][0])
            self._store_artifact_locked(
                task_text=task_text,
                artifact_text=artifact_text,
                artifact_kind=artifact_kind,
                source_run_id=run_id,
                metadata=metadata,
            )
            return event

        return self._run_state_mutation(_mutate_state)

    def _mark_success(self, artifact_id: str) -> None:
        for artifact in self._artifacts:
            if artifact.artifact_id != artifact_id:
                continue
            artifact.reuse_successes += 1
            artifact.quality_confidence = self._quality_score(artifact)
            return

    def _auto_correct_failure(self, *, fingerprint: str, artifact_ids: list[str]) -> None:
        self._exact_cache.pop(fingerprint, None)
        for artifact in self._artifacts:
            if artifact.artifact_id not in artifact_ids:
                continue
            artifact.reuse_failures += 1
            artifact.quality_confidence = self._quality_score(artifact)
            blacklisted = artifact.blacklisted_fingerprints or []
            if fingerprint not in blacklisted:
                blacklisted.append(fingerprint)
            artifact.blacklisted_fingerprints = blacklisted

    def _record_latency(self, sample: dict[str, float]) -> None:
        with self._lock:
            self._latency_events.append(sample)
            if len(self._latency_events) > 5000:
                self._latency_events = self._latency_events[-5000:]

    def get_latency_summary(self) -> dict[str, Any]:
        with self._lock:
            self._refresh_state_locked()
        with self._lock:
            samples = list(self._latency_events)
        totals = sorted(sample['total_ms'] for sample in samples)
        if not totals:
            return {'count': 0, 'p50_ms': 0.0, 'p95_ms': 0.0}
        p50 = totals[len(totals) // 2]
        p95 = totals[min(len(totals) - 1, math.ceil(len(totals) * 0.95) - 1)]
        averages = {
            'fingerprint_ms': round(sum(sample['fingerprint_ms'] for sample in samples) / len(samples), 3),
            'cache_lookup_ms': round(sum(sample['cache_lookup_ms'] for sample in samples) / len(samples), 3),
            'artifact_scan_ms': round(sum(sample['artifact_scan_ms'] for sample in samples) / len(samples), 3),
            'ranking_ms': round(sum(sample['ranking_ms'] for sample in samples) / len(samples), 3),
        }
        return {
            'count': len(samples),
            'p50_ms': round(p50, 3),
            'p95_ms': round(p95, 3),
            **averages,
        }

    def simulate_baseline_retrieve_context(
        self,
        task_text: str,
        *,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        _, repo_id, _, _ = self._default_workspace(metadata)
        requested_paths = self._normalize_context_paths(metadata)
        requested_hashes = self._normalize_file_hashes(metadata)
        task_type = self._classify_task_type(task_text)
        fingerprint = self.compute_fingerprint(
            repo_id=repo_id,
            task_type=task_type,
            prompt=task_text,
            context_paths=requested_paths,
        )
        task_embedding = self.embedding.embed_text(self._normalize_text(task_text))['vector']
        artifact = None
        best_repo_score = -1.0
        best_semantic_score = -1.0
        for candidate in reversed(self._artifacts):
            if candidate.repo_id != repo_id:
                continue
            candidate_text = self._artifact_text(candidate)
            if candidate.fingerprint == fingerprint:
                artifact = candidate
                break
            repo_score = self._hash_overlap(requested_hashes, candidate.file_hashes) + self._path_overlap(requested_paths, candidate.context_paths)
            if repo_score > best_repo_score:
                best_repo_score = repo_score
                artifact = candidate
            semantic_score = self._cosine_similarity(task_embedding, self.embedding.embed_text(candidate_text)['vector'])
            if semantic_score > best_semantic_score and best_repo_score <= 0:
                best_semantic_score = semantic_score
                artifact = candidate
        return {
            'hit_type': 'exact' if artifact else 'none',
            'total_ms': (time.perf_counter() - started) * 1000,
        }

    def get_storage_summary(self) -> dict[str, Any]:
        with self._lock:
            artifacts = list(self._artifacts)
        compressed_bytes = sum(self._artifact_text_size(artifact) for artifact in artifacts)
        uncompressed_bytes = sum(len(self._artifact_text(artifact).encode('utf-8')) for artifact in artifacts)
        repo_counts = {repo_id: len(entries) for repo_id, entries in self._artifacts_by_repo.items()}
        return {
            'artifact_count': len(artifacts),
            'compressed_bytes': compressed_bytes,
            'uncompressed_bytes': uncompressed_bytes,
            'compression_ratio': round((compressed_bytes / uncompressed_bytes), 3) if uncompressed_bytes else 0.0,
            'repo_counts': repo_counts,
        }

    def get_recent_runs(self, limit: int = 10) -> list[dict[str, Any]]:
        with self._lock:
            return list(reversed(self._task_runs[-limit:]))

    def get_failure_events(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            return list(reversed(self._failure_events[-limit:]))

    def _record_run_log_locked(
        self,
        *,
        run_id: str,
        task_text: str,
        metadata: dict[str, Any] | None,
        event: dict[str, Any],
    ) -> None:
        user_id = self._user_id(metadata)
        _, repo_id, _, _ = self._default_workspace(metadata)
        repeat_key = self._repeat_key(repo_id=repo_id, task_text=task_text)
        repeat_entry = self._repeat_index.get(repeat_key)
        is_repeat_run = repeat_entry is not None
        repeat_count = int(repeat_entry.get('repeat_count', 0)) + 1 if repeat_entry else 1
        first_seen_at = repeat_entry.get('first_seen_at') if repeat_entry else event['created_at']
        self._repeat_index[repeat_key] = {
            'repo_id': repo_id,
            'normalized_task': self._normalize_prompt_structure(task_text),
            'first_seen_at': first_seen_at,
            'repeat_count': repeat_count,
        }
        latency_ms = float(event.get('debug', {}).get('latency_ms', {}).get('total', 0.0))
        self._run_logs.append({
            'run_id': run_id,
            'user_id': user_id,
            'repo_id': repo_id,
            'task_hash': hashlib.sha256(self._normalize_prompt_structure(task_text).encode('utf-8')).hexdigest(),
            'repeat_key': repeat_key,
            'first_seen_at': first_seen_at,
            'repeat_count': repeat_count,
            'is_repeat_run': is_repeat_run,
            'reused': bool(event['truth_report']['reused']),
            'reuse_confidence': float(event['reuse']['reuse_confidence']),
            'tokens_saved': int(event['truth_report']['tokens_saved']),
            'percent_saved': float(event['truth_report']['percent_saved']),
            'latency_ms': latency_ms,
            'timestamp': event['created_at'],
        })
        self._recompute_user_metrics_locked(user_id)
        self._recompute_repo_metrics_locked(user_id, repo_id)

    def _recompute_user_metrics_locked(self, user_id: str) -> None:
        runs = [run for run in self._run_logs if run.get('user_id') == user_id]
        total_runs = len(runs)
        repeat_runs = sum(1 for run in runs if run.get('is_repeat_run'))
        reuse_runs = sum(1 for run in runs if run.get('reused'))
        avg_tokens_saved = round(sum(int(run.get('tokens_saved', 0)) for run in runs) / total_runs, 1) if total_runs else 0.0
        repeat_rate = round(repeat_runs / total_runs, 3) if total_runs else 0.0
        reuse_hit_rate = round(reuse_runs / total_runs, 3) if total_runs else 0.0
        low_value_user = total_runs >= 5 and repeat_rate < 0.2
        classification = 'power_user' if repeat_rate > 0.5 and avg_tokens_saved >= 1000 else ('low_value_user' if low_value_user else 'emerging_user')
        aha_count = sum(1 for run in runs if run.get('reused') and int(run.get('tokens_saved', 0)) > 1000)
        best_repo = self._best_repo_for_user(runs)
        self._user_metrics[user_id] = {
            'user_id': user_id,
            'total_runs': total_runs,
            'repeat_runs': repeat_runs,
            'repeat_rate': repeat_rate,
            'avg_tokens_saved': avg_tokens_saved,
            'reuse_hit_rate': reuse_hit_rate,
            'low_value_user': low_value_user,
            'classification': classification,
            'aha_count': aha_count,
            **best_repo,
        }
        if low_value_user and not any(entry.get('user_id') == user_id for entry in self._low_value_users):
            self._low_value_users.append({
                'user_id': user_id,
                'flagged_at': self._now(),
                'total_runs': total_runs,
                'repeat_rate': repeat_rate,
            })

    def _best_repo_for_user(self, runs: list[dict[str, Any]]) -> dict[str, Any]:
        if not runs:
            return {
                'best_repo': None,
                'best_reuse_rate': 0.0,
                'best_savings': 0.0,
                'top_repo_per_user': None,
            }
        per_repo: dict[str, list[dict[str, Any]]] = {}
        for run in runs:
            per_repo.setdefault(str(run.get('repo_id') or 'unknown'), []).append(run)
        best_reuse_repo = max(
            per_repo.items(),
            key=lambda item: (
                sum(1 for run in item[1] if run.get('reused')) / len(item[1]),
                len(item[1]),
            ),
        )
        best_savings_repo = max(
            per_repo.items(),
            key=lambda item: (
                sum(int(run.get('tokens_saved', 0)) for run in item[1]) / len(item[1]),
                len(item[1]),
            ),
        )
        top_repo = max(
            per_repo.items(),
            key=lambda item: self._repo_wedge_score(item[1]),
        )
        return {
            'best_repo': best_savings_repo[0],
            'best_reuse_rate': round((sum(1 for run in best_reuse_repo[1] if run.get('reused')) / len(best_reuse_repo[1])) * 100, 1),
            'best_savings': round(sum(int(run.get('tokens_saved', 0)) for run in best_savings_repo[1]) / len(best_savings_repo[1]), 1),
            'top_repo_per_user': top_repo[0],
        }

    def _repo_wedge_score(self, runs: list[dict[str, Any]]) -> float:
        total_runs = len(runs)
        if not total_runs:
            return 0.0
        repeat_rate = sum(1 for run in runs if run.get('is_repeat_run')) / total_runs
        avg_tokens_saved = sum(int(run.get('tokens_saved', 0)) for run in runs) / total_runs
        return round(repeat_rate * avg_tokens_saved * total_runs, 3)

    def _recompute_repo_metrics_locked(self, user_id: str, repo_id: str) -> None:
        runs = [run for run in self._run_logs if run.get('user_id') == user_id and run.get('repo_id') == repo_id]
        total_runs = len(runs)
        repeat_runs = sum(1 for run in runs if run.get('is_repeat_run'))
        reuse_runs = sum(1 for run in runs if run.get('reused'))
        avg_savings = round(sum(int(run.get('tokens_saved', 0)) for run in runs) / total_runs, 1) if total_runs else 0.0
        repeat_rate = round(repeat_runs / total_runs, 3) if total_runs else 0.0
        reuse_rate = round(reuse_runs / total_runs, 3) if total_runs else 0.0
        key = f'{user_id}::{repo_id}'
        self._repo_metrics[key] = {
            'user_id': user_id,
            'repo_id': repo_id,
            'total_runs': total_runs,
            'repeat_rate': repeat_rate,
            'reuse_rate': reuse_rate,
            'avg_savings': avg_savings,
            'wedge_score': round(repeat_rate * avg_savings * total_runs, 3),
        }

    def get_user_usage_summary(self, user_id: str) -> dict[str, Any]:
        with self._lock:
            self._refresh_state_locked()
        with self._lock:
            metrics = dict(self._user_metrics.get(user_id, {
                'user_id': user_id,
                'total_runs': 0,
                'repeat_runs': 0,
                'repeat_rate': 0.0,
                'avg_tokens_saved': 0.0,
                'reuse_hit_rate': 0.0,
                'low_value_user': False,
            }))
        return {
            'total_runs': int(metrics['total_runs']),
            'repeat_rate': round(float(metrics['repeat_rate']) * 100, 1),
            'reuse_hit_rate': round(float(metrics['reuse_hit_rate']) * 100, 1),
            'avg_tokens_saved': float(metrics['avg_tokens_saved']),
            'classification': metrics.get('classification', 'emerging_user'),
            'aha_count': int(metrics.get('aha_count', 0)),
            'best_repo': metrics.get('best_repo'),
            'best_reuse_rate': float(metrics.get('best_reuse_rate', 0.0)),
            'best_savings': float(metrics.get('best_savings', 0.0)),
            'top_repo_per_user': metrics.get('top_repo_per_user'),
        }

    def get_recent_runs_for_user(self, user_id: str, limit: int = 5) -> list[dict[str, Any]]:
        with self._lock:
            self._refresh_state_locked()
        with self._lock:
            runs = [run for run in self._run_logs if run.get('user_id') == user_id]
        recent = list(reversed(runs[-limit:]))
        return [
            {
                'reused': bool(run.get('reused', False)),
                'tokens_saved': int(run.get('tokens_saved', 0)),
                'percent_saved': float(run.get('percent_saved', 0.0)),
                'repo_id': run.get('repo_id'),
                'timestamp': run.get('timestamp'),
            }
            for run in recent
        ]

    def get_system_metrics(self) -> dict[str, Any]:
        latency = self.get_latency_summary()
        overview = self.get_savings_overview()
        return {
            'global_reuse_rate': overview.get('reuse_hit_rate', 0.0),
            'avg_savings': overview.get('average_saved_tokens', 0.0),
            'total_runs': overview.get('run_count', 0),
            'p50_latency': latency.get('p50_ms', 0.0),
            'p95_latency': latency.get('p95_ms', 0.0),
        }

    def _trend(self, values: list[float]) -> float:
        if len(values) < 2:
            return 0.0
        n = len(values)
        xs = list(range(n))
        x_mean = sum(xs) / n
        y_mean = sum(values) / n
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, values))
        denominator = sum((x - x_mean) ** 2 for x in xs)
        if denominator == 0:
            return 0.0
        return round(numerator / denominator, 4)

    def get_repo_metrics_for_user(self, user_id: str) -> list[dict[str, Any]]:
        with self._lock:
            self._refresh_state_locked()
        with self._lock:
            rows = [dict(value) for value in self._repo_metrics.values() if value.get('user_id') == user_id]
        return sorted(rows, key=lambda row: (row.get('wedge_score', 0.0), row.get('avg_savings', 0.0)), reverse=True)

    def get_wedge_insights(self, user_id: str | None = None) -> dict[str, Any]:
        with self._lock:
            run_logs = list(self._run_logs)
            repo_metrics = list(self._repo_metrics.values())
            user_metrics = dict(self._user_metrics)
        if user_id:
            user_runs = [run for run in run_logs if run.get('user_id') == user_id]
            user_repo_metrics = [row for row in repo_metrics if row.get('user_id') == user_id]
            usage = self.get_user_usage_summary(user_id)
            return {
                'best_repo': usage.get('best_repo'),
                'best_reuse_rate': usage.get('best_reuse_rate', 0.0),
                'best_savings': usage.get('best_savings', 0.0),
                'top_repo_per_user': usage.get('top_repo_per_user'),
                'top_3_repos_by_usage': sorted(user_repo_metrics, key=lambda row: row.get('total_runs', 0), reverse=True)[:3],
                'top_3_repos_by_savings': sorted(user_repo_metrics, key=lambda row: row.get('avg_savings', 0.0), reverse=True)[:3],
                'reuse_rate_trend': self._trend([100.0 if run.get('reused') else 0.0 for run in user_runs[-10:]]),
                'savings_trend': self._trend([float(run.get('tokens_saved', 0)) for run in user_runs[-10:]]),
            }
        top_patterns = sorted(repo_metrics, key=lambda row: row.get('wedge_score', 0.0), reverse=True)[:5]
        return {
            'global_top_repo_patterns': top_patterns,
            'power_users': [metrics for metrics in user_metrics.values() if metrics.get('classification') == 'power_user'],
            'low_value_users': list(self._low_value_users),
        }

    def export_metrics(self) -> dict[str, Any]:
        with self._lock:
            self._refresh_state_locked()
        with self._lock:
            return {
                'user_metrics': list(self._user_metrics.values()),
                'repo_metrics': list(self._repo_metrics.values()),
                'failure_clusters': self.get_failure_clusters(limit=50),
            }

    def get_failure_clusters(self, limit: int = 5) -> list[dict[str, Any]]:
        with self._lock:
            failures = list(self._failure_events)
        clusters: dict[tuple[str, str], int] = {}
        for failure in failures:
            failure_type = failure.get('failure_type', 'unknown')
            repo_id = failure.get('repo_id', 'unknown')
            key = (failure_type, repo_id)
            clusters[key] = clusters.get(key, 0) + 1
        return [
            {'failure_type': failure_type, 'repo_id': repo_id, 'count': count}
            for (failure_type, repo_id), count in sorted(clusters.items(), key=lambda item: item[1], reverse=True)[:limit]
        ]

    def get_savings_overview(self) -> dict[str, Any]:
        with self._lock:
            self._refresh_state_locked()
        with self._lock:
            savings_events = list(self._savings_events)
            failure_events = list(self._failure_events)
            blacklist_size = sum(len(artifact.blacklisted_fingerprints or []) for artifact in self._artifacts)
            run_logs = list(self._run_logs)
        total_saved_tokens = sum(int(event['avoided_input_tokens']) for event in savings_events)
        total_saved_cost = round(sum(float(event['estimated_cost_saved']) for event in savings_events), 6)
        hit_count = sum(1 for event in savings_events if event['hit_type'] != 'none')
        count = len(run_logs)
        avg_saved_tokens = round(total_saved_tokens / count, 1) if count else 0.0
        avg_saved_percent = round(
            sum(float(event['saved_percent']) for event in savings_events) / count,
            1,
        ) if count else 0.0
        repeat_runs = sum(1 for run in run_logs if run.get('is_repeat_run'))
        top_repos: dict[str, int] = {}
        top_failure_types: dict[str, int] = {}
        for event in savings_events:
            top_repos[event['repo_id']] = top_repos.get(event['repo_id'], 0) + int(event['avoided_input_tokens'])
        for failure in failure_events:
            failure_type = failure.get('failure_type', 'unknown')
            top_failure_types[failure_type] = top_failure_types.get(failure_type, 0) + 1
        ranked_repos = [
            {'repo_id': repo_id, 'saved_tokens': saved_tokens}
            for repo_id, saved_tokens in sorted(top_repos.items(), key=lambda item: item[1], reverse=True)[:5]
        ]
        ranked_failures = [
            {'failure_type': failure_type, 'count': failure_count}
            for failure_type, failure_count in sorted(top_failure_types.items(), key=lambda item: item[1], reverse=True)[:5]
        ]
        failure_clusters = self.get_failure_clusters(limit=5)
        return {
            'total_saved_tokens': total_saved_tokens,
            'total_saved_cost': total_saved_cost,
            'average_saved_tokens': avg_saved_tokens,
            'average_saved_percent': avg_saved_percent,
            'reuse_hit_rate': round((hit_count / count) * 100, 1) if count else 0.0,
            'run_count': count,
            'reuse_count': hit_count,
            'repeat_usage_per_session': count,
            'repeat_rate': round((repeat_runs / count) * 100, 1) if count else 0.0,
            'failure_count': len(failure_events),
            'top_failure_types': ranked_failures,
            'top_failure_clusters': failure_clusters,
            'blacklist_size': blacklist_size,
            'recent_runs': self.get_recent_runs(limit=5),
            'top_reusable_repos': ranked_repos,
        }

    def _debug_payload(
        self,
        *,
        hit_type: str,
        task_type: str,
        fingerprint: str,
        artifact: Artifact | None,
        requested_paths: list[str],
        exact_count: int,
        repo_count: int,
        semantic_count: int,
        skipped: list[str],
    ) -> dict[str, Any]:
        return {
            'why': hit_type if hit_type != 'none' else 'no reusable artifact cleared the matching thresholds',
            'task_type': task_type,
            'fingerprint_prefix': fingerprint[:12],
            'requested_context_paths': requested_paths,
            'candidate_counts': {
                'exact': exact_count,
                'repo_context_same_repo': repo_count,
                'semantic': semantic_count,
            },
            'matched_artifact_id': artifact.artifact_id if artifact else None,
            'matched_artifact_kind': artifact.artifact_kind if artifact else None,
            'matched_source_run_id': artifact.source_run_id if artifact else None,
            'confidence': artifact.quality_confidence if artifact else 0.0,
            'path_overlap': self._path_overlap(requested_paths, artifact.context_paths) if artifact else 0.0,
            'skipped': skipped,
        }

    def _artifact_payload(self, artifact: Artifact) -> dict[str, Any]:
        return {
            'artifact_id': artifact.artifact_id,
            'workspace_id': artifact.workspace_id,
            'repo_id': artifact.repo_id,
            'branch': artifact.branch,
            'commit': artifact.commit,
            'task_type': artifact.task_type,
            'fingerprint': artifact.fingerprint,
            'artifact_kind': artifact.artifact_kind,
            'normalized_text': self._artifact_text(artifact),
            'text_is_compressed': artifact.text_is_compressed,
            'source_run_id': artifact.source_run_id,
            'context_paths': artifact.context_paths,
            'file_hashes': artifact.file_hashes,
            'base_confidence': artifact.base_confidence,
            'quality_confidence': artifact.quality_confidence,
            'reuse_successes': artifact.reuse_successes,
            'reuse_failures': artifact.reuse_failures,
            'token_cost_to_create': artifact.token_cost_to_create,
            'created_at': artifact.created_at,
            'last_used_at': artifact.last_used_at,
            'blacklisted_fingerprints': artifact.blacklisted_fingerprints or [],
            'embedding': artifact.embedding,
        }

    def _snapshot_artifact_payload(self, artifact: Artifact) -> dict[str, Any]:
        payload = self._artifact_payload(artifact)
        payload.pop('normalized_text', None)
        payload['compressed_text_hex'] = artifact.compressed_text.hex()
        return payload
