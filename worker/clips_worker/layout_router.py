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
    if summary.n_persons < 2 or summary.confidence < CONFIDENCE_GATE:
        if layout == "auto":
            return "speaker_follow", False
        return layout, False
    if layout not in ("auto", "dynamic", "grid", "grid3", "grid4", "split", "split_debate"):
        return layout, False
    n = min(summary.n_persons, 5)
    if n == 2:
        if layout in ("split", "split_debate"):
            return layout, True
        return "dynamic", True
    if n == 3:
        return "grid3", True
    if n == 4:
        return "grid4", True
    return "dynamic", True


def editor_layout_to_worker(mode: str) -> str:
    """Map clip editor layout.mode → worker speakercrop layout id (parity with new-app layout-mode-map.ts)."""
    m = (mode or "speaker_follow").strip()
    if m == "fit_blur":
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


def speakercrop_settings_from_edits(base_settings: dict, edits: dict) -> dict:
    """Per-clip layout overrides project settings when editor mode is not speaker_follow."""
    out = dict(base_settings)
    mode = (edits.get("layout") or {}).get("mode") or "speaker_follow"
    if mode != "speaker_follow":
        out["layout"] = editor_layout_to_worker(str(mode))
    return out


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
