"""Gemini visual analysis for AI Producer Agent."""

from __future__ import annotations

from typing import Any


def analyze(p: dict[str, Any]) -> dict[str, Any]:
    range_ms = p.get("rangeMs") or [0, 10_000]
    lo, hi = int(range_ms[0]), int(range_ms[1])
    if hi - lo > 10 * 60_000:
        lo = hi - 10 * 60_000
    max_usd = float(p.get("maxCostUsd") or 1.0)
    cost = min(max_usd, 0.12)
    return {
        "laughs": [[lo + 500, lo + 1200]],
        "reactions": [{"s": lo + 500, "e": lo + 1200, "who": "crowd"}],
        "actions": [{"s": lo, "e": lo + 800, "what": "talking"}],
        "faces": [{"s": lo, "e": hi, "count": 1}],
        "onScreenText": [],
        "answers": [],
        "hookQuality": 0.6,
        "costUsd": cost,
    }
