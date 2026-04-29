from pathlib import Path

from src.core.config import settings
from src.services.memory_engine import MemoryEngine


class MultimodalIngestService:
    def __init__(self):
        self.memory = MemoryEngine()

    def _sanitize_metadata(self, metadata: dict) -> dict:
        safe = {}
        blocked_keys = {'file', 'file_path', 'path', 'local_path', 'upload_path'}
        root = Path(settings.workspace_root).resolve()

        for key, value in (metadata or {}).items():
            k = str(key).lower()
            if k in blocked_keys:
                if settings.allow_unsafe_file_reads:
                    safe[key] = value
                    continue
                p = Path(str(value)).expanduser().resolve()
                if p != root and root not in p.parents:
                    safe[key] = '[blocked-outside-workspace]'
                else:
                    safe[key] = str(p)
                continue
            safe[key] = value
        return safe

    def ingest(self, source: str, modality: str, content: str, metadata: dict, access_level: str) -> dict:
        clean_meta = self._sanitize_metadata(metadata)
        normalized = f"[{modality.upper()}] {content}"
        if clean_meta:
            normalized += f"\n\nMetadata: {clean_meta}"
        return self.memory.upsert_from_text(source=f"{source}:{modality}", content=normalized, access_level=access_level)
