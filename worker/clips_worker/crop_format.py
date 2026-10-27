"""Parse crop_track.json v1 (legacy) and v2 (multiperson)."""
from __future__ import annotations

from typing import Any, Literal


def crop_track_version(data: dict[str, Any]) -> Literal[1, 2]:
    if int(data.get("version", data.get("v", 1))) == 2:
        return 2
    return 1


def is_v2_crop_track(data: dict[str, Any]) -> bool:
    return crop_track_version(data) == 2


def normalize_v1_fields(data: dict[str, Any]) -> dict[str, Any]:
    """Ensure v1 keys exist for single-person consumers."""
    if is_v2_crop_track(data):
        return data
    out = dict(data)
    out.setdefault("v", 1)
    return out


def v2_to_legacy_shots(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Best-effort shots list for UI that only understands v1 spk labels."""
    if not is_v2_crop_track(data):
        return list(data.get("shots") or [])
    t0_ms = int(data.get("t0_ms") or 0)
    shots = []
    for seg in data.get("segments") or []:
        lay = seg.get("layout", "close")
        spk = "split" if lay == "two_up" else "A" if lay == "close" else "wide"
        shots.append(
            {
                "start_ms": t0_ms + int(float(seg["t0"]) * 1000),
                "end_ms": t0_ms + int(float(seg["t1"]) * 1000),
                "spk": spk,
                "layout": lay,
            }
        )
    return shots
