"""Optional export-time profanity censor (caption asterisks + audio mute/bleep)."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from clips_worker.streamer.lexicon import PROFANITY

_WORD_RE = re.compile(r"^[\w']+$", re.I)


def _is_profanity(token: str) -> bool:
    bare = re.sub(r"[^\w']", "", token.lower())
    if not bare:
        return False
    for p in PROFANITY:
        if bare == p or bare.startswith(p) or p in bare:
            return True
    return False


def _mask_token(token: str) -> str:
    if len(token) <= 1:
        return "*"
    lead = token[0] if not token[0].isalnum() else ""
    core = token[len(lead) :]
    if not core:
        return "*" * len(token)
    return f"{lead}{'*' * len(core)}"


def mask_profanity_in_words(words: list[dict]) -> tuple[list[dict], list[tuple[float, float]]]:
    """Return masked words and [start_s, end_s] intervals for audio censor."""
    out: list[dict] = []
    intervals: list[tuple[float, float]] = []
    for w in words:
        row = dict(w)
        text = str(row.get("w") or row.get("word") or "")
        if text and _is_profanity(text):
            row["w"] = _mask_token(text)
            try:
                s = float(row.get("s", 0))
                e = float(row.get("e", s + 0.2))
                intervals.append((max(0, s - 0.02), e + 0.02))
            except (TypeError, ValueError):
                pass
        out.append(row)
    return out, intervals


def apply_audio_censor_bleep(
    video: Path,
    out: Path,
    intervals: list[tuple[float, float]],
) -> None:
    if not intervals:
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-c", "copy", str(out)],
        )
        return
    parts: list[str] = []
    for a, b in intervals:
        parts.append(f"volume=0:enable='between(t,{a:.3f},{b:.3f})'")
    af = ",".join(parts)
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(video),
        "-af",
        af,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(out),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def censor_clip_words_and_audio(
    video: Path,
    words: list[dict],
    work_dir: Path,
) -> tuple[list[dict], Path]:
    masked, intervals = mask_profanity_in_words(words)
    if not intervals:
        return masked, video
    censored = work_dir / "profanity_censor.mp4"
    apply_audio_censor_bleep(video, censored, intervals)
    return masked, censored
