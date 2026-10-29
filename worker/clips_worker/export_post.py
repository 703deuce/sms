"""Post-process finished export mp4: speed + composite loudnorm."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

_SRT_TIME = re.compile(
    r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})"
)


def _edit_speed(edits: dict) -> float:
    raw = edits.get("speed")
    if raw is None:
        return 1.0
    try:
        s = float(raw)
    except (TypeError, ValueError):
        return 1.0
    if s in (1.1, 1.25, 1.5):
        return s
    return 1.0


def _srt_ms(h: int, m: int, s: int, ms: int) -> int:
    return ((h * 60 + m) * 60 + s) * 1000 + ms


def _fmt_srt_ms(total_ms: int) -> str:
    total_ms = max(0, int(total_ms))
    ms = total_ms % 1000
    sec = total_ms // 1000
    s = sec % 60
    m = (sec // 60) % 60
    h = sec // 3600
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def scale_srt(srt_body: str, factor: float) -> str:
    if factor == 1.0 or not srt_body.strip():
        return srt_body

    def repl(m: re.Match[str]) -> str:
        a = _srt_ms(int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)))
        b = _srt_ms(int(m.group(5)), int(m.group(6)), int(m.group(7)), int(m.group(8)))
        return f"{_fmt_srt_ms(round(a * factor))} --> {_fmt_srt_ms(round(b * factor))}"

    return _SRT_TIME.sub(repl, srt_body)


def _probe_fps(path: Path) -> float:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=r_frame_rate",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            text=True,
        ).strip()
        if "/" in out:
            num, den = out.split("/", 1)
            return float(num) / max(1.0, float(den))
    except (subprocess.CalledProcessError, ValueError, OSError):
        pass
    return 30.0


def _probe_duration_sec(path: Path) -> float:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            text=True,
        ).strip()
        return float(out)
    except (subprocess.CalledProcessError, ValueError, OSError):
        return 0.0


def apply_export_post(
    out_mp4: Path,
    td_path: Path,
    edits: dict,
    render_meta: dict,
    *,
    srt_body: str | None = None,
) -> tuple[Path, str | None]:
    """Speed re-encode + optional composite loudnorm; updates render_meta duration fields."""
    speed = _edit_speed(edits)
    loud_lufs = edits.get("loudnessLufs")
    need_loud = edits.get("speechLevelingEnabled") is True and loud_lufs is not None and not render_meta.get("loudnorm_applied")
    if speed == 1.0 and not need_loud:
        return out_mp4, srt_body

    in_s = _probe_duration_sec(out_mp4)
    scaled_srt = scale_srt(srt_body or "", 1.0 / speed if speed != 1.0 else 1.0)
    out_path = td_path / "export_post.mp4"
    try:
        fps = _probe_fps(out_mp4)
        vchain = f"[0:v]setpts=PTS/{speed},fps={fps}[v]"
        achain = f"atempo={speed}"
        if need_loud:
            achain = f"atempo={speed},loudnorm=I={int(loud_lufs)}:TP=-1.5:LRA=11"
        fc = f"{vchain};[0:a]{achain}[a]"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(out_mp4),
                "-filter_complex",
                fc,
                "-map",
                "[v]",
                "-map",
                "[a]",
                "-c:v",
                "libx264",
                "-crf",
                "20",
                "-preset",
                "veryfast",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                str(out_path),
            ],
        )
        out_s = _probe_duration_sec(out_path)
        if speed != 1.0:
            print(
                f"[clipper:speed] applied x={speed} in_s={round(in_s, 3)} out_s={round(out_s, 3)}",
                flush=True,
            )
        if need_loud:
            print(f"[clipper:loudnorm] applied lufs={int(loud_lufs)}", flush=True)
            render_meta["loudnorm_applied"] = True
        effective = int(render_meta.get("effective_edits_ms") or render_meta.get("expected_editor_ms") or 0)
        if effective:
            render_meta["effective_edits_ms"] = round(effective / speed)
        return out_path, scaled_srt
    except Exception as e:
        print(f"[clipper:speed] fallback err={type(e).__name__}", flush=True)
        return out_mp4, srt_body
