"""#1227 BE-18 agent brief content standard (reference workflow §4.2). Typed + validated."""
from __future__ import annotations

REQUIRED = ("topic", "angle", "lengthMin", "engineVersion", "scriptRules", "voice", "assetRules", "lookRules",
            "qaExpectations", "deliverables", "hardRules")

HARD_RULES = [
    "Every time anchor comes from the word clock (W(line, word)); never hand-typed times.",
    "Text cap height >= 40 px at 1080p and fully inside the frame.",
    "Composition is a per-film decision. If a frame is deliberately minimal, record it in deliberateMinimal with a reason.",
    "One spotlight hero per beat.",
    "No file, network or OS access from scene code; seeded randomness only.",
    "Numbers on screen must match the data provenance record.",
    "No price or currency symbols for the product itself; never show $ in the UI.",
]


class BriefError(ValueError):
    pass


def make_brief(*, topic: str, angle: str, length_min: int, recipient: str, script_rules: list[str], voice: dict,
               asset_rules: list[str], look_rules: dict, qa: list[str], deliverables: list[str], extra_hard: list[str] | None = None) -> dict:
    b = {"recipient": recipient, "topic": topic, "angle": angle, "lengthMin": length_min,
         "engineVersion": "cinematic-skill@bf43556+transovo-core-v1", "scriptRules": script_rules, "voice": voice,
         "assetRules": asset_rules, "lookRules": look_rules, "qaExpectations": qa, "deliverables": deliverables,
         "hardRules": HARD_RULES + (extra_hard or [])}
    validate(b)
    return b


def validate(b: dict) -> None:
    missing = [k for k in REQUIRED if b.get(k) in (None, "", [], {})]
    if missing:
        raise BriefError(f"brief missing required fields: {missing}")
