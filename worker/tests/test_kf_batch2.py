"""KF batch 2: chroma keyframes + caption motion parity with TS."""
from __future__ import annotations

from clips_worker.caption_kf import caption_ass_motion_tags, caption_motion_at
from clips_worker.layer_fx import chroma_key_at, DEFAULT_KEY


def test_chroma_key_at_interpolates():
    key = {
        **DEFAULT_KEY,
        "sim": 30,
        "keys": [
            {"ms": 0, "sim": 40, "blend": 10, "spill": 50},
            {"ms": 1000, "sim": 80, "blend": 20, "spill": 60},
        ],
    }
    assert chroma_key_at(key, 0)["sim"] == 40
    assert chroma_key_at(key, 500)["sim"] == 60
    assert chroma_key_at(key, 1000)["blend"] == 20
    assert chroma_key_at(key, 5000)["sim"] == 80


def test_caption_motion_at_and_ass_tags():
    edits = {
        "keyframes": [
            {"target": "captions", "prop": "capX", "points": [{"tMs": 0, "v": 0}, {"tMs": 2000, "v": 10}]},
            {"target": "captions", "prop": "capScale", "value": 120},
        ]
    }
    m = caption_motion_at(edits, 1000)
    assert abs(m["xPct"] - 5.0) < 1e-6
    assert m["scalePct"] == 120.0
    tags = caption_ass_motion_tags(m, 1080, 1920, 2, 120)
    assert "\\pos(" in tags
    assert "\\fscx120" in tags
