"""Burn stream clip preview (fit_top / fit_blur) with captions + optional chat."""
from __future__ import annotations

import shutil
from pathlib import Path

from clips_worker.layout_router import editor_mode_uses_stream_frame
from clips_worker.render_clip import aspect_size
from clips_worker.streamer.layout.stream_frame import render_stream_clip_layout
from clips_worker.chat_overlay_apply import try_apply_chat_overlay


def resolve_stream_layout_mode(edits: dict) -> str:
    layout = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    mode = str(layout.get("mode") or "").strip()
    if mode in ("fit_top", "fit_blur", "full_frame"):
        return "fit_top" if mode == "fit_top" else "fit_blur"
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    hb = tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}
    if hb.get("enabled") and str(hb.get("text") or tpl.get("suggestedHeadline") or "").strip():
        return "fit_top"
    return "fit_blur"


def render_stream_clip_preview(
    clip_src: Path,
    out_mp4: Path,
    *,
    edits: dict,
    settings: dict,
    clip_words: list[dict],
    work_dir: Path,
    clip_start_ms: int,
    clip_end_ms: int,
    conn=None,
    project_id: str | None = None,
    clip_id: str | None = None,
    vod_id: str = "",
) -> Path:
    from clips_worker.edits_render import normalize_edits

    work_dir.mkdir(parents=True, exist_ok=True)
    bounds_start = int(edits.get("trim", {}).get("in") or clip_start_ms)
    bounds_end = int(edits.get("trim", {}).get("out") or clip_end_ms)
    edits = normalize_edits(edits, bounds_start, bounds_end)
    layout_mode = resolve_stream_layout_mode(edits)
    if not editor_mode_uses_stream_frame(layout_mode):
        layout_mode = "fit_blur"

    aspect = settings.get("aspectRatio", "9:16")
    resolution = settings.get("exportResolution", "720p")
    play_w, play_h = aspect_size(aspect, resolution)

    layout_mp4 = work_dir / "stream_layout.mp4"
    render_stream_clip_layout(clip_src, layout_mp4, edits, layout_mode, play_w=play_w, play_h=play_h)
    caption_src = layout_mp4

    cap_edits = edits.get("captions") or {}
    if layout_mode == "fit_top" and isinstance(cap_edits, dict):
        cap_edits = {**cap_edits, "marginVPct": 6, "position": "bottom"}
    final = work_dir / "stream_captioned.mp4"
    if int(cap_edits.get("enabled", True)):
        from clips_worker.edits_render import burn_captions as _burn

        _burn(caption_src, clip_words, final, work_dir, cap_edits, play_w=play_w, play_h=play_h)
        caption_src = final

    shutil.copy(caption_src, out_mp4)

    try_apply_chat_overlay(
        out_mp4,
        work_dir,
        conn=conn,
        project_id=project_id or "",
        edits=edits,
        clip_start_ms=clip_start_ms,
        clip_end_ms=clip_end_ms,
        layout_mode=layout_mode,
        clip_id=clip_id,
        play_w=play_w,
        play_h=play_h,
    )

    return out_mp4
