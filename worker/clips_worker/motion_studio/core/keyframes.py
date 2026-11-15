"""Searchable, timestamped keyframe library built from analyzed video moments.

`_prepare_photos()` must not extract only a single still at 1 s. This module
chooses timestamps from analysis moments (and a short open/mid/end set when
moments are missing) so the renderer and Production Designer can pick a
relevant frame.
"""
from __future__ import annotations


def _moment_start(moment: dict) -> float | None:
    for key in ("start_s", "inS", "t", "start", "time"):
        if moment.get(key) is not None:
            try:
                return max(0.0, float(moment[key]))
            except (TypeError, ValueError):
                return None
    return None


def _moment_end(moment: dict) -> float | None:
    for key in ("end_s", "outS", "end"):
        if moment.get(key) is not None:
            try:
                return max(0.0, float(moment[key]))
            except (TypeError, ValueError):
                return None
    return None


def _reason(moment: dict) -> str:
    for key in ("what_happened", "reason", "title", "activity"):
        val = moment.get(key)
        if val:
            return str(val)[:200]
    return "analyzed moment"


def keyframe_entries(asset: dict) -> list[dict]:
    """Return a timestamped library for one catalog asset (image or video)."""
    kind = asset.get("kind") or ""
    analysis = asset.get("analysis") or {}
    if kind == "image":
        return [{"t": 0.0, "end": 0.0, "reason": "source photograph", "source": "image", "primary": True}]
    if kind != "video":
        return []
    duration = 0.0
    for raw in (analysis.get("durationS"), asset.get("durationS"), asset.get("duration_s")):
        try:
            if raw is not None:
                duration = float(raw)
                break
        except (TypeError, ValueError):
            pass
    entries: list[dict] = []
    for moment in analysis.get("moments") or []:
        if not isinstance(moment, dict):
            continue
        start = _moment_start(moment)
        if start is None:
            continue
        end = _moment_end(moment)
        if duration and start > duration:
            continue
        entries.append({
            "t": round(start, 3),
            "end": round(end, 3) if end is not None else None,
            "reason": _reason(moment),
            "source": "moment",
            "primary": False,
        })
        if end is not None and end - start > 1.5:
            mid = (start + end) / 2
            entries.append({
                "t": round(mid, 3),
                "end": round(end, 3),
                "reason": "mid-moment " + _reason(moment),
                "source": "moment_mid",
                "primary": False,
            })
    if not entries:
        if duration > 0:
            entries = [
                {"t": round(min(1.0, max(0.1, duration * 0.12)), 3), "end": None, "reason": "opening frame", "source": "coverage", "primary": False},
                {"t": round(duration * 0.5, 3), "end": None, "reason": "midpoint coverage", "source": "coverage", "primary": False},
                {"t": round(max(0.1, duration - 0.4), 3), "end": None, "reason": "closing frame", "source": "coverage", "primary": False},
            ]
        else:
            # Duration unknown: still do not rely on a single 1 s grab alone —
            # sample a short opening, a slightly later beat, and a later hold.
            entries = [
                {"t": 0.3, "end": None, "reason": "opening frame (duration unknown)", "source": "coverage", "primary": False},
                {"t": 1.0, "end": None, "reason": "early hold (duration unknown)", "source": "coverage", "primary": False},
                {"t": 2.5, "end": None, "reason": "later coverage (duration unknown)", "source": "coverage", "primary": False},
            ]
    # Dedup nearby timestamps; mark the first moment (or opening coverage) primary.
    deduped: list[dict] = []
    for entry in sorted(entries, key=lambda e: (e["t"], 0 if e["source"] == "moment" else 1)):
        if not deduped or abs(entry["t"] - deduped[-1]["t"]) >= 0.25:
            deduped.append(entry)
    if deduped:
        deduped[0]["primary"] = True
    return deduped[:24]


def library_from_catalog(catalog: list[dict]) -> dict:
    """Project-level searchable keyframe library keyed by asset id."""
    assets = {}
    for asset in catalog or []:
        aid = asset.get("id")
        if not aid:
            continue
        entries = keyframe_entries(asset)
        if entries:
            assets[aid] = {
                "assetId": aid,
                "kind": asset.get("kind"),
                "filename": asset.get("filename"),
                "frames": entries,
            }
    return {"version": "1.0", "assets": assets}
