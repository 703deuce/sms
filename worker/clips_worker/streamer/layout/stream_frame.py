"""Stream clip layouts: fit_blur (centered) and fit_top (headline band + video + blur footer)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from clips_worker.clip_export_template import _esc_drawtext, _platform_label
from clips_worker.filtergraph import fit_blur_overlay_filter
from clips_worker.stream_headline_ass import burn_stream_headline, format_headline_for_export
from clips_worker.streamer.layout.stream_overlay_layout import (
    PLAY_H,
    PLAY_W,
    headline_box_height,
    overlay_layout,
)


def _probe_duration_s(video: Path) -> float:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(video),
            ],
            text=True,
            timeout=30,
        )
        return max(0.1, float(json.loads(out).get("format", {}).get("duration") or 60))
    except Exception:
        return 60.0


def _headline_lines_from_edits(edits: dict) -> list[str]:
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    hb = tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}
    if not hb.get("enabled"):
        return []
    raw = str(hb.get("text") or tpl.get("suggestedHeadline") or "").strip()
    if not raw:
        return []
    formatted = format_headline_for_export(raw)
    from clips_worker.stream_headline_ass import _wrap_headline_lines

    body = formatted
    return _wrap_headline_lines(body.split("  ")[0] if "  " in body else body)


def render_fit_blur_stream(src: Path, dest: Path, *, play_w: int = PLAY_W, play_h: int = PLAY_H) -> None:
    dur = _probe_duration_s(src)
    fc = fit_blur_overlay_filter("0:v", "vout", play_w, play_h)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-filter_complex",
            fc,
            "-map",
            "[vout]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def render_fit_top_stream(
    src: Path,
    dest: Path,
    edits: dict,
    *,
    play_w: int = PLAY_W,
    play_h: int = PLAY_H,
) -> None:
    lines = _headline_lines_from_edits(edits)
    lay = overlay_layout(max(2, len(lines) or 2), play_w=play_w, play_h=play_h)
    dur = _probe_duration_s(src)
    vid_y = lay["video_y"]
    vid_h = lay["video_h"]
    h_box = lay["headline_h"]
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    platform = str(tpl.get("platform") or "twitch")
    badge_on = bool((tpl.get("platformBadge") or {}).get("enabled"))
    link_on = bool((tpl.get("channelLink") or {}).get("enabled"))
    channel = ""
    if link_on:
        url = str((tpl.get("channelLink") or {}).get("url") or "")
        channel = url.rstrip("/").split("/")[-1].upper()[:32] if url else ""

    fc = (
        f"[0:v]scale={play_w}:{play_h}:force_original_aspect_ratio=increase,"
        f"crop={play_w}:{play_h},boxblur=20:2,eq=brightness=-0.08[bgfull];"
        f"[0:v]scale={play_w}:-2[fg];"
        f"color=c=black:s={play_w}x{play_h}:d={dur:.3f}[base];"
        f"[base][bgfull]overlay=0:0[bg0];"
        f"[bg0]drawbox=x=0:y={lay['headline_top']}:w={play_w}:h={h_box}:color=white:t=fill[bg1];"
        f"[bg1][fg]overlay=0:{vid_y}[v1]"
    )
    stage = dest.parent / "fit_top_stage.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-filter_complex",
            fc,
            "-map",
            "[v1]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            str(stage),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    current = stage
    if lines:
        hl = dest.parent / "fit_top_headline.mp4"
        burn_stream_headline(
            current,
            hl,
            format_headline_for_export(
                str((tpl.get("headlineBar") or {}).get("text") or tpl.get("suggestedHeadline") or "")
            ),
            play_w=play_w,
            play_h=play_h,
            bar_h=h_box,
            duration_ms=int(dur * 1000),
            bar_y=lay["headline_top"],
            fit_top=True,
        )
        current = hl
    if badge_on or channel:
        label, color = _platform_label(platform)
        badge_y = lay["badge_y"]
        badge_x = (play_w - 200) // 2
        name = channel or label
        dt = (
            f"[0:v]drawbox=x={badge_x}:y={badge_y}:w=200:h=32:color={color}@0.95:t=fill,"
            f"drawtext=text='{_esc_drawtext(name[:24])}':fontsize=28:fontcolor=white:"
            f"x={badge_x + 8}:y={badge_y + 4}[vout]"
        )
        badged = dest.parent / "fit_top_badge.mp4"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(current),
                "-filter_complex",
                dt,
                "-map",
                "[vout]",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "copy",
                str(badged),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        current = badged
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(current), "-c", "copy", "-movflags", "+faststart", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def render_stream_clip_layout(
    src: Path,
    dest: Path,
    edits: dict,
    layout_mode: str,
    *,
    play_w: int = PLAY_W,
    play_h: int = PLAY_H,
) -> None:
    mode = (layout_mode or "fit_blur").strip()
    if mode == "fit_top":
        render_fit_top_stream(src, dest, edits, play_w=play_w, play_h=play_h)
    else:
        render_fit_blur_stream(src, dest, play_w=play_w, play_h=play_h)
