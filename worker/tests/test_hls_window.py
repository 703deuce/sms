from pathlib import Path

import pytest

from clips_worker.streamer.hls_window import (
    RetryableError,
    fetch_window,
    parse_media_playlist,
    select_segments,
)


FIXTURE = """#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:10.000,
seg0.ts
#EXTINF:10.010,
seg1-muted.ts
#EXT-X-DISCONTINUITY
#EXTINF:4.200,
seg2.ts
"""


def test_parse_media_playlist_cumulative_ms():
    segs = parse_media_playlist(FIXTURE, "https://example.com/v.m3u8")
    assert [s.start_ms for s in segs] == [0, 10000, 20010]
    assert [s.dur_ms for s in segs] == [10000, 10010, 4200]


def test_select_segments_grid():
    segs = parse_media_playlist(FIXTURE, "https://example.com/v.m3u8")
    # extend fixture mentally: start at 4664000 on 10s grid -> k0 at 4660000
    grid = []
    cum = 4660000
    for i in range(30):
        grid.append(type(segs[0])(idx=i, uri=f"u{i}", start_ms=cum, dur_ms=10000))
        cum += 10000
    k0, k1 = select_segments(grid, 4664000, 4844000)
    assert grid[k0].start_ms == 4660000
    k0b, k1b = select_segments(grid, 4670000, 4675000)
    assert grid[k0b].start_ms == 4670000



def test_fetch_window_duration_guard(tmp_path, monkeypatch):
    segs = parse_media_playlist(FIXTURE, "https://x/v.m3u8")

    def fake_dl(uri, path):
        Path(path).write_bytes(b"\x00" * 100)

    monkeypatch.setattr("subprocess.check_call", lambda *a, **k: None)
    monkeypatch.setattr(
        "clips_worker.streamer.hls_window._ffprobe_duration_ms",
        lambda _p: 999999,
    )
    with pytest.raises(RetryableError):
        fetch_window(
            "https://x/v.m3u8",
            0,
            15000,
            tmp_path / "out.ts",
            segs=segs,
            download_segment_fn=fake_dl,
        )
