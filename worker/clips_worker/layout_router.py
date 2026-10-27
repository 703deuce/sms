"""Map tracked person count → layout + whether to enable REFRAME_V=2 multiperson pipeline."""
from __future__ import annotations

from dataclasses import dataclass

# Minimum mean detection+cluster confidence to trust multiperson routing.
CONFIDENCE_GATE = 0.55

# User-fixed layouts never auto-downgrade to legacy.
_FORCED_LEGACY = frozenset({"fit", "fill", "speaker_follow", "locked_off"})


@dataclass(frozen=True)
class PersonCountSummary:
    """Output shape matching tracking.cluster_tracklets (fixture-friendly)."""

    n_persons: int
    confidence: float
    mean_embed_coverage: float = 1.0


def route_multiperson_layout(
    summary: PersonCountSummary,
    user_layout: str,
) -> tuple[str, bool]:
    """
    Returns (layout_style, use_reframe_v2).

    - <2 persons or low confidence → legacy speakercrop (use_reframe_v2=False).
    - 2 → split (two_up vstack)
    - 3 → grid3
    - 4 → grid4
    - 5+ → dynamic (director active-speaker; extras suppressed in director)
    """
    layout = (user_layout or "speaker_follow").strip()
    if layout in _FORCED_LEGACY and layout != "auto":
        return layout, False
    n_raw = summary.n_persons
    if n_raw == 2 and summary.confidence < CONFIDENCE_GATE + 0.05 and summary.mean_embed_coverage < 0.4:
        n_raw = 1
    if n_raw < 2 or summary.confidence < CONFIDENCE_GATE:
        if layout == "auto":
            return "speaker_follow", False
        return layout, False
    if layout not in ("auto", "dynamic", "grid", "grid3", "grid4", "split", "split_debate"):
        return layout, False
    n = min(n_raw, 5)
    if n == 2:
        if layout in ("split", "split_debate"):
            return layout, True
        if summary.confidence >= 0.72 and summary.mean_embed_coverage >= 0.45:
            return "dynamic", True
        if layout == "auto":
            return "speaker_follow", False
        return "dynamic", True
    if n == 3:
        return "grid3", True
    if n == 4:
        return "grid4", True
    return "dynamic", True


def editor_mode_uses_static_fit_blur(mode: str) -> bool:
    """No face-tracking crop — full 16:9 in frame (fit speakercrop layout)."""
    return (mode or "").strip() in ("full_frame", "fit_blur")


def editor_layout_to_worker(mode: str) -> str:
    """Map clip editor layout.mode → worker speakercrop layout id (parity with new-app layout-mode-map.ts)."""
    m = (mode or "speaker_follow").strip()
    if m in ("fit_blur", "full_frame"):
        return "fit"
    if m == "center_crop":
        return "fill"
    if m in (
        "split",
        "grid3",
        "grid4",
        "dynamic",
        "auto",
        "speaker_follow",
        "fill",
        "fit",
        "split_debate",
        "grid",
        "locked_off",
    ):
        return m
    if m == "subject_follow":
        return "speaker_follow"
    return "speaker_follow"


def _dominant_layout_mode_from_edits(edits: dict) -> str:
    layout = edits.get("layout") or {}
    segs = layout.get("layoutSegments") or []
    if not isinstance(segs, list) or not segs:
        return str(layout.get("mode") or "speaker_follow")
    trim = edits.get("trim") or {}
    tin = int(trim.get("in") or 0)
    tout = int(trim.get("out") or tin)
    best = str(layout.get("mode") or "speaker_follow")
    best_len = 0
    for row in segs:
        if not isinstance(row, dict):
            continue
        a = max(tin, int(row.get("startMs") or tin))
        b = min(tout, int(row.get("endMs") or tout))
        ln = max(0, b - a)
        if ln > best_len:
            best_len = ln
            best = str(row.get("mode") or best)
    return best


def speakercrop_settings_from_edits(base_settings: dict, edits: dict) -> dict:
    """Per-clip layout overrides project settings when editor mode is not speaker_follow."""
    out = dict(base_settings)
    mode = _dominant_layout_mode_from_edits(edits)
    if mode != "speaker_follow":
        out["layout"] = editor_layout_to_worker(str(mode))
    return out


def speakercrop_settings_for_layout_mode(base_settings: dict, mode: str) -> dict:
    out = dict(base_settings)
    m = (mode or "speaker_follow").strip()
    if m != "speaker_follow":
        out["layout"] = editor_layout_to_worker(m)
    return out


_VALID_EDITOR_LAYOUT_MODES = frozenset(
    {
        "speaker_follow",
        "fit_blur",
        "full_frame",
        "center_crop",
        "subject_follow",
        "split",
        "fill",
        "fit",
        "grid3",
        "grid4",
        "dynamic",
        "auto",
        "screen_pip",
    }
)


def normalize_layout_segments(edits: dict) -> list[dict]:
    """Clip-timeline layout segments (source ms), aligned with new-app layout-segments.ts."""
    layout = edits.get("layout") or {}
    fallback = str(layout.get("mode") or "speaker_follow")
    trim = edits.get("trim") or {}
    tin = int(trim.get("in") or 0)
    tout = int(trim.get("out") or tin)
    raw = layout.get("layoutSegments") or []
    if not isinstance(raw, list) or not raw:
        return [{"startMs": tin, "endMs": tout, "mode": fallback}]
    segs: list[dict] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        try:
            start_ms = int(row.get("startMs"))
            end_ms = int(row.get("endMs"))
        except (TypeError, ValueError):
            continue
        mode = str(row.get("mode") or fallback)
        if mode not in _VALID_EDITOR_LAYOUT_MODES:
            mode = fallback
        if end_ms <= start_ms:
            continue
        segs.append(
            {
                "startMs": max(tin, start_ms),
                "endMs": min(tout, end_ms),
                "mode": mode,
            }
        )
    if not segs:
        return [{"startMs": tin, "endMs": tout, "mode": fallback}]
    segs.sort(key=lambda s: s["startMs"])
    merged: list[dict] = []
    for s in segs:
        prev = merged[-1] if merged else None
        if prev and prev["mode"] == s["mode"] and prev["endMs"] >= s["startMs"] - 1:
            prev["endMs"] = max(prev["endMs"], s["endMs"])
        else:
            merged.append(dict(s))
    return merged


def needs_per_segment_layout_export(edits: dict) -> bool:
    """True when export must honor more than one layout mode across the trim span."""
    segs = normalize_layout_segments(edits)
    if len(segs) <= 1:
        return False
    worker_modes = {editor_layout_to_worker(str(s["mode"])) for s in segs}
    return len(worker_modes) > 1


def summary_from_track_fixture(
    n_persons: int,
    *,
    confidence: float = 0.9,
    mean_embed_coverage: float = 1.0,
) -> PersonCountSummary:
    """Test helper — no video."""
    return PersonCountSummary(
        n_persons=n_persons,
        confidence=confidence,
        mean_embed_coverage=mean_embed_coverage,
    )
