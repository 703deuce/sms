"""Twemoji PNG overlays for export (libass cannot render color emoji reliably)."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from clips_worker.ffmpeg_util import ffmpeg_threads_per_job


def _codepoint(emoji: str) -> str | None:
    cps = [f"{ord(ch):x}" for ch in emoji if ord(ch) > 0x1F300 or ord(ch) > 0x7F]
    if not cps:
        return None
    return "-".join(cps)


def burn_emoji_png_overlays(
    video: Path,
    *,
    emoji_events: list[tuple[float, float, str, int, int]],
    work_dir: Path,
) -> Path:
    """Overlay PNG emojis; emoji_events = (start_s, end_s, emoji, x, y)."""
    if not emoji_events:
        return video
    cur = video
    threads = str(ffmpeg_threads_per_job())
    for i, (t0, t1, emo, x, y) in enumerate(emoji_events):
        cp = _codepoint(emo)
        if not cp:
            continue
        png = work_dir / f"emoji_{i}.png"
        url = f"https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/{cp}.png"
        try:
            import urllib.request

            urllib.request.urlretrieve(url, png)
        except Exception:
            continue
        if not png.is_file():
            continue
        out = work_dir / f"emoji_step_{i}.mp4"
        vf = f"overlay={x}:{y}:enable='between(t,{t0:.3f},{t1:.3f})'"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-threads",
                threads,
                "-i",
                str(cur),
                "-i",
                str(png),
                "-filter_complex",
                vf,
                "-c:a",
                "copy",
                str(out),
            ],
            check=False,
            capture_output=True,
        )
        if out.is_file():
            cur = out
    return cur


def emoji_events_from_words(
    words: list[dict],
    emoji_by_word: dict,
    *,
    play_w: int,
    play_h: int,
    fontsize: int,
    position: str = "bottom",
) -> list[tuple[float, float, str, int, int]]:
    events: list[tuple[float, float, str, int, int]] = []
    y_base = {"bottom": int(play_h * 0.88), "middle": play_h // 2, "top": int(play_h * 0.12)}.get(
        position, int(play_h * 0.88)
    )
    size = max(32, int(fontsize * 1.2))
    cx = play_w // 2 - size // 2
    emo_y = y_base - int(fontsize * 1.6)
    for w in words:
        wi = w.get("i", w.get("idx"))
        emo = emoji_by_word.get(str(wi)) or emoji_by_word.get(wi)
        if not emo or not isinstance(emo, str):
            continue
        if not emo:
            continue
        t0 = float(w.get("s", 0))
        t1 = float(w.get("e", t0 + 0.4))
        events.append((t0, t1 + 0.6, emo, cx, emo_y))
    return events
