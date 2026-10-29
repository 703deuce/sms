"""Unit tests for v3 layer PNG sprites."""
from __future__ import annotations

from pathlib import Path

from clips_worker.layer_sprites import render_badge_png, render_sticker_png


def test_render_badge_png(tmp_path: Path) -> None:
    dest = tmp_path / "badge.png"
    render_badge_png(
        {
            "id": "badge",
            "platform": "twitch",
            "showLabel": True,
            "showLogo": False,
            "handle": "streamer",
        },
        dest,
        play_w=1080,
        play_h=1920,
        placement="export_bar",
        video_y=384,
        video_h=998,
    )
    assert dest.stat().st_size > 100


def test_render_sticker_png(tmp_path: Path) -> None:
    dest = tmp_path / "sticker.png"
    render_sticker_png(
        {"id": "st1", "kind": "follow_cta", "text": "FOLLOW", "platform": "kick"},
        dest,
        play_w=1080,
        play_h=1920,
    )
    assert dest.stat().st_size > 100
