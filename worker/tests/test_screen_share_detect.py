import cv2
import numpy as np

from clips_worker.compose_layout import layout_slots
from clips_worker.screen_share_detect import (
    classify_screen_share_from_samples,
    face_in_corner_norm,
)


def _text_like_screen(h: int, w: int) -> np.ndarray:
    g = np.zeros((h, w), np.uint8)
    for y in range(0, h, 6):
        g[y : y + 2, 10 : w - 10] = 220
    return g


def test_face_corner_detection():
    assert face_in_corner_norm(0.1, 0.1) == "tl"
    assert face_in_corner_norm(0.9, 0.85) == "br"
    assert face_in_corner_norm(0.5, 0.5) is None


def test_screen_share_positive_with_corner_face():
    static = [_text_like_screen(90, 160) for _ in range(6)]
    verdict = classify_screen_share_from_samples(static, face_cx_norm=0.92, face_cy_norm=0.88)
    assert verdict.is_screen_share
    assert verdict.face_corner == "br"
    assert verdict.confidence >= 0.55


def test_screen_share_negative_high_motion():
    frames = []
    rng = np.random.default_rng(0)
    for i in range(6):
        f = _text_like_screen(90, 160)
        f = np.roll(f, i * 24, axis=1)
        noise = rng.integers(0, 255, size=f.shape, dtype=np.uint8)
        f = cv2.add(f, noise)
        frames.append(f)
    verdict = classify_screen_share_from_samples(frames, face_cx_norm=0.9, face_cy_norm=0.9)
    assert not verdict.is_screen_share


def test_pip_layout_slots_match_guide():
    slots = layout_slots("screen_pip", 1080, 1920, 2)
    assert slots[0] == (0, 0, 1080, 1920)
    bw = 1080 // 3 // 2 * 2
    bh = int(bw * 4 / 3) // 2 * 2
    m = 1080 // 24 // 2 * 2
    assert slots[1] == (1080 - bw - m, 1920 - bh - int(1920 * 0.22), bw, bh)


def test_screen_share_route_gated_off(monkeypatch, tmp_path):
    monkeypatch.delenv("REFRAME_V2_ENABLED", raising=False)
    from clips_worker.screen_share_route import apply_screen_share_env

    p = tmp_path / "v.mp4"
    p.write_bytes(b"")
    env, shadow = apply_screen_share_env(p)
    assert env == {}
    assert shadow["screenShareProbe"] is False
