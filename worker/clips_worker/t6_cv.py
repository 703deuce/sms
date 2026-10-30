"""Local CV helpers for T6 signals (P1)."""
from __future__ import annotations

from typing import Any


def person_boxes(clip_file, n_samples: int = 8) -> tuple[int, list[dict]]:
    _ = (clip_file, n_samples)
    return 1, []


def active_speaker(words: list[dict], crop_track: dict | None) -> list[dict]:
    _ = crop_track
    if not words:
        return []
    try:
        t0 = float(words[0]["s"])
        t1 = float(words[-1]["e"])
    except (KeyError, TypeError, ValueError):
        return []
    return [{"t0": t0, "t1": t1, "person": 0}]


def hud_at_edges(clip_file) -> bool:
    _ = clip_file
    return False


def band_stats(clip_file, rects: list[dict]) -> dict[str, dict[str, float]]:
    _ = (clip_file, rects)
    return {
        "top": {"luma": 0.3, "busy": 0.5},
        "bottom": {"luma": 0.3, "busy": 0.5},
        "caption": {"luma": 0.3, "busy": 0.5},
    }


def enrich_signals_cv(
    signals: dict,
    clip_file,
    words: list[dict],
    crop_track: dict | None,
) -> dict:
    out = dict(signals)
    count, boxes = person_boxes(clip_file)
    out["person_count"] = count
    if boxes:
        out["person_boxes"] = boxes
    out["active_speaker"] = active_speaker(words, crop_track)
    out["hud_at_edges"] = hud_at_edges(clip_file)
    out["bands"] = band_stats(clip_file, [])
    out.setdefault("sources", {"ai": out.get("sources", {}).get("ai", "none"), "cv": "local"})
    return out
