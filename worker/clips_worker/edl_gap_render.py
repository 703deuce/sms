"""Insert EDL gap segments (freeze frames) after source cuts."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.script_edl import EdlSegment


def _extract_frame(src: Path, at_ms: int, frame: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{max(0, at_ms) / 1000:.3f}",
            "-i",
            str(src),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(frame),
        ],
    )


def apply_edl_gap_freezes(
    source_video: Path,
    input_video: Path,
    output_video: Path,
    edl: list[EdlSegment],
    work_dir: Path,
    clip_start_ms: int,
) -> None:
    gaps = [g for g in edl if g.get("kind") == "gap"]
    if not gaps:
        if input_video != output_video:
            subprocess.check_call(["cp", str(input_video), str(output_video)])
        return

    # Re-timeline: walk EDL in output order; source segments from input_video, gaps from frozen frame.
    parts: list[Path] = []
    src_cursor_out = 0
    part_idx = 0
    for seg in edl:
        if seg["kind"] == "source":
            dur_ms = int(seg["outOutMs"]) - int(seg["outInMs"])
            if dur_ms < 1:
                continue
            part = work_dir / f"edl_part_{part_idx}.mp4"
            part_idx += 1
            start_s = src_cursor_out / 1000.0
            dur_s = dur_ms / 1000.0
            subprocess.check_call(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-ss",
                    f"{start_s:.3f}",
                    "-i",
                    str(input_video),
                    "-t",
                    f"{dur_s:.3f}",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "23",
                    "-c:a",
                    "aac",
                    str(part),
                ],
            )
            parts.append(part)
            src_cursor_out += dur_ms
        else:
            dur_ms = max(1, int(seg["durMs"]))
            freeze_ms = int(seg["freezeSrcMs"])
            frame = work_dir / f"gap_frame_{part_idx}.jpg"
            _extract_frame(source_video, freeze_ms - clip_start_ms, frame)
            part = work_dir / f"edl_gap_{part_idx}.mp4"
            part_idx += 1
            subprocess.check_call(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-loop",
                    "1",
                    "-i",
                    str(frame),
                    "-f",
                    "lavfi",
                    "-i",
                    "anullsrc=channel_layout=stereo:sample_rate=44100",
                    "-t",
                    f"{dur_ms / 1000:.3f}",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "23",
                    "-c:a",
                    "aac",
                    "-shortest",
                    str(part),
                ],
            )
            parts.append(part)

    if not parts:
        subprocess.check_call(["cp", str(input_video), str(output_video)])
        return

    list_file = work_dir / "edl_concat.txt"
    list_file.write_text("\n".join(f"file '{p.resolve()}'" for p in parts))
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-c",
            "copy",
            str(output_video),
        ],
    )
