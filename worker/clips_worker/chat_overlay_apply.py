"""Chat overlay on export — must never fail or block render."""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any


def original_chat_range_ms(start_ms: int, end_ms: int, offset_ms: int) -> tuple[int,int]:
    if offset_ms < 0 or end_ms <= start_ms:
        raise ValueError('chat_overlay_invalid_source_range')
    return start_ms+offset_ms,end_ms+offset_ms


def try_apply_chat_overlay(
    out_mp4: Path,
    work_dir: Path,
    *,
    conn: Any,
    project_id: str,
    edits: dict,
    clip_start_ms: int,
    clip_end_ms: int,
    layout_mode: str,
    clip_id: str | None,
    play_w: int | None = None,
    play_h: int | None = None,
) -> None:
    from clips_worker.decision_log import decision_log
    from clips_worker.streamer.chat_overlay_render import (
        apply_chat_overlay_safe,
        chat_lines_for_clip,
        chat_overlay_enabled,
        load_vod_chat_messages,
        load_vod_for_project,
    )

    if not conn or not project_id:
        return
    if not chat_overlay_enabled(edits):
        decision_log("render", "chat_overlay_skipped", reason="toggle_off")
        return
    try:
        vod = load_vod_for_project(conn, project_id)
        if not vod:
            decision_log("render", "chat_overlay_skipped", reason="no_vod")
            return
        msgs = load_vod_chat_messages(conn, vod)
        local_start = int(edits.get("trim", {}).get("in") or clip_start_ms)
        local_end = int(edits.get("trim", {}).get("out") or clip_end_ms)
        abs_start,abs_end = original_chat_range_ms(
            local_start,local_end,int(vod.get("sourceOffsetMs") or 0))
        lines = chat_lines_for_clip(
            msgs,
            clip_start_abs_ms=abs_start,
            clip_end_abs_ms=abs_end,
            clip_start_rel_ms=clip_start_ms,
            clip_end_rel_ms=clip_end_ms,
        )
        if not lines:
            decision_log("render", "chat_overlay_skipped", reason="no_chat_lines")
            return
        chat_out = work_dir / "chat_overlay.mp4"
        kwargs: dict[str, Any] = {
            "edits": edits,
            "chat_lines": lines,
            "layout_mode": layout_mode,
            "clip_id": str(clip_id or ""),
            "vod_id": str(vod.get("id") or ""),
        }
        if play_w is not None and play_h is not None:
            kwargs["play_w"] = play_w
            kwargs["play_h"] = play_h
        apply_chat_overlay_safe(out_mp4, chat_out, **kwargs)
        shutil.copy(chat_out, out_mp4)
        decision_log("render", "chat_overlay_applied", lines=len(lines))
    except Exception as exc:
        decision_log(
            "render",
            "chat_overlay_skipped",
            reason=type(exc).__name__,
            detail=str(exc)[:200],
        )
