"""B6 item-local 30fps source playback: stepped rates + true picture holds.

This module deliberately warps only the selected source window. The authored output clock remains
unchanged, so captions, graphics, transitions and music continue through a hold/ramp.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

PLAYBACK_FPS = 30


def normalize_source_playback(raw) -> dict | None:
    if not isinstance(raw, dict) or raw.get("v") != 1 or raw.get("fps") != PLAYBACK_FPS:
        return None
    output_frames = raw.get("outputFrames")
    pieces = raw.get("pieces")
    if not isinstance(output_frames, int) or isinstance(output_frames, bool) or output_frames < 1:
        return None
    if not isinstance(pieces, list) or not pieces:
        return None
    out: list[dict] = []
    total = 0
    for raw_piece in pieces:
        if not isinstance(raw_piece, dict):
            return None
        frames = raw_piece.get("frames")
        if not isinstance(frames, int) or isinstance(frames, bool) or frames < 1:
            return None
        if raw_piece.get("kind") == "hold":
            piece = {"kind": "hold", "frames": frames}
        elif raw_piece.get("kind") == "play":
            try:
                rate = float(raw_piece.get("rate"))
            except (TypeError, ValueError):
                return None
            if not math.isfinite(rate) or not 0.25 <= rate <= 4.0:
                return None
            piece = {"kind": "play", "frames": frames, "rate": round(rate, 3)}
        else:
            return None
        out.append(piece)
        total += frames
    if total != output_frames:
        return None
    return {"v": 1, "fps": PLAYBACK_FPS, "outputFrames": output_frames, "pieces": out}


def sample_source_playback(playback: dict, local_frame: float) -> dict:
    plan = normalize_source_playback(playback)
    if plan is None or not math.isfinite(float(local_frame)):
        raise ValueError("invalid source playback plan/frame")
    local_frame = float(local_frame)
    first = plan["pieces"][0]
    if local_frame < 0:
        rate = float(first.get("rate") or 0.0) if first["kind"] == "play" else 0.0
        return {"mediaOffsetFrame": local_frame * rate if rate else 0.0, "rate": rate, "held": rate == 0.0}
    output = 0
    source = 0.0
    last_sample = 0.0
    for piece in plan["pieces"]:
        frames = int(piece["frames"])
        if local_frame < output + frames:
            if piece["kind"] == "hold":
                return {"mediaOffsetFrame": last_sample, "rate": 0.0, "held": True}
            rate = float(piece["rate"])
            return {"mediaOffsetFrame": source + (local_frame - output) * rate, "rate": rate, "held": False}
        if piece["kind"] == "play":
            rate = float(piece["rate"])
            last_sample = source + (frames - 1) * rate
            source += frames * rate
        output += frames
    last = plan["pieces"][-1]
    rate = float(last.get("rate") or 0.0) if last["kind"] == "play" else 0.0
    offset = last_sample + (local_frame - (plan["outputFrames"] - 1)) * rate if rate else last_sample
    return {"mediaOffsetFrame": offset, "rate": rate, "held": rate == 0.0}


def playback_media_offset_ms(playback: dict, local_ms: float) -> float:
    sample = sample_source_playback(playback, float(local_ms) * PLAYBACK_FPS / 1000.0)
    return float(sample["mediaOffsetFrame"]) * 1000.0 / PLAYBACK_FPS


def _runs(playback: dict, start_frame: int, frame_count: int) -> list[dict]:
    if not isinstance(start_frame, int) or not isinstance(frame_count, int) or frame_count < 1:
        raise ValueError("invalid playback render range")
    out: list[dict] = []
    prev_offset: float | None = None
    for frame in range(start_frame, start_frame + frame_count):
        sample = sample_source_playback(playback, frame)
        offset = float(sample["mediaOffsetFrame"])
        held = bool(sample["held"])
        rate = float(sample["rate"])
        current = out[-1] if out else None
        contiguous = False
        if current is not None and current["held"] == held and abs(float(current["rate"]) - rate) <= 1e-9:
            if held:
                contiguous = prev_offset is not None and abs(offset - prev_offset) <= 1e-7
            else:
                contiguous = prev_offset is not None and abs(offset - (prev_offset + rate)) <= 1e-6
        if contiguous:
            current["frames"] += 1
        else:
            out.append({"held": held, "rate": rate, "frames": 1, "mediaOffsetFrame": offset})
        prev_offset = offset
    return out


def _atempo_chain(speed: float) -> str:
    value = float(speed)
    factors: list[float] = []
    while value > 2.0 + 1e-9:
        factors.append(2.0)
        value /= 2.0
    while value < 0.5 - 1e-9:
        factors.append(0.5)
        value /= 0.5
    factors.append(value)
    return ",".join("atempo=" + format(x, ".6f") for x in factors)


def render_playback_window(
    source_path: Path,
    playback: dict,
    source_in_ms: int,
    source_duration_ms: int | None,
    start_frame: int,
    frame_count: int,
    fps: float,
    out_path: Path,
    *,
    include_audio: bool,
) -> None:
    plan = normalize_source_playback(playback)
    if plan is None:
        raise ValueError("invalid source playback plan")
    if abs(float(fps) - PLAYBACK_FPS) > 0.01:
        raise ValueError("template playback requires the authored 30fps carrier")
    runs = _runs(plan, int(start_frame), int(frame_count))
    if not runs:
        raise ValueError("empty source playback render")
    min_offset = min(float(r["mediaOffsetFrame"]) for r in runs)
    max_offset = max(
        float(r["mediaOffsetFrame"]) + (int(r["frames"]) - 1) * float(r["rate"])
        for r in runs
    )
    min_source_frame = float(source_in_ms) * PLAYBACK_FPS / 1000.0 + min_offset
    max_source_frame = float(source_in_ms) * PLAYBACK_FPS / 1000.0 + max_offset
    if min_source_frame < -1e-6:
        raise ValueError("source playback requires unavailable head handles")
    if source_duration_ms is not None:
        source_frames = float(source_duration_ms) * PLAYBACK_FPS / 1000.0
        if max_source_frame > source_frames - 1 + 1e-6:
            raise ValueError("source playback requires unavailable tail handles")

    cmd = ["ffmpeg", "-y", "-v", "error"]
    filters: list[str] = []
    vlabels: list[str] = []
    alabels: list[str] = []
    for idx, run in enumerate(runs):
        frames = int(run["frames"])
        rate = float(run["rate"])
        held = bool(run["held"])
        offset = float(run["mediaOffsetFrame"])
        seek_ms = float(source_in_ms) + offset * 1000.0 / PLAYBACK_FPS
        if seek_ms < -0.5:
            raise ValueError("source playback seek before media start")
        seek_s = max(0.0, seek_ms / 1000.0)
        duration_s = frames / PLAYBACK_FPS
        if held:
            cmd += ["-ss", format(seek_s, ".6f"), "-i", str(source_path)]
            filters.append(
                f"[{idx}:v]fps={PLAYBACK_FPS},trim=end_frame=1,setpts=PTS-STARTPTS,"
                f"tpad=stop_mode=clone:stop={frames - 1},"
                f"trim=end_frame={frames},setsar=1,format=yuv420p,setpts=N/({PLAYBACK_FPS}*TB)[v{idx}]"
            )
            if include_audio:
                filters.append(
                    f"anullsrc=r=48000:cl=stereo,atrim=end_sample={frames * 1600},"
                    f"asetpts=PTS-STARTPTS[a{idx}]"
                )
        else:
            source_span_s = frames * rate / PLAYBACK_FPS
            cmd += [
                "-ss", format(seek_s, ".6f"),
                "-t", format(source_span_s + 0.25, ".6f"),
                "-i", str(source_path),
            ]
            filters.append(
                f"[{idx}:v]setpts=(PTS-STARTPTS)/{rate:.6f},fps={PLAYBACK_FPS},"
                f"trim=end_frame={frames},setsar=1,format=yuv420p,setpts=N/({PLAYBACK_FPS}*TB)[v{idx}]"
            )
            if include_audio:
                filters.append(
                    f"[{idx}:a]asetpts=PTS-STARTPTS,{_atempo_chain(rate)},aresample=48000,"
                    f"aformat=sample_fmts=fltp:channel_layouts=stereo,"
                    f"apad,atrim=end_sample={frames * 1600},asetpts=PTS-STARTPTS[a{idx}]"
                )
        vlabels.append(f"[v{idx}]")
        if include_audio:
            alabels.append(f"[a{idx}]")

    if len(vlabels) > 1:
        filters.append("".join(vlabels) + f"concat=n={len(vlabels)}:v=1:a=0[vout]")
        vout = "vout"
    else:
        vout = "v0"
    aout: str | None = None
    if include_audio:
        if len(alabels) > 1:
            filters.append("".join(alabels) + f"concat=n={len(alabels)}:v=0:a=1[aout]")
            aout = "aout"
        else:
            aout = "a0"

    cmd += ["-filter_complex", ";".join(filters), "-map", f"[{vout}]", "-frames:v", str(frame_count)]
    if aout:
        cmd += ["-map", f"[{aout}]", "-c:a", "aac", "-b:a", "192k"]
    else:
        cmd += ["-an"]
    cmd += [
        "-r", str(PLAYBACK_FPS), "-t", f"{frame_count / PLAYBACK_FPS:.9f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        str(out_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError("source playback render failed: " + (proc.stderr or "")[-1000:])
    # A short output otherwise falls back to the black neutral carrier at the end.
    # Validate decoded pictures, not container duration/frames requested on the command line.
    from clips_worker.ffmpeg_util import probe_video_nb_frames
    actual = probe_video_nb_frames(out_path)
    if actual != frame_count:
        raise RuntimeError(
            f"source playback decoded-frame mismatch: expected {frame_count}, got {actual}"
        )
