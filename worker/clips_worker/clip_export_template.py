"""Burn export-only headline bar, platform source bar, and channel link (not preview.mp4)."""
from __future__ import annotations

import subprocess
from pathlib import Path

# Parity with new-app/lib/clips/export-platform-presets.ts (headlineTextMinYPx @ 1080×1920).
_HEADLINE_TEXT_MIN_Y = {
    "tiktok": 260,
    "youtube_shorts": 380,
    "instagram_reels": 250,
}
_HEADLINE_BAR_H_REF = 420
_SOURCE_BAR_H = 52
_FONT_HEADLINE = 46
_FONT_LINK = 24


def _esc_drawtext(s: str) -> str:
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def _scale_y(px: int, play_h: int) -> int:
    return max(1, int(round(px * play_h / 1920)))


def headline_layout(platform_id: str | None, play_w: int, play_h: int) -> tuple[int, int]:
    """White bar height and drawtext y (top of text box) in output pixels."""
    pid = (platform_id or "tiktok").strip()
    text_min = _scale_y(_HEADLINE_TEXT_MIN_Y.get(pid, 260), play_h)
    bar_h = max(_scale_y(_HEADLINE_BAR_H_REF, play_h), text_min + _scale_y(56, play_h))
    text_y = max(text_min, int(bar_h * 0.58) - _scale_y(8, play_h))
    return bar_h, text_y


def fit_16x9_rect(play_w: int, play_h: int) -> tuple[int, int, int, int]:
    """Centered 16:9 video rect when letterboxed to play_w×play_h (full width)."""
    fg_w = play_w
    fg_h = int(round(fg_w * 9 / 16))
    if fg_h > play_h:
        fg_h = play_h
        fg_w = int(round(fg_h * 16 / 9))
    fg_x = (play_w - fg_w) // 2
    fg_y = (play_h - fg_h) // 2
    return fg_x, fg_y, fg_w, fg_h


def _platform_label(platform: str) -> tuple[str, str]:
    p = (platform or "").lower()
    if p == "kick":
        return "KICK", "0x53FC18"
    if p == "twitch":
        return "TWITCH", "0x9146FF"
    return "LIVE", "0x9146FF"


def apply_export_template(
    video: Path,
    out: Path,
    edits: dict,
    *,
    play_w: int,
    play_h: int,
    layout_mode: str = "speaker_follow",
    stream_stack: bool = False,
) -> Path:
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else None
    if not tpl:
        return video

    split_layouts = {"split", "grid3", "grid4", "dynamic", "screen_pip", "split_debate", "grid", "two_up"}
    allow_headline = layout_mode not in split_layouts and not stream_stack

    headline_on = allow_headline and bool((tpl.get("headlineBar") or {}).get("enabled"))
    hb = tpl.get("headlineBar") or {}
    headline = str(hb.get("text") or tpl.get("suggestedHeadline") or "").strip().upper()

    badge_on = bool((tpl.get("platformBadge") or {}).get("enabled"))
    link_on = bool((tpl.get("channelLink") or {}).get("enabled"))
    link_url = str((tpl.get("channelLink") or {}).get("url") or "").strip()
    platform = str(tpl.get("platform") or "twitch")
    platform_id = str(tpl.get("exportPlatformId") or "tiktok")

    source_bar_on = badge_on or (link_on and link_url)
    if not headline_on and not source_bar_on:
        return video

    _fg_x, fg_y, _fg_w, fg_h = fit_16x9_rect(play_w, play_h)
    source_y = min(play_h - _scale_y(_SOURCE_BAR_H, play_h) - 8, fg_y + fg_h + _scale_y(6, play_h))

    filters: list[str] = []
    vlabel = "0:v"
    step = 0

    if headline_on and headline:
        bar_h, text_y = headline_layout(platform_id, play_w, play_h)
        headline_show = headline[:80]
        bar = (
            f"[{vlabel}]drawbox=x=0:y=0:w={play_w}:h={bar_h}:color=white@0.97:t=fill,"
            f"drawtext=text='{_esc_drawtext(headline_show)}':fontsize={_scale_y(_FONT_HEADLINE, play_h)}:"
            f"fontcolor=black:x=(w-text_w)/2:y={text_y}:borderw=0[v{step}]"
        )
        filters.append(bar)
        vlabel = f"v{step}"
        step += 1

    if source_bar_on:
        label, color = _platform_label(platform)
        bar_h = _scale_y(_SOURCE_BAR_H, play_h)
        display = link_url.replace("https://", "").replace("http://", "") if link_on and link_url else ""
        parts = [
            f"[{vlabel}]drawbox=x=0:y={source_y}:w={play_w}:h={bar_h}:color=black@0.82:t=fill",
        ]
        if badge_on:
            parts.append(
                f"drawbox=x={_scale_y(16, play_w)}:y={source_y + _scale_y(10, play_h)}:"
                f"w={_scale_y(100, play_w)}:h={bar_h - _scale_y(20, play_h)}:color={color}@0.95:t=fill"
            )
            parts.append(
                f"drawtext=text='{_esc_drawtext(label)}':fontsize={_scale_y(20, play_h)}:fontcolor=white:"
                f"x={_scale_y(28, play_w)}:y={source_y + _scale_y(14, play_h)}"
            )
        if display:
            tx = _scale_y(130, play_w) if badge_on else _scale_y(20, play_w)
            parts.append(
                f"drawtext=text='{_esc_drawtext(display[:56])}':fontsize={_scale_y(_FONT_LINK, play_h)}:"
                f"fontcolor=white@0.92:x={tx}:y={source_y + _scale_y(14, play_h)}"
            )
        parts.append(f"[v{step}]")
        filters.append(",".join(parts))
        vlabel = f"v{step}"
        step += 1

    if not filters:
        return video

    fc = ";".join(filters)
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(video),
        "-filter_complex",
        fc,
        "-map",
        f"[{vlabel}]",
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
        "-movflags",
        "+faststart",
        str(out),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out
