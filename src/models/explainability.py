from dataclasses import dataclass
from typing import Any


@dataclass
class Explainability:
    confidence: float
    reasoning_summary: str
    references: list[dict[str, Any]]
