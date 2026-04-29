"""
VelocityBrain Example Skills

Example skill implementations for the open-source framework.
"""

from .summarize_skill import SummarizeSkill
from .extract_skill import ExtractSkill
from .translate_skill import TranslateSkill

__all__ = [
    "SummarizeSkill",
    "ExtractSkill", 
    "TranslateSkill"
]
