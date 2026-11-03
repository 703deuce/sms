"""Layout info wrapper (read-only heuristics)."""

from __future__ import annotations

from typing import Any


def analyze(_p: dict[str, Any]) -> dict[str, Any]:
    return {"contentType": "irl", "mode": "fit_blur", "faces": 1, "costUsd": 0}
