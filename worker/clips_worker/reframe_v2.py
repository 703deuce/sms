"""Ops gate for speakercrop v2 / multiperson layouts (worker env REFRAME_V2_ENABLED=1)."""
from __future__ import annotations

import os

<<<<<<< HEAD
=======
V2_ONLY_LAYOUTS = frozenset(
    {"grid3", "grid4", "dynamic", "grid", "split_debate", "locked_off"},
)

>>>>>>> 1ee3de94e (fix(clipper): #762 review — models, routing, export aiMeta, probe, CI)

def reframe_v2_ops_enabled() -> bool:
    return os.environ.get("REFRAME_V2_ENABLED", "").strip() == "1"
