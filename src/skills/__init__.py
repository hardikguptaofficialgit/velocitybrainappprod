"""
VelocityBrain Skills Framework

Open-source skills framework for VelocityBrain.
"""

from .base import BaseSkill, SkillResult
from .registry import SkillRegistry
from .examples import *

__all__ = [
    "BaseSkill",
    "SkillResult", 
    "SkillRegistry"
]
