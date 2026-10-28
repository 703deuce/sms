"""Safe chat overlay burn-in for clip export / stream render."""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from clips_worker.storage import download_object
from clips_worker.streamer.chat_sampling import sample_chat_for_clip
from clips_worker.streamer.layout.chat_overlay import build_chat_ass, burn_chat_ass
from clips_worker.streamer.layout.stream_overlay_layout import overlay_layout
from clips_worker.streamer.keys import stream_chat_key


def load_vod_for_project(conn, project_id: str) -> dict[str, Any] | None:
    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v.*, p."workspaceId"
            FROM stream_vods v
            JOIN clip_projects p ON p.id = v."projectId"
            WHERE v."projectId" = %s
            ORDER BY v."createdAt" DESC
            LIMIT 1
            """,
            (project_id,),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def chat_overlay_enabled(edits: dict) -> bool:
    co = edits.get("chatOverlay") if isinstance(edits.get("chatOverlay"), dict) else {}
    return bool(co.get("enabled"))


def load_vod_chat_messages(conn, vod: dict) -> list[dict]:
    workspace_id = str(vod.get("workspaceId") or "")
    vod_id = str(vod.get("id") or "")
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    key = (state or {}).get("chatKey") or stream_chat_key(workspace_id, vod_id)
    try:
        path = Path("/tmp") / f"chat_{vod_id}.json"
        download_object(str(key), path)
        raw = json.loads(path.read_text())
        if isinstance(raw, list):
            return raw
        return list(raw.get("messages") or raw.get("lines") or [])
    except Exception:
        return []


def chat_lines_for_clip(
    messages: list[dict],
    *,
    clip_start_abs_ms: int,
    clip_end_abs_ms: int,
    clip_start_rel_ms: int,
    clip_end_rel_ms: int,
) -> list[dict]:
    if not messages:
        return []
    lines = sample_chat_for_clip(messages, clip_start_abs_ms, clip_end_abs_ms)
    if not lines and clip_start_rel_ms != clip_start_abs_ms:
        lines = sample_chat_for_clip(messages, clip_start_rel_ms, clip_end_rel_ms)
    return lines


def apply_chat_overlay_safe(
    video: Path,
    out: Path,
    *,
    edits: dict,
    chat_lines: list[dict],
    layout_mode: str,
    play_w: int = 1080,
    play_h: int = 1920,
    vod_id: str = "",
    clip_id: str = "",
) -> Path:
    if not chat_overlay_enabled(edits) or not chat_lines:
        if video != out:
            shutil.copy(video, out)
        return out
    try:
        headline_lines = 2
        tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
        if (tpl.get("headlineBar") or {}).get("enabled"):
            from clips_worker.stream_headline_ass import _wrap_headline_lines, format_headline_for_export

            raw = str((tpl.get("headlineBar") or {}).get("text") or tpl.get("suggestedHeadline") or "")
            headline_lines = len(_wrap_headline_lines(format_headline_for_export(raw))) or 2
        lay = overlay_layout(headline_lines, play_w=play_w, play_h=play_h)
        if layout_mode != "fit_top":
            lay = {**lay, "chat_top": int(play_h * 0.62), "chat_h": int(play_h * 0.32)}
        co = edits.get("chatOverlay") if isinstance(edits.get("chatOverlay"), dict) else {}
        opacity = float(co.get("opacity") or 0.72)
        ass = video.parent / f"chat_{clip_id or 'clip'}.ass"
        ass.write_text(
            build_chat_ass(
                chat_lines,
                width=play_w,
                play_h=play_h,
                chat_top=lay["chat_top"],
                chat_h=lay["chat_h"],
                opacity=opacity,
            ),
            encoding="utf-8",
        )
        burn_chat_ass(video, out, ass)
        print(
            f"[clipper:stream] chat_overlay_burned vodId={vod_id} clipId={clip_id} lines={len(chat_lines)}",
            flush=True,
        )
        return out
    except Exception as exc:
        print(
            f"[clipper:stream] WARNING chat_overlay_skipped vodId={vod_id} clipId={clip_id} "
            f"error={type(exc).__name__}:{str(exc)[:160]}",
            flush=True,
        )
        shutil.copy(video, out)
        return out
