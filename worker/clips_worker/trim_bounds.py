"""Allow export trim to extend slightly beyond the AI clip window on the source timeline."""
from __future__ import annotations

MAX_TRIM_EXTEND_MS = 8000


def export_trim_limits_ms(
    ctx: dict,
    clip_start_ms: int,
    clip_end_ms: int,
    source_reason: str,
    upload_duration_ms: int | None,
) -> tuple[int, int] | None:
    """Mirror web clipTrimLimits for export (preview = export)."""
    if ctx.get("sourceSegKey") and ctx.get("sourceSegStartMs") is not None and ctx.get("sourceSegEndMs") is not None:
        return int(ctx["sourceSegStartMs"]), int(ctx["sourceSegEndMs"])
    preview = str(ctx.get("previewKey") or "")
    if "_composite" in preview or preview.endswith("/composite.mp4"):
        return clip_start_ms, clip_end_ms
    if source_reason == "upload":
        hi = upload_duration_ms if upload_duration_ms and upload_duration_ms > 0 else clip_end_ms + MAX_TRIM_EXTEND_MS
        return 0, hi
    if source_reason in ("sourceSegKey", "canonical_source_seg"):
        return int(ctx.get("sourceSegStartMs") or clip_start_ms), int(ctx.get("sourceSegEndMs") or clip_end_ms)
    return None


def expanded_source_cut_ms(
    clip_start_ms: int,
    clip_end_ms: int,
    edits: dict,
    *,
    limits: tuple[int, int] | None = None,
) -> tuple[int, int, int, int]:
    trim = edits.get("trim") or {}
    tin = int(trim.get("in", clip_start_ms))
    tout = int(trim.get("out", clip_end_ms))
    if limits is not None:
        lo_ms, hi_ms = int(limits[0]), int(limits[1])
    else:
        lo_ms = max(0, clip_start_ms - MAX_TRIM_EXTEND_MS)
        hi_ms = clip_end_ms + MAX_TRIM_EXTEND_MS
    cut_start = max(lo_ms, min(clip_start_ms, tin))
    cut_end = min(hi_ms, max(clip_end_ms, tout))
    if cut_end <= cut_start:
        return clip_start_ms, clip_end_ms, lo_ms, hi_ms
    return cut_start, cut_end, lo_ms, hi_ms
