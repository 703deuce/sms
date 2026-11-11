from pathlib import Path

from clips_worker.media_sources import build_sources_filtergraph, normalize_media_sources, normalize_source_segments

GOLDEN_NO_LAYOUT = (
    "[0:v]setsar=1,format=yuv420p[vb0];"
    "[1:v]trim=0:1.000,setpts=PTS-STARTPTS,fps=30,"
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,format=yuv420p,"
    "setpts=PTS-STARTPTS+0.000/TB[s0];"
    "[vb0][s0]overlay=eof_action=pass:enable='between(t,0.000,1.000)'[vb1]"
)


def _base_window(**patch):
    w = {
        "id": "a",
        "sourceId": "ang1",
        "t0Ms": 0,
        "t1Ms": 1000,
        "mediaInMs": 0,
        "audio": "main",
        "fit": "cover",
        "mediaType": "video",
    }
    w.update(patch)
    return w


def test_no_layout_filtergraph_unchanged():
    windows = [_base_window()]
    paths = [Path("/tmp/primary.mp4")]
    inputs, fc, vlabel, _ = build_sources_filtergraph(
        windows,
        paths,
        1920,
        1080,
        30.0,
        main_has_audio=False,
        source_has_audio=[True],
    )
    assert fc == GOLDEN_NO_LAYOUT
    assert vlabel == "vb1"
    assert inputs[0:2] == ["-ss", "0.000"]


def test_explicit_unit_speed_preserves_legacy_filtergraph():
    _, fc, _, _ = build_sources_filtergraph(
        [_base_window(speed=1.0)],
        [Path('/tmp/primary.mp4')],
        1920, 1080, 30.0,
        main_has_audio=False,
        source_has_audio=[True],
    )
    assert fc == GOLDEN_NO_LAYOUT


def test_non_unit_speed_applies_time_warp():
    _, fc, _, _ = build_sources_filtergraph(
        [_base_window(speed=1.5)],
        [Path('/tmp/primary.mp4')],
        1920, 1080, 30.0,
        main_has_audio=False,
        source_has_audio=[True],
    )
    assert 'setpts=(PTS-STARTPTS)/1.500000' in fc


def test_side_by_side_contains_hstack():
    edits = {
        "sources": [
            {"id": "ang1", "ref": "upload", "refId": "u1", "mediaType": "video", "syncMs": 0},
            {"id": "ang2", "ref": "upload", "refId": "u2", "mediaType": "video", "syncMs": 0},
        ],
        "sourceSegments": [
            {
                "id": "seg1",
                "sourceId": "ang1",
                "startMs": 0,
                "endMs": 2000,
                "layout": {"kind": "side_by_side", "withSourceId": "ang2", "split": 0.5},
            }
        ],
    }
    sources = normalize_media_sources(edits["sources"])
    segs = normalize_source_segments(edits["sourceSegments"], sources)
    assert segs and segs[0].get("layout")
    w = _base_window(layout=segs[0]["layout"], windowStartMs=0, segment=segs[0])
    media = {"u1": Path("/tmp/a.mp4"), "u2": Path("/tmp/b.mp4")}
    _, fc, _, _ = build_sources_filtergraph(
        [w],
        [Path("/tmp/a.mp4")],
        1920,
        1080,
        30.0,
        main_has_audio=False,
        source_has_audio=[True],
        edits=edits,
        media=media,
    )
    assert "hstack=inputs=2" in fc


def test_invalid_layout_dropped():
    sources = normalize_media_sources(
        [{"id": "a1", "ref": "upload", "refId": "u1", "mediaType": "video", "syncMs": 0}]
    )
    segs = normalize_source_segments(
        [{"id": "s1", "sourceId": "a1", "startMs": 0, "endMs": 1000, "layout": {"kind": "pip", "withSourceId": "a1"}}],
        sources,
    )
    assert segs and "layout" not in segs[0]


def test_pip_contains_overlay_corner():
    edits = {
        "sources": [{"id": "ang1", "ref": "upload", "refId": "u1", "mediaType": "video", "syncMs": 0}],
        "sourceSegments": [
            {
                "id": "seg1",
                "sourceId": "ang1",
                "startMs": 0,
                "endMs": 2000,
                "layout": {"kind": "pip", "withSourceId": "main", "pipCorner": "BR", "pipScale": 0.3},
            }
        ],
    }
    sources = normalize_media_sources(edits["sources"])
    segs = normalize_source_segments(edits["sourceSegments"], sources)
    w = _base_window(layout=segs[0]["layout"], windowStartMs=0, segment=segs[0])
    _, fc, _, _ = build_sources_filtergraph(
        [w],
        [Path("/tmp/a.mp4")],
        1920,
        1080,
        30.0,
        main_has_audio=False,
        source_has_audio=[True],
        edits=edits,
        media={"u1": Path("/tmp/a.mp4")},
    )
    assert "overlay=x=" in fc and "main_w-overlay_w" in fc
