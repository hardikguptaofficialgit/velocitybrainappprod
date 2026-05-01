"""Fail if the public package imports private runtime modules."""

from __future__ import annotations

import sys
from pathlib import Path


FORBIDDEN = (
    "src.services",
    "src.core_api",
    "services.",
    "core_api.",
)


def main() -> int:
    root = Path(__file__).resolve().parents[1] / "src" / "velocitybrain_client"
    violations: list[str] = []
    for path in root.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for token in FORBIDDEN:
            if token in text:
                violations.append(f"{path.relative_to(root.parent)} -> {token}")
    if violations:
        print("Public/private boundary violations detected:")
        for violation in violations:
            print(f" - {violation}")
        return 1
    print("Public/private boundary check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

