"""Post-process finished export mp4: (E4 per-item speed warp) + speed + composite loudnorm."""
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


def warp_srt(srt_body: str, pieces: list[dict], factor: float = 1.0) -> str:
    """E4: map SRT times through the per-item speed warp (edit ms → real ms), then × factor."""
    from clips_worker.speed import warp_ms

    if not srt_body.strip():
        return srt_body

    def repl(m: re.Match[str]) -> str:
        a = _srt_ms(int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)))
        b = _srt_ms(int(m.group(5)), int(m.group(6)), int(m.group(7)), int(m.group(8)))
        return f"{_fmt_srt_ms(round(warp_ms(pieces, a) * factor))} --> {_fmt_srt_ms(round(warp_ms(pieces, b) * factor))}"

    return _SRT_TIME.sub(repl, srt_body)


def speed_warp_for(edits: dict, render_meta: dict) -> list[dict]:
    """Warp pieces from the render (exact concat segments), else from the edits' keep segments."""
    from clips_worker.speed import has_speed_change, normalize_segment_speeds, speed_warp_pieces

    pieces = render_meta.get("speed_warp")
    if not isinstance(pieces, list):
        speeds = normalize_segment_speeds(edits.get("segmentSpeeds"))
        if not speeds:
            return []
        from clips_worker.clip_keep_segments import ordered_keep_segments

        pieces = speed_warp_pieces(ordered_keep_segments(edits), speeds)
    return pieces if has_speed_change(pieces) else []


def _has_audio(path: Path) -> bool:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
             "-of", "csv=p=0", str(path)],
            text=True,
        ).strip()
        return bool(out)
    except (subprocess.CalledProcessError, OSError):
        return True


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
    pieces = speed_warp_for(edits, render_meta)
    if speed == 1.0 and not need_loud and not pieces:
        return out_mp4, srt_body

    in_s = _probe_duration_sec(out_mp4)
    if pieces:
        scaled_srt = warp_srt(srt_body or "", pieces, 1.0 / speed)
    else:
        scaled_srt = scale_srt(srt_body or "", 1.0 / speed if speed != 1.0 else 1.0)
    out_path = td_path / "export_post.mp4"
    try:
        fps = _probe_fps(out_mp4)
        if pieces:
            # E4: piecewise warp (pitch-preserving atempo), then the existing global speed.
            from clips_worker.speed import warp_filtergraph

            has_a = _has_audio(out_mp4)
            graph, vl, al = warp_filtergraph(pieces, fps, has_audio=has_a)
            vchain = f"{graph};[{vl}]setpts=PTS/{speed},fps={fps}[v]"
            aparts = [f"atempo={speed}"] if speed != 1.0 else []
            if need_loud:
                aparts.append(f"loudnorm=I={int(loud_lufs)}:TP=-1.5:LRA=11")
            fc = vchain + (f";[{al}]{','.join(aparts) or 'anull'}[a]" if al else "")
        else:
            vchain = f"[0:v]setpts=PTS/{speed},fps={fps}[v]"
            achain = f"atempo={speed}"
            if need_loud:
                achain = f"atempo={speed},loudnorm=I={int(loud_lufs)}:TP=-1.5:LRA=11"
            fc = f"{vchain};[0:a]{achain}[a]"
        amap = ["-map", "[a]"] if (not pieces or al) else []
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
                *amap,
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
        if pieces:
            from clips_worker.speed import warp_ms

            print(f"[clipper:speed] warp pieces={len(pieces)} in_s={round(in_s, 3)} out_s={round(out_s, 3)}", flush=True)
            for key in ("effective_edits_ms", "expected_editor_ms"):
                v = int(render_meta.get(key) or 0)
                if v:
                    render_meta[key] = round(warp_ms(pieces, v) / speed)
            return out_path, scaled_srt
        effective = int(render_meta.get("effective_edits_ms") or render_meta.get("expected_editor_ms") or 0)
        if effective:
            render_meta["effective_edits_ms"] = round(effective / speed)
        return out_path, scaled_srt
    except Exception as e:
        print(f"[clipper:speed] fallback err={type(e).__name__}", flush=True)
        return out_mp4, srt_body
