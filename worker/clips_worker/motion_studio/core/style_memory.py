"""Visual diversity and style memory: approaches plus recent production decisions.

This is a catalog of approaches (not finished compositions) and a record of
identity-package decisions from recent projects, so a new film does not repeat
the last one by default and does not fall back to a palette-only change.
"""
from __future__ import annotations

APPROACHES = [
    {"id": "held_photograph", "label": "A held photograph with motivated camera and typography"},
    {"id": "kinetic_type", "label": "Kinetic typography built around the narration's heroes"},
    {"id": "data_thread", "label": "A data thread that reveals numbers as they are spoken"},
    {"id": "diagram_machine", "label": "A custom diagram or mechanical graphic invented for this subject"},
    {"id": "footage_cuts", "label": "Cuts into the user's own footage with narration paused"},
    {"id": "document_closeup", "label": "Document or artifact close-ups with callouts"},
]


def record(plan: dict | None, previous: list[dict] | None = None) -> list[dict]:
    pkg = (plan or {}).get("identityPackage") or (plan or {}).get("identity") or {}
    if not pkg:
        return list(previous or [])
    entry = {
        "throughLine": pkg.get("throughLine") or pkg.get("concept"),
        "typography": pkg.get("typography"),
        "materials": pkg.get("materials"),
        "cameraPersonality": pkg.get("cameraPersonality"),
        "motifs": pkg.get("motifs") or [],
        "treatments": pkg.get("treatments") or [],
        "packageVersion": pkg.get("packageVersion"),
    }
    out = list(previous or [])
    out.append(entry)
    return out[-8:]


def prompt_excerpt(memory: list[dict] | None) -> str:
    if not memory:
        return "No recent productions are on file. Invent a distinct identity for this film; do not settle for a palette swap."
    lines = ["Recent production decisions (do not copy them; invent a distinct identity):"]
    for i, row in enumerate(memory[-5:], 1):
        lines.append(f"{i}. {row.get('throughLine') or 'untitled'} — camera {row.get('cameraPersonality') or 'n/a'}; materials {row.get('materials') or []}")
    return "\n".join(lines)
