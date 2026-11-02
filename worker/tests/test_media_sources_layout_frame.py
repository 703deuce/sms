import subprocess
from pathlib import Path

from clips_worker.media_sources import (
    build_sources_filtergraph,
    normalize_media_sources,
    normalize_source_segments,
    source_windows,
)


def _ffmpeg(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args])


def _channel_mean(raw: bytes, width: int, height: int, x0: int, x1: int, ch: int) -> float:
    total = 0.0
    n = 0
    for y in range(height):
        for x in range(x0, x1):
            i = (y * width + x) * 3 + ch
            total += raw[i]
            n += 1
    return total / max(1, n)


def test_side_by_side_export_frame_left_right_luma(tmp_path: Path) -> None:
    """Same input layout as apply_full_render_sources: [0]=full_render main, extra inputs=angle file."""
    full_render = tmp_path / "full_render.mp4"
    ang_mp4 = tmp_path / "ang.mp4"
    _ffmpeg("-f", "lavfi", "-i", "color=c=red:s=640x480:d=35", str(full_render))
    _ffmpeg("-f", "lavfi", "-i", "color=c=blue:s=640x480:d=35", str(ang_mp4))

    edits = {
        "sources": [{"id": "ang2", "ref": "upload", "refId": "u2", "mediaType": "video", "syncMs": 0}],
        "sourceSegments": [
            {
                "id": "seg1",
                "sourceId": "ang2",
                "startMs": 10_000,
                "endMs": 32_000,
                "layout": {"kind": "side_by_side", "withSourceId": "main", "split": 0.5},
            }
        ],
    }
    sources = normalize_media_sources(edits["sources"])
    segs = normalize_source_segments(edits["sourceSegments"], sources)
    layout = segs[0]["layout"]
    wins = source_windows(edits, 10_000, 32_000)
    assert wins and wins[0].get("layout")
    w = wins[0]
    media = {"u2": ang_mp4}
    extra_inputs, fc, vlabel, _ = build_sources_filtergraph(
        [w],
        [ang_mp4],
        640,
        480,
        30.0,
        main_has_audio=False,
        source_has_audio=[True],
        edits=edits,
        media=media,
    )
    assert "hstack=inputs=2" in fc
    out_png = tmp_path / "frame.png"
    _ffmpeg(
        "-i",
        str(full_render),
        *extra_inputs,
        "-filter_complex",
        fc,
        "-map",
        f"[{vlabel}]",
        "-ss",
        "15",
        "-frames:v",
        "1",
        str(out_png),
    )
    raw = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(out_png),
            "-vf",
            "scale=640:480",
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ],
    )
    width, height = 640, 480
    mid = width // 2
    left_r = _channel_mean(raw, width, height, 0, mid, 0)
    left_g = _channel_mean(raw, width, height, 0, mid, 1)
    left_b = _channel_mean(raw, width, height, 0, mid, 2)
    right_r = _channel_mean(raw, width, height, mid, width, 0)
    right_g = _channel_mean(raw, width, height, mid, width, 1)
    right_b = _channel_mean(raw, width, height, mid, width, 2)
    left_luma = 0.299 * left_r + 0.587 * left_g + 0.114 * left_b
    right_luma = 0.299 * right_r + 0.587 * right_g + 0.114 * right_b

    # Baseline: same window without layout (angle-only overlay) is full blue at this frame.
    edits_flat = {**edits, "sourceSegments": [{**edits["sourceSegments"][0], "layout": None}]}
    segs_flat = normalize_source_segments(edits_flat["sourceSegments"], sources)
    wins_flat = source_windows(edits_flat, 10_000, 32_000)
    assert wins_flat
    _, fc_flat, vlabel_flat, _ = build_sources_filtergraph(
        wins_flat,
        [ang_mp4],
        640,
        480,
        30.0,
        main_has_audio=False,
        source_has_audio=[True],
        edits=edits_flat,
        media=media,
    )
    flat_png = tmp_path / "flat.png"
    _ffmpeg(
        "-i",
        str(full_render),
        *extra_inputs,
        "-filter_complex",
        fc_flat,
        "-map",
        f"[{vlabel_flat}]",
        "-ss",
        "15",
        "-frames:v",
        "1",
        str(flat_png),
    )
    raw_flat = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(flat_png),
            "-vf",
            "scale=640:480",
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ],
    )
    flat_left_luma = 0.299 * _channel_mean(raw_flat, width, height, 0, mid, 0) + 0.587 * _channel_mean(
        raw_flat, width, height, 0, mid, 1
    ) + 0.114 * _channel_mean(raw_flat, width, height, 0, mid, 2)
    flat_right_luma = 0.299 * _channel_mean(raw_flat, width, height, mid, width, 0) + 0.587 * _channel_mean(
        raw_flat, width, height, mid, width, 1
    ) + 0.114 * _channel_mean(raw_flat, width, height, mid, width, 2)

    assert left_b > left_r + 40, f"left pane not blue: r={left_r:.1f} b={left_b:.1f}"
    assert right_r > right_b + 40, f"right pane not red: r={right_r:.1f} b={right_b:.1f}"
    assert abs(flat_left_luma - flat_right_luma) < 8, "baseline should be uniform single angle"
    assert abs(left_luma - right_luma) > 25, (
        f"layout halves should differ: left_luma={left_luma:.1f} right_luma={right_luma:.1f} "
        f"flat={flat_left_luma:.1f}/{flat_right_luma:.1f}"
    )
    print(f"FIX3 left_luma={left_luma:.2f} right_luma={right_luma:.2f} flat_luma={flat_left_luma:.2f}")
