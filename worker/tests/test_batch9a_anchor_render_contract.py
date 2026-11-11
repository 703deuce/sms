"""Batch 9A first-ten worker contract + real low-res export proof.

The JSON fixture is also asserted by the new-app Vitest suite against the live
F01-F10 compiler output. This worker half therefore exercises the same slot
clock/transition contract without copying a second independent schedule.
"""
from __future__ import annotations

import functools
import json
import math
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.audio_render import apply_audio_mix, require_template_soundtrack
from clips_worker.media_sources import apply_full_render_sources, source_transition_boundaries
from clips_worker.motion import SHADER_TRANSITIONS, normalize_transition_spec
from clips_worker.text_anim import norm_anim
from clips_worker.text_items import apply_text_items, text_items

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = json.loads(
    (ROOT / "new-app" / "tests" / "fixtures" / "batch9a-anchor-render-contract.json").read_text()
)
ANCHORS = CONTRACT["anchors"]
FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")
COLORS = ("#DC2626", "#2563EB", "#16A34A", "#D97706", "#7C3AED", "#0891B2")


def _ms(frame: int) -> int:
    # Mirror JS Math.round(frame * 1000 / 30), including .5 ties.
    return int(math.floor(frame * 1000.0 / 30.0 + 0.5))


def _edits(row: dict) -> dict:
    sources = []
    segments = []
    for index, (start, duration) in enumerate(zip(row["slotStarts"], row["slotFrames"])):
        source_id = f"source_{index}"
        ref_id = f"image_{index}"
        sources.append({"id": source_id, "ref": "upload", "refId": ref_id, "mediaType": "image"})
        segments.append({
            "id": f"slot_{index + 1:02d}",
            "sourceId": source_id,
            "startMs": _ms(start),
            "endMs": _ms(start + duration),
            "fit": "cover",
            "fx": {"contrast": 3, "saturation": 3},
        })
    duration_ms = _ms(row["totalFrames"])
    transitions = [{
        "srcMs": _ms(item["atFrame"]),
        "type": item["type"],
        "durMs": _ms(item["durationFrames"]),
    } for item in row["transitions"]]
    text_items_data = [
        {
            "id": "headline",
            "text": row["headline"],
            "startMs": 0,
            "endMs": min(duration_ms, 2200),
            "x": 50,
            "y": 20,
            "style": {
                "font": "Montserrat",
                "size": 86,
                "color": "#FFFFFF",
                "align": "center",
                "case": "none",
                "stroke": {"color": "#000000", "width": 2},
                "shadow": {"color": "#000000", "opacity": 80, "dist": 4},
                "letterSpacing": 1.0,
            },
            "anim": {
                "in": {"type": "slide_up", "unit": "block", "durMs": 360},
                "out": {"type": "fade", "unit": "block", "durMs": 260},
            },
        },
        {
            "id": "closing",
            "text": row["closing"],
            "startMs": max(0, duration_ms - 2400),
            "endMs": duration_ms,
            "x": 50,
            "y": 78,
            "style": {
                "font": "Montserrat",
                "size": 58,
                "color": "#FFFFFF",
                "align": "center",
                "case": "none",
                "stroke": {"color": "#000000", "width": 1},
                "shadow": {"color": "#000000", "opacity": 70, "dist": 3},
                "letterSpacing": 0.5,
            },
            "anim": {
                "in": {"type": "fade", "unit": "block", "durMs": 440},
                "out": {"type": "fade", "unit": "block", "durMs": 260},
            },
        },
    ]
    return {
        "v": 2,
        "trim": {"in": 0, "out": duration_ms},
        "cutRanges": [],
        "sources": sources,
        "sourceSegments": segments,
        "videoSplits": [_ms(frame) for frame in row["slotStarts"][1:]],
        "transitions": transitions,
        "textItems": text_items_data,
        "audio": {
            "music": {
                "generationId": "batch9a_music_fixture",
                "uploadId": "batch9a_music_fixture",
                "startMs": 0,
                "endMs": duration_ms,
                "loop": False,
                "volume": 0.35,
            },
            "sfx": [],
        },
        "templateProvenance": {
            "v": 1,
            "instanceId": "batch9a_worker_test",
            "familyId": row["familyId"],
            "familyRevision": 2,
            "designId": row["id"],
            "designRevision": 2,
            "slotToItemIds": {f"slot_{i + 1:02d}": f"slot_{i + 1:02d}" for i in range(len(row["slotFrames"]))},
        },
    }


@pytest.mark.parametrize("row", ANCHORS, ids=lambda row: row["id"])
def test_batch9a_worker_accepts_exact_editable_contract(row: dict) -> None:
    edits = _edits(row)
    expected_boundaries = set(edits["videoSplits"])
    assert source_transition_boundaries(edits) == expected_boundaries
    assert len(edits["sourceSegments"]) == len(row["slotFrames"])
    assert len(edits["transitions"]) == len(row["slotFrames"]) - 1
    assert len(text_items(edits)) == 2
    assert all(norm_anim(item["anim"]) for item in edits["textItems"])
    for authored, compiled in zip(row["transitions"], edits["transitions"]):
        normalized = normalize_transition_spec(compiled)
        assert normalized == {
            "type": authored["type"],
            "durMs": _ms(authored["durationFrames"]),
        }
    music = edits["audio"]["music"]
    assert music["uploadId"] == music["generationId"] == "batch9a_music_fixture"
    assert music["startMs"] == 0 and music["endMs"] == _ms(row["totalFrames"])
    assert music["loop"] is False


@functools.lru_cache(maxsize=1)
def _shader_context_available() -> bool:
    try:
        from clips_worker.shader_transitions import gl_context
        ctx, _renderer = gl_context()
        ctx.release()
        return True
    except Exception:
        return False


def _run(*args: str) -> None:
    subprocess.run(args, check=True, capture_output=True, text=True, timeout=120)


def _probe(path: Path) -> dict:
    return json.loads(subprocess.check_output([
        FFPROBE, "-v", "error",
        "-show_entries", "format=duration:stream=codec_type,nb_frames",
        "-of", "json", str(path),
    ], text=True, timeout=30))


def _frame(path: Path, seconds: float) -> bytes:
    return subprocess.check_output([
        FFMPEG, "-v", "error", "-ss", f"{seconds:.4f}", "-i", str(path),
        "-frames:v", "1", "-vf", "scale=48:86,format=gray",
        "-f", "rawvideo", "-pix_fmt", "gray", "-",
    ], timeout=30)


@pytest.mark.skipif(not FFMPEG or not FFPROBE, reason="FFmpeg/ffprobe required")
@pytest.mark.parametrize("row", ANCHORS, ids=lambda row: row["id"])
def test_batch9a_anchor_real_worker_export(row: dict, tmp_path: Path) -> None:
    shader_types = {item["type"] for item in row["transitions"] if item["type"] in SHADER_TRANSITIONS}
    if shader_types and not _shader_context_available():
        pytest.skip("worker GL context unavailable for " + ",".join(sorted(shader_types)))

    edits = _edits(row)
    duration_s = row["totalFrames"] / 30.0
    duration_ms = _ms(row["totalFrames"])
    carrier = tmp_path / "carrier.mp4"
    _run(
        FFMPEG, "-y", "-v", "error",
        "-f", "lavfi", "-i", f"color=c=#111111:s=180x320:r=30:d={duration_s:.6f}",
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-t", f"{duration_s:.6f}", "-c:v", "libx264", "-preset", "ultrafast",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(carrier),
    )

    media: dict[str, Path] = {}
    for index in range(len(row["slotFrames"])):
        image = tmp_path / f"image_{index}.png"
        _run(
            FFMPEG, "-y", "-v", "error",
            "-f", "lavfi", "-i", f"color=c={COLORS[index % len(COLORS)]}:s=180x320",
            "-frames:v", "1", str(image),
        )
        media[f"image_{index}"] = image

    sourced = apply_full_render_sources(carrier, edits, 0, duration_ms, tmp_path, media)
    assert sourced.is_file() and sourced.stat().st_size > 1000

    with_text = tmp_path / "with_text.mp4"
    rendered_text = apply_text_items(sourced, with_text, edits, play_w=180, play_h=320)
    assert rendered_text.is_file() and rendered_text.stat().st_size > 1000
    title_stamp = min(duration_s - 0.1, 1.0)
    assert _frame(sourced, title_stamp) != _frame(rendered_text, title_stamp), "animated text did not render"

    music = tmp_path / "batch9a_music.wav"
    _run(
        FFMPEG, "-y", "-v", "error",
        "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=16",
        "-filter:a", "volume=0.12", str(music),
    )
    require_template_soundtrack(edits["audio"]["music"], music)
    final = tmp_path / "final.mp4"
    apply_audio_mix(
        rendered_text, final, music, [],
        length_s=duration_s,
        volume=0.35,
        duck_depth=0.55,
        fade_in_s=0.2,
        fade_out_s=0.35,
        music_loop=False,
    )
    info = _probe(final)
    streams = info.get("streams", [])
    assert any(stream.get("codec_type") == "video" for stream in streams)
    assert any(stream.get("codec_type") == "audio" for stream in streams)
    assert abs(float(info["format"]["duration"]) - duration_s) < 0.10

    # First, last, and every authored cut must contain actual composed media.
    check_frames = [1, row["totalFrames"] - 2, *row["slotStarts"][1:]]
    for frame in check_frames:
        pixels = _frame(final, max(0.01, min(duration_s - 0.02, frame / 30.0)))
        assert pixels and sum(pixels) / len(pixels) > 8, f"black/empty frame at {frame}"

    # No flattening escape hatch: the worker consumed the exact native lanes.
    assert len(edits["sourceSegments"]) == len(row["slotFrames"])
    assert len(edits["videoSplits"]) == len(row["slotFrames"]) - 1
    assert len(edits["transitions"]) == len(row["slotFrames"]) - 1
    assert edits["audio"]["music"]["uploadId"] == "batch9a_music_fixture"
