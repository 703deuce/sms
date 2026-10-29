from __future__ import annotations

import tempfile
from pathlib import Path

from clips_worker.streamer.layout.stream_frame import fit_top_headline_band_filters


def test_fit_top_headline_band_uses_png_overlay_when_radius():
    lay = {"headline_top": 150}
    with tempfile.TemporaryDirectory() as td:
        flt = fit_top_headline_band_filters(
            lay=lay,
            play_w=1080,
            h_box=320,
            box_color="#FFFFFF",
            headline_style={"radiusPx": 16, "widthPct": 100, "boxColor": "#FFFFFF"},
            work_dir=Path(td),
        )
        assert "movie=" in flt
        assert "overlay=x=0:y=150" in flt
        assert "drawbox" not in flt
        assert (Path(td) / "fit_top_headline_box.png").is_file()


def test_fit_top_headline_band_drawbox_when_square_full_width():
    lay = {"headline_top": 150}
    with tempfile.TemporaryDirectory() as td:
        flt = fit_top_headline_band_filters(
            lay=lay,
            play_w=1080,
            h_box=320,
            box_color="white",
            headline_style={"radiusPx": 0, "widthPct": 100},
            work_dir=Path(td),
        )
        assert "drawbox=x=0:y=150" in flt
        assert "movie=" not in flt
