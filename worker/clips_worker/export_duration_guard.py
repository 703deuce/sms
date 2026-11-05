"""Bound exported MP4 presentation duration to the editor's effective output duration.

Certain overlay/concat paths can extend the muxed video and AAC streams beyond
the edited clip (notably a 1 s clip producing 1.32 s video). The final render
must not expose frames/audio after the user's Out point. Only re-encode when
the actual muxed result exceeds the expected duration by more than codec/frame
rounding tolerance; ordinary exports pass through unchanged.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


def probe_stream_durations(path: Path) -> dict[str, float]:
    out = subprocess.check_output(
        [
            "ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,duration:format=duration", "-of", "json", str(path),
        ],
        text=True,
    )
    data = json.loads(out)
    format_duration = float((data.get("format") or {}).get("duration") or 0)
    result: dict[str, float] = {"format": format_duration}
    for stream in data.get("streams") or []:
        kind = stream.get("codec_type")
        if kind not in ("video", "audio"):
            continue
        try:
            result[kind] = max(result.get(kind, 0), float(stream.get("duration") or format_duration))
        except (ValueError, TypeError):
            pass
    return result


def correct_export_overrun(
    source: Path,
    output: Path,
    expected_ms: int,
    *,
    tolerance_ms: int = 70,
) -> tuple[Path, dict[str, float]]:
    """Clamp overlong MP4 exports, preserving an unchanged source if in tolerance.

    Do not use for brand-bookended media: those bookends intentionally lengthen
    the main editor timeline and must be accounted for separately.
    """
    if expected_ms <= 0:
        return source, {}
    before = probe_stream_durations(source)
    requested = expected_ms / 1000.0
    if max(before.values(), default=0) <= requested + tolerance_ms / 1000.0:
        return source, before

    has_audio = "audio" in before
    filtergraph = f"[0:v:0]trim=duration={requested:.6f},setpts=PTS-STARTPTS[v]"
    if has_audio:
        filtergraph += f";[0:a:0]atrim=duration={requested:.6f},asetpts=PTS-STARTPTS[a]"
    cmd = [
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-filter_complex", filtergraph, "-map", "[v]",
    ]
    if has_audio:
        cmd += ["-map", "[a]"]
    cmd += [
        "-t", f"{requested:.6f}", "-c:v", "libx264", "-preset", "veryfast",
        "-crf", "20", "-pix_fmt", "yuv420p",
    ]
    if has_audio:
        cmd += ["-c:a", "aac", "-b:a", "192k"]
    cmd += ["-movflags", "+faststart", str(output)]
    subprocess.run(cmd, check=True)
    after = probe_stream_durations(output)
    if after.get("video", 0) > requested + tolerance_ms / 1000.0:
        raise RuntimeError(f"export_video_overrun:{after['video']:.3f}s expected={requested:.3f}s")
    if after.get("audio", 0) > requested + tolerance_ms / 1000.0:
        raise RuntimeError(f"export_audio_overrun:{after['audio']:.3f}s expected={requested:.3f}s")
    return output, after
