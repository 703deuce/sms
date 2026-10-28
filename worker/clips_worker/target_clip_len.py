"""Clip duration targets from job payload + project settings (B clipLenMode / targetClipLenS)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

ABS_MAX_MS = 90_000
ABS_MIN_MS = 15_000
ALLOWED_TARGET_S = frozenset({15, 30, 60, 90})
FIXED_TOLERANCE = 0.25  # legacy pass1 hints only; fixed max is hard cap at target_s

_LEGACY_CLIP_LENGTH_TO_S = {
    "lt30": 30,
    "30_60": 60,
    "60_90": 90,
}


def coerce_target_clip_len_s(raw: Any) -> int | None:
    """Parse 15/30/60/90; None/empty/auto → auto (null)."""
    if raw is None or raw == "" or raw in ("auto", "Auto"):
        return None
    try:
        v = int(float(raw))
    except (TypeError, ValueError):
        return None
    if v in ALLOWED_TARGET_S:
        return v
    return None


def target_from_project_settings(settings: dict[str, Any] | None) -> int | None:
    """Settings-only resolution (streamer imports, legacy projects). Mirrors web targetClipLenSForJobPayload."""
    if not settings:
        return None
    mode = settings.get("clipLenMode") or settings.get("clip_len_mode")
    if mode == "auto":
        return None
    if mode == "target":
        raw = settings.get("targetClipLenS")
        if raw is None:
            raw = settings.get("target_clip_len_s")
        return coerce_target_clip_len_s(raw)
    legacy = (settings.get("clipLength") or settings.get("clip_length") or "").strip()
    if legacy in _LEGACY_CLIP_LENGTH_TO_S:
        return _LEGACY_CLIP_LENGTH_TO_S[legacy]
    raw = settings.get("targetClipLenS") or settings.get("target_clip_len_s")
    return coerce_target_clip_len_s(raw)


def resolve_target_clip_len_s(
    job_payload: dict[str, Any] | None = None,
    settings: dict[str, Any] | None = None,
) -> int | None:
    """
    Priority: PROCESS_PROJECT payload target_clip_len_s (key present, null=auto)
    → project settings (clipLenMode / targetClipLenS) → legacy clipLength → auto.
    """
    if job_payload is not None and "target_clip_len_s" in job_payload:
        return coerce_target_clip_len_s(job_payload.get("target_clip_len_s"))
    return target_from_project_settings(settings)


def enrich_settings_with_clip_length(
    settings: dict[str, Any],
    job_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    target = resolve_target_clip_len_s(job_payload, settings)
    return {**settings, "target_clip_len_s": target}


def parse_target_clip_len_s(container: dict[str, Any] | None) -> int | None:
    """Backward-compatible single-dict parse (settings or payload with merged fields)."""
    if not container:
        return None
    if "target_clip_len_s" in container and (
        "clipLenMode" not in container and "targetClipLenS" not in container
    ):
        return coerce_target_clip_len_s(container.get("target_clip_len_s"))
    return resolve_target_clip_len_s(None, container)


@dataclass(frozen=True)
class ClipLengthPolicy:
    mode: str  # "auto" | "fixed"
    target_s: int | None
    min_ms: int
    max_ms: int
    prefer_min_ms: int
    prefer_max_ms: int
    scoring_min_s: float
    scoring_max_s: float

    def effective_max_duration_ms(self, pick: dict[str, Any], range_end_ms: int) -> int:
        """Max clip duration (ms) for snap_bounds length_max_ms."""
        cap = self.max_ms
        if self.mode == "auto":
            setup = pick.get("boundary_setup_ms")
            payoff = pick.get("boundary_payoff_ms")
            if setup is not None and payoff is not None:
                try:
                    span = int(payoff) - int(setup) + 2_500
                    cap = max(cap, min(ABS_MAX_MS, span))
                except (TypeError, ValueError):
                    pass
        start = int(pick.get("start_ms") or 0)
        room = max(ABS_MIN_MS, range_end_ms - start)
        return min(cap, room, ABS_MAX_MS)

    def pass1_length_hint(self) -> str:
        if self.mode == "auto":
            return (
                "Clip length: AUTO — shortest complete moment up to 90s; typical gaming ~30s, talking/IRL ~60s "
                "are suggestions not caps."
            )
        t = self.target_s or 30
        return (
            f"Clip length: maximum {t}s per clip (shorter when complete). Do not pad to fill; trim only if "
            "no complete version fits within the max."
        )

    def pass2_length_hint(self) -> str:
        return self.pass1_length_hint()

    def to_cache_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "target_clip_len_s": self.target_s,
            "min_ms": self.min_ms,
            "max_ms": self.max_ms,
        }


def clip_length_policy(target_s: int | None) -> ClipLengthPolicy:
    if target_s is None:
        return ClipLengthPolicy(
            mode="auto",
            target_s=None,
            min_ms=ABS_MIN_MS,
            max_ms=ABS_MAX_MS,
            prefer_min_ms=ABS_MIN_MS,
            prefer_max_ms=ABS_MAX_MS,
            scoring_min_s=0.0,
            scoring_max_s=999.0,
        )
    target_ms = min(ABS_MAX_MS, int(target_s) * 1000)
    return ClipLengthPolicy(
        mode="fixed",
        target_s=int(target_s),
        min_ms=ABS_MIN_MS,
        max_ms=target_ms,
        prefer_min_ms=ABS_MIN_MS,
        prefer_max_ms=target_ms,
        scoring_min_s=0.0,
        scoring_max_s=999.0,
    )


def resolve_clip_length_policy(settings: dict[str, Any]) -> ClipLengthPolicy:
    if "target_clip_len_s" in settings:
        target = coerce_target_clip_len_s(settings.get("target_clip_len_s"))
    else:
        target = resolve_target_clip_len_s(None, settings)
    return clip_length_policy(target)
