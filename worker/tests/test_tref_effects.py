"""TREF batch 2 effects parity (fixture from vitest WRITE_TREF_EFFECTS=1)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "tref_effects.json"


@pytest.fixture(scope="module")
def fx() -> dict:
    assert FIXTURE.is_file(), "run WRITE_TREF_EFFECTS=1 npx vitest run tref-effects first"
    return json.loads(FIXTURE.read_text())


def test_tone_fixture(fx: dict) -> None:
    from clips_worker.color_grade import tone_extras

    for row in fx["tone"]:
        y = row["y"]
        assert tone_extras(y, 1, 0, 0) == pytest.approx(row["w100"], abs=1e-7)
        assert tone_extras(y, 0, 1, 0) == pytest.approx(row["b100"], abs=1e-7)
        assert tone_extras(y, 0, 0, 0.5) == pytest.approx(row["fade50"], abs=1e-7)


def test_pixelate_block(fx: dict) -> None:
    from clips_worker.fx_library import pixelate_block

    for row in fx["pixel"]:
        assert pixelate_block(row["v"], row["w"], row["h"]) == row["b"]


def test_mask_heart_star(fx: dict) -> None:
    from clips_worker.layer_fx import mask_alpha

    g = {"x": 50, "y": 50, "w": 80, "h": 80, "rot": 0, "feather": 0}
    heart = mask_alpha("heart", g, False, 64, 36).flatten().tolist()
    star = mask_alpha("star", g, False, 64, 36).flatten().tolist()
    assert heart == fx["maskHeart"]
    assert star == fx["maskStar"]
    assert heart[heart.index(max(heart))] == 255


def test_adjust_keeps_hsl_lut(fx: dict) -> None:
    from clips_worker.adjust_layers import normalize_adjust_layers

    layers = normalize_adjust_layers(
        [{"id": "a1", "startMs": 0, "endMs": 2000, "spec": fx["adjustKeepsHslLut"]}]
    )
    assert layers[0]["spec"].get("hsl")
    assert layers[0]["spec"].get("lut")


def test_used_lut_ids_adjust_layer() -> None:
    from clips_worker.user_luts import used_lut_ids

    ids = used_lut_ids(
        {
            "adjustLayers": [
                {"id": "a1", "startMs": 0, "endMs": 1000, "spec": {"lut": {"id": "lut_adj"}}},
            ]
        }
    )
    assert ids == ["lut_adj"]


def test_pre_parts_pixelate() -> None:
    from clips_worker.fx_library import pixelate_block, pre_parts

    w, h = 1920, 1080
    b = pixelate_block(50, w, h)
    parts, cur = pre_parts("v0", {"pixelate": 50}, w, h, "t", "")
    assert cur == "tpx"
    assert len(parts) == 1
    assert "neighbor" in parts[0]
    assert f"crop={w}:{h}" in parts[0]
    assert str(b) in parts[0]
