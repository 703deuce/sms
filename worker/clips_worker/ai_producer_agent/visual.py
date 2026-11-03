"""Gemini visual analysis for AI Producer Agent."""

from __future__ import annotations

from typing import Any


def analyze_visual_range(*, storage_key: str, range_ms: tuple[int, int], questions: list[str] | None = None) -> dict[str, Any]:
    del storage_key, range_ms, questions
    return {"laughs": [], "reactions": [], "actions": [], "faces": 0, "onScreenText": []}
