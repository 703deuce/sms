"""G1b3: linked split edits (J / L cuts). Mirror of new-app lib/clips/editor/split-edits.ts.

`edits.splitEdits = [{atMs, audioMs}]`: at the real cut whose right keep segment starts at source
`atMs`, the SOUND switches `audioMs` after (L-cut, > 0) or before (J-cut, < 0) the picture. Same
keep segments and total length; the audio plays [s_i + a_i, e_i + a_{i+1}] back to back.
Parity fixture: tests/fixtures/g1b3_parity.json.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

SPLIT_MAX_MS = 10_000
SPLIT_MAX_EDITS = 200
SPLIT_MIN_PIECE_MS = 100


def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and f not in (float("inf"), float("-inf")) else None


def _round(x: float) -> int:
    # JS Math.round (half up) — parity with the web.
    import math

    return int(math.floor(x + 0.5))


def normalize_split_edits(raw) -> list[dict] | None:
    if not isinstance(raw, list):
        return None
    by: dict[int, int] = {}
    for r in raw:
        if not isinstance(r, dict):
            continue
        at, v = _num(r.get("atMs")), _num(r.get("audioMs"))
        if at is None or v is None:
            continue
        at_i, v_i = _round(at), _round(v)
        if at_i < 0 or v_i == 0:
            continue
        by[at_i] = max(-SPLIT_MAX_MS, min(SPLIT_MAX_MS, v_i))
        if len(by) >= SPLIT_MAX_EDITS:
            break
    out = [{"atMs": k, "audioMs": by[k]} for k in sorted(by)]
    return out or None


def split_offsets(segs, splits, trim_in: int, trim_out: int) -> list[int]:
    n = len(segs)
    a = [0] * (n + 1)
    if not splits or n < 2:
        return a
    m = {_round(float(s["atMs"])): _round(float(s["audioMs"])) for s in splits}
    for k in range(1, n):
        p0, p1 = segs[k - 1]
        q0, q1 = segs[k]
        if -1 < q0 - p1 < 1:
            continue
        v = m.get(_round(q0), 0)
        if not v:
            continue
        lim = (min(p1 - p0, q1 - q0) - SPLIT_MIN_PIECE_MS) // 2
        if lim <= 0:
            continue
        v = max(-lim, min(lim, v))
        if v > 0:
            v = min(v, max(0, trim_out - p1))
        else:
            v = max(v, -max(0, q0 - trim_in))
        a[k] = int(round(v))
    return a


def audio_segments(segs, offsets) -> list[tuple[int, int]]:
    return [(s + offsets[i], e + offsets[i + 1]) for i, (s, e) in enumerate(segs)]


def edits_split_offsets(edits: dict, segs) -> list[int]:
    trim = edits.get("trim") or {}
    return split_offsets(
        segs,
        normalize_split_edits(edits.get("splitEdits")),
        int(trim.get("in", 0)),
        int(trim.get("out", 0)),
    )


def apply_split_audio(cut_mp4: Path, full_render: Path, out_mp4: Path, audio_secs: list[tuple[float, float]]) -> Path:
    """Replace cut.mp4's sound with the J / L audio pieces cut from full_render (same 10 ms edge
    fades as ffmpeg_concat_segments). Video stream copied. Filters: atrim/asetpts/afade/concat
    (all in ffmpeg 5.1)."""
    parts: list[str] = []
    for i, (a, b) in enumerate(audio_secs):
        dur = max(0.0, b - a)
        parts.append(
            f"[0:a]atrim=start={a:.6f}:end={b:.6f},asetpts=PTS-STARTPTS,"
            f"afade=t=in:d=0.01,afade=t=out:st={max(0.0, dur - 0.01):.3f}:d=0.01[a{i}]"
        )
    fc = ";".join(parts) + ";" + "".join(f"[a{i}]" for i in range(len(audio_secs))) + f"concat=n={len(audio_secs)}:v=0:a=1[a]"
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(full_render), "-i", str(cut_mp4),
            "-filter_complex", fc, "-map", "1:v:0", "-map", "[a]",
            "-c:v", "copy", "-c:a", "aac", "-shortest", str(out_mp4),
        ]
    )
    return out_mp4
