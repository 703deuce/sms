from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.audio_render import apply_audio_mix
from clips_worker.blank_project import make_template_carrier
from clips_worker.byo_clip_job import template_project_canceled
from clips_worker.media_sources import apply_full_render_sources, source_transition_boundaries
from clips_worker.motion_render import apply_motion_after_cut
from clips_worker.text_items import apply_text_items, text_items_ass


FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")


def run(args: list[str]) -> str:
    proc = subprocess.run(args, capture_output=True, text=True, check=False)
    if proc.returncode:
        raise RuntimeError((proc.stderr or proc.stdout or "")[-2000:])
    return (proc.stdout or "").strip()


def frames(path: Path) -> int:
    return int(run([
        FFPROBE, "-v", "error", "-select_streams", "v:0", "-count_frames",
        "-show_entries", "stream=nb_read_frames",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ]))


def duration(path: Path) -> float:
    return float(run([
        FFPROBE, "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ]))


def center_rgb(path: Path, at_s: float) -> tuple[int, int, int]:
    raw = subprocess.run([
        FFMPEG, "-v", "error", "-ss", f"{at_s:.3f}", "-i", str(path),
        "-vf", "crop=2:2:(iw-2)/2:(ih-2)/2,scale=1:1",
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ], capture_output=True, check=True).stdout
    return tuple(raw[:3])


@pytest.mark.skipif(not FFMPEG or not FFPROBE, reason="ffmpeg/ffprobe required")
def test_template_worker_sequence_keeps_slots_text_music_and_exact_frames(tmp_path: Path) -> None:
    carrier = tmp_path / "carrier.mp4"
    make_template_carrier(carrier, "16:9", 90)

    photo = tmp_path / "photo.png"
    run([FFMPEG, "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=160x90",
         "-frames:v", "1", str(photo)])

    video = tmp_path / "video.mp4"
    run([
        FFMPEG, "-y", "-v", "error",
        "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=30:d=2",
        "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=2",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(video),
    ])
    music = tmp_path / "music.m4a"
    run([FFMPEG, "-y", "-v", "error", "-f", "lavfi", "-i",
         "sine=frequency=440:sample_rate=48000:duration=1", "-c:a", "aac", str(music)])

    edits = {
        "v": 2,
        "trim": {"in": 0, "out": 3000},
        "cutRanges": [],
        "wordFixes": {},
        "captions": {"enabled": False},
        "layout": {"mode": "full_frame", "shotOverrides": []},
        "sources": [
            {"id": "src_photo", "ref": "upload", "refId": "photo_asset", "mediaType": "image"},
            {"id": "src_video", "ref": "upload", "refId": "video_asset", "mediaType": "video", "durationMs": 2000},
        ],
        "sourceSegments": [
            {
                "id": "slot_1", "sourceId": "src_photo", "startMs": 0, "endMs": 1000,
                "fit": "cover", "transform": {"scale": 110}, "fx": {"saturation": -10},
            },
            {
                "id": "slot_2", "sourceId": "src_video", "startMs": 1000, "endMs": 2000,
                "inMs": 300, "audio": "source", "fit": "cover", "speed": 1.5,
                "transform": {"x": 4, "scale": 105}, "fx": {"brightness": 5},
            },
            {
                "id": "slot_3", "sourceId": "src_photo", "startMs": 2000, "endMs": 3000,
                "fit": "contain",
            },
        ],
        "videoSplits": [1000, 2000],
        "transitions": [{"srcMs": 1000, "type": "crossfade", "durMs": 400}],
        "templateProvenance": {
            "v": 1, "instanceId": "instance_a", "familyId": "family_a", "familyRevision": 1,
            "designId": "design_a", "designRevision": 1,
            "slotToItemIds": {"one": "slot_1", "two": "slot_2", "three": "slot_3"},
        },
        "keyframes": [
            {"target": "source:slot_2", "prop": "x", "points": [
                {"tMs": 0, "v": -8, "ease": "inOut"}, {"tMs": 967, "v": 8},
            ]},
            {"target": "source:slot_2", "prop": "scale", "points": [
                {"tMs": 0, "v": 92, "ease": "out"}, {"tMs": 967, "v": 108},
            ]},
            {"target": "text:title_all", "prop": "x", "points": [
                {"tMs": 0, "v": -4, "ease": "inOut"}, {"tMs": 2967, "v": 4},
            ]},
        ],
        "textItems": [
            {
                "id": "title_all", "text": "TEXT THROUGH EVERY SLOT", "startMs": 0, "endMs": 3000,
                "x": 50, "y": 18,
                "style": {"font": "Montserrat", "size": 72, "color": "#FFFFFF", "align": "center", "case": "none"},
                "anim": {
                    "in": {"type": "fade", "unit": "block", "durMs": 200},
                    "out": {"type": "fade", "unit": "block", "durMs": 200},
                },
            },
            {
                "id": "graphic_all", "text": "", "kind": "shape", "shape": {"type": "rounded", "w": 80, "h": 12},
                "startMs": 0, "endMs": 3000, "x": 50, "y": 82,
                "style": {"font": "Montserrat", "size": 24, "color": "#FFD166", "align": "center", "case": "none"},
                "anim": {"in": {"type": "pop", "unit": "block", "durMs": 200}},
            },
        ],
        "audio": {
            "music": {
                "generationId": "music_asset", "uploadId": "music_asset",
                "startMs": 0, "endMs": 3000, "loop": True,
            },
            "sfx": [],
        },
    }
    assert source_transition_boundaries(edits) == {1000}

    sourced = apply_full_render_sources(
        carrier, edits, 0, 3000, tmp_path,
        {"photo_asset": photo, "video_asset": video, "music_asset": music},
    )
    assert frames(sourced) == 90
    assert duration(sourced) == pytest.approx(3.0, abs=0.04)
    red = center_rgb(sourced, 0.45)
    blue = center_rgb(sourced, 1.50)
    red_again = center_rgb(sourced, 2.55)
    assert red[0] > red[2] + 80
    assert blue[2] > blue[0] + 80
    assert red_again[0] > red_again[2] + 80

    # Source-item keyframes were already consumed inside source composition / A-B transition sides.
    # Keep one ordinary main-video pass in the fixture to prove shared motion remains compatible.
    moved = apply_motion_after_cut(
        sourced, sourced, {**edits, "keyframes": [], "transitions": None}, [(0, 3000)], 0, tmp_path, {},
    )
    assert frames(moved) == 90

    ass = text_items_ass(edits, w=160, h=90)
    assert "TEXT THROUGH EVERY SLOT" in ass
    assert "0:00:03.00" in ass
    assert "graphic_all" not in ass  # IDs are metadata; the rendered ASS contains the shape drawing, not opaque item ids.
    assert "\\p1" in ass or "m " in ass
    texted = tmp_path / "texted.mp4"
    apply_text_items(moved, texted, edits, play_w=160, play_h=90)
    assert frames(texted) == 90

    mixed = tmp_path / "mixed.mp4"
    apply_audio_mix(
        texted, mixed, music, [],
        length_s=3.0,
        volume=0.4,
        duck_depth=0.0,
        fade_in_s=0.0,
        fade_out_s=0.0,
        music_window={"startMs": 0, "endMs": 3000, "inMs": 0},
        music_loop=True,
    )
    assert frames(mixed) == 90
    assert abs(duration(mixed) - 3.0) <= (1 / 30) + 0.002
    streams = json.loads(run([
        FFPROBE, "-v", "error", "-show_streams", "-of", "json", str(mixed),
    ]))["streams"]
    assert {stream["codec_type"] for stream in streams} == {"video", "audio"}
    silence = subprocess.run([
        FFMPEG, "-v", "info", "-i", str(mixed), "-af", "silencedetect=n=-45dB:d=0.35",
        "-f", "null", "-",
    ], capture_output=True, text=True, check=True).stderr
    assert "silence_start" not in silence


@pytest.mark.skipif(not FFMPEG or not FFPROBE, reason="ffmpeg/ffprobe required")
def test_template_carrier_is_exact_for_non_integer_second_frame_budget(tmp_path: Path) -> None:
    carrier = tmp_path / "carrier_73.mp4"
    make_template_carrier(carrier, "9:16", 73)
    assert frames(carrier) == 73
    assert abs(duration(carrier) - (73 / 30)) <= (1 / 30) + 0.002

    photo = tmp_path / "photo_73.png"
    run([FFMPEG, "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=green:s=90x160",
         "-frames:v", "1", str(photo)])
    end_ms = round(73 * 1000 / 30)
    edits = {
        "sources": [{"id": "src", "ref": "upload", "refId": "photo73", "mediaType": "image"}],
        "sourceSegments": [{"id": "slot", "sourceId": "src", "startMs": 0, "endMs": end_ms, "fit": "cover"}],
    }
    sourced = apply_full_render_sources(carrier, edits, 0, end_ms, tmp_path, {"photo73": photo})
    assert frames(sourced) == 73


class _StatusCursor:
    def __init__(self, status: str | None):
        self.status = status
    def __enter__(self):
        return self
    def __exit__(self, *_args):
        return False
    def execute(self, _sql, _params):
        return None
    def fetchone(self):
        return None if self.status is None else (self.status,)


class _StatusConn:
    def __init__(self, status: str | None):
        self.status = status
    def cursor(self):
        return _StatusCursor(self.status)


def test_template_carrier_cancellation_guard_is_fail_closed() -> None:
    assert template_project_canceled(_StatusConn("CANCELED"), "project_a") is True
    assert template_project_canceled(_StatusConn("READY"), "project_a") is False
    assert template_project_canceled(_StatusConn(None), "missing_project") is True
