from __future__ import annotations

import os
from pathlib import Path


def _candidate_homes() -> list[Path]:
    env_home = os.getenv('VELOCITYBRAIN_HOME')
    if env_home:
        return [Path(env_home).expanduser()]

    candidates = [Path.home() / '.velocitybrain']

    local_storage = os.getenv('LOCAL_STORAGE_PATH')
    if local_storage:
        candidates.append(Path(local_storage).expanduser() / '.velocitybrain')

    candidates.append(Path.cwd() / '.velocitybrain')
    return candidates


def get_velocitybrain_home() -> Path:
    for candidate in _candidate_homes():
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            probe = candidate / '.write-test'
            probe.write_text('ok', encoding='utf-8')
            probe.unlink(missing_ok=True)
            return candidate.resolve()
        except OSError:
            continue

    fallback = Path.cwd() / '.velocitybrain'
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback.resolve()
