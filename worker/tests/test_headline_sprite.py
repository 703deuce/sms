from __future__ import annotations

import tempfile
from pathlib import Path

from PIL import Image

from clips_worker.layer_sprites import (
    headline_box_overlay_x,
    headline_drawbox_filter,
    render_headline_box_png,
)


def test_headline_sprite_transparent_corners():
    with tempfile.TemporaryDirectory() as td:
        dest = Path(td) / "box.png"
        render_headline_box_png(120, 80, "#FFFFFF", 16, dest)
        im = Image.open(dest).convert("RGBA")
        assert im.getpixel((0, 0))[3] == 0


def test_headline_overlay_x_at_80pct():
    assert headline_box_overlay_x(1080, 80) == 108


def test_default_headline_drawbox():
    flt = headline_drawbox_filter(1080, 0, 200, "white", {"widthPct": 100, "radiusPx": 0})
    assert "drawbox=x=0" in flt
