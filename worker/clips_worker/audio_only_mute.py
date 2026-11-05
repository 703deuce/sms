"""Audio-only filler cuts mapped from source milliseconds to the final output clock.

Unlike transcript deletion these edits never remove/reorder video frames.
The exported embedded program audio gets 12ms cosine-free linear volume ramps;
music/SFX mixed later in the pipeline are not muted.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

RAMP_MS = 12


def source_mutes_to_output(edits: dict) -> list[tuple[int, int]]:
    from clips_worker.clip_keep_segments import ordered_keep_segments

    raw = edits.get("audioMuteRanges") or []
    intervals: list[tuple[int, int]] = []
    output_start = 0
    for source_start, source_end in ordered_keep_segments(edits):
        for mute in raw[:2000]:
            if not isinstance(mute, (list, tuple)) or len(mute) != 2:
                continue
            try:
                lo = max(source_start, int(mute[0]))
                hi = min(source_end, int(mute[1]))
            except (TypeError, ValueError):
                continue
            if hi > lo:
                intervals.append((output_start + lo - source_start, output_start + hi - source_start))
        output_start += source_end - source_start

    intervals.sort()
    merged: list[tuple[int, int]] = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    return merged


def mute_volume_expression(intervals: list[tuple[int, int]], ramp_ms: int = RAMP_MS) -> str:
    """FFmpeg volume expression evaluated on audio frames; unity outside mutes."""
    pieces: list[str] = []
    for start, end in intervals:
        if end <= start:
            continue
        ramp = min(ramp_ms, (end - start) / 2) / 1000.0
        a, b = start / 1000.0, end / 1000.0
        if ramp <= 0:
            continue
        # The gain envelope is zero inside the muted interval except for the
        # short soft edges. All source audio returns at exactly the old time.
        left = f"min(max((t-{a:.6f})/{ramp:.6f},0),1)"
        right = f"min(max(({b:.6f}-t)/{ramp:.6f},0),1)"
        pieces.append(f"(1-({left})*({right}))")
    return "*".join(pieces) if pieces else "1"


def apply_audio_only_mutes(video: Path, dest: Path, edits: dict) -> bool:
    intervals = source_mutes_to_output(edits)
    if not intervals:
        return False
    expr = mute_volume_expression(intervals)
    subprocess.check_call([
        "ffmpeg", "-y", "-v", "error", "-i", str(video),
        "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "copy",
        "-af", f"volume='{expr}':eval=frame",
        "-c:a", "aac", "-b:a", "192k", str(dest),
    ])
    return True
