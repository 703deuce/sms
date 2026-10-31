"""E5 export on real ffmpeg (prod is 5.1: run with PATH=/path/to/ffmpeg-5.1:$PATH as well).

* mixed resolutions / fps: 1280×720@25 and 480×640@24 sources composited onto a 9:16 270×480@30
  render → output keeps the base size / fps / duration; cover fills edge-to-edge, contain pads.
* image stills hold for their span; frames outside the span are the main video.
* audio: 'source' mutes main and plays the clip's own sound, 'mix' sums, 'main' keeps main only.
* synced angle media time: mediaIn = main ms + syncMs.
* MEDIA_SYNC audio sync (reused streamer aligner): recovers a known offset within ±1 frame.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

from clips_worker.media_sources import apply_full_render_sources, has_audio_stream, still_to_video
from clips_worker.media_sync_job import estimate_sync_ms

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")

W, H, FPS = 270, 480, 30


def run(cmd):
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def solid(path: Path, color: str, w: int, h: int, fps: int, seconds: float, freq: int | None) -> None:
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={color}:s={w}x{h}:r={fps}:d={seconds}"]
    if freq:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency={freq}:sample_rate=48000:d={seconds}"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "10"]
    cmd += (["-c:a", "aac", "-shortest"] if freq else ["-an"])
    run(cmd + [str(path)])


def probe(path: Path, entries: str, stream: str = "v:0") -> str:
    return subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", stream, "-show_entries", entries,
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)], text=True).strip()


def duration(path: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(path)], text=True).strip())


def frame(path: Path, t: float) -> np.ndarray:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(float)


def tone_level(path: Path, t0: float, t1: float, freq: float) -> float:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0:.3f}", "-i", str(path),
                                   "-ac", "1", "-ar", "16000", "-f", "s16le", "-"])
    x = np.frombuffer(raw, np.int16).astype(float) / 32768.0
    if len(x) < 400:
        return 0.0
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    f = np.fft.rfftfreq(len(x), 1 / 16000)
    band = (f > freq - 15) & (f < freq + 15)
    return float(spec[band].max() / (len(x) / 2))


@pytest.fixture()
def media(tmp_path: Path):
    base = tmp_path / "full_render.mp4"
    solid(base, "red", W, H, FPS, 4.0, 440)  # main: red picture, 440 Hz voice
    wide = tmp_path / "wide.mp4"
    solid(wide, "blue", 1280, 720, 25, 5.0, 1000)  # landscape 25 fps upload with its own 1 kHz sound
    tall = tmp_path / "tall.mp4"
    solid(tall, "green", 480, 640, 24, 5.0, None)  # 3:4 24 fps silent angle
    img = tmp_path / "still.png"
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=yellow:s=300x200", "-frames:v", "1", str(img)])
    return tmp_path, base, {"upl_w": wide, "trk_t": tall, "upl_i": img}


SOURCES = [
    {"id": "upl_w", "ref": "upload", "refId": "upl_w", "mediaType": "video"},
    {"id": "trk_t", "ref": "take", "refId": "trk_t", "mediaType": "video", "syncMs": -10_200},
    {"id": "upl_i", "ref": "upload", "refId": "upl_i", "mediaType": "image"},
]


def is_color(px: np.ndarray, rgb: tuple[int, int, int], tol: float = 40) -> bool:
    return bool(np.abs(px - np.array(rgb)).max() <= tol)


def test_mixed_resolutions_fps_stills_and_audio(media):
    work, base, paths = media
    clip_start = 10_000  # full_render t=0 is main source 10 000 ms
    edits = {
        "sources": SOURCES,
        "sourceSegments": [
            {"id": "a", "sourceId": "upl_w", "startMs": 10_500, "endMs": 11_500, "inMs": 0, "audio": "source"},
            {"id": "b", "sourceId": "trk_t", "startMs": 12_000, "endMs": 12_800, "fit": "contain"},
            {"id": "c", "sourceId": "upl_i", "startMs": 13_000, "endMs": 13_600},
        ],
    }
    out = apply_full_render_sources(base, edits, clip_start, clip_start + 4000, work, paths)
    assert out != base
    assert probe(out, "stream=width") == str(W) and probe(out, "stream=height") == str(H)
    assert probe(out, "stream=r_frame_rate") == "30/1"
    assert abs(duration(out) - 4.0) < 0.1
    assert has_audio_stream(out)
    # Main outside every span, cover-filled upload (edge to edge), still, contain-padded angle.
    assert is_color(frame(out, 0.2)[H // 2, W // 2], (255, 0, 0))
    f = frame(out, 1.0)
    assert is_color(f[H // 2, W // 2], (0, 0, 255)) and is_color(f[4, 4], (0, 0, 255))
    g = frame(out, 2.4)
    assert is_color(g[H // 2, W // 2], (0, 128, 0), 60)
    assert g[4, W // 2].max() < 30  # black pad above the 3:4 angle in a 9:16 frame
    assert is_color(frame(out, 3.3)[H // 2, W // 2], (255, 255, 0))
    assert is_color(frame(out, 3.8)[H // 2, W // 2], (255, 0, 0))
    # Audio: 'source' span = upload's 1 kHz, main 440 Hz muted; elsewhere main only.
    assert tone_level(out, 0.6, 1.4, 1000) > 0.02
    assert tone_level(out, 0.6, 1.4, 440) < 0.005
    assert tone_level(out, 2.1, 2.7, 440) > 0.02  # synced angle keeps the main sound
    assert tone_level(out, 2.1, 2.7, 1000) < 0.005


def test_mix_audio_and_switch_frame_accuracy(media):
    work, base, paths = media
    edits = {"sources": SOURCES, "sourceSegments": [
        {"id": "a", "sourceId": "upl_w", "startMs": 1000, "endMs": 2000, "inMs": 500, "audio": "mix"}]}
    out = apply_full_render_sources(base, edits, 0, 4000, work, paths)
    assert tone_level(out, 1.2, 1.8, 1000) > 0.02 and tone_level(out, 1.2, 1.8, 440) > 0.02
    # Switch lands on the frame boundary (±1 frame at 30 fps).
    assert is_color(frame(out, 1.0 - 1.5 / FPS)[H // 2, W // 2], (255, 0, 0))
    assert is_color(frame(out, 1.0 + 1.5 / FPS)[H // 2, W // 2], (0, 0, 255))
    assert is_color(frame(out, 2.0 + 1.5 / FPS)[H // 2, W // 2], (255, 0, 0))


def test_no_segments_is_passthrough(media):
    work, base, paths = media
    assert apply_full_render_sources(base, {}, 0, 4000, work, paths) == base
    assert apply_full_render_sources(base, {"sources": SOURCES, "sourceSegments": [
        {"id": "a", "sourceId": "upl_w", "startMs": 9000, "endMs": 9500}]}, 0, 4000, work, paths) == base


def test_still_to_video_even_size(media):
    work, _, paths = media
    out = still_to_video(paths["upl_i"], work / "s.mp4", 1.0)
    assert probe(out, "stream=width") == "300" and abs(duration(out) - 1.0) < 0.1


def test_audio_sync_recovers_offset(tmp_path: Path):
    rng = np.random.default_rng(7)
    sr = 48000
    total = 30.0
    # Speech-like: random bursts of band noise.
    sig = np.zeros(int(sr * total))
    t = 0.0
    while t < total - 0.5:
        n = int(sr * rng.uniform(0.15, 0.5))
        i = int(t * sr)
        sig[i:i + n] = rng.normal(0, 0.3, n)[: len(sig) - i]
        t += rng.uniform(0.3, 0.9)
    offset_s = 1.237  # the angle started 1.237 s before the main camera → angle ms = main ms + 1237

    def write(path: Path, x: np.ndarray):
        pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
        raw = path.with_suffix(".raw")
        raw.write_bytes(pcm)
        run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", str(raw), "-c:a", "aac", str(path)])

    main = tmp_path / "main.m4a"
    angle = tmp_path / "angle.m4a"
    write(main, sig[int(offset_s * sr):])
    write(angle, 0.6 * sig + rng.normal(0, 0.02, len(sig)))
    sync_ms, conf, ratio = estimate_sync_ms(main, angle)
    assert abs(sync_ms - 1237) <= 34, sync_ms
    assert conf >= 0.6 and ratio >= 1.5


class _NoDb:
    def cursor(self):  # uploads never touch the DB here (paths come from load_media_assets)
        raise AssertionError("unexpected query")


def _stub_storage(monkeypatch):
    """Partial checkouts lack boto3; uploads never download here (paths are pre-resolved)."""
    import sys
    import types

    try:
        import clips_worker.storage  # noqa: F401
    except ImportError:
        mod = types.ModuleType("clips_worker.storage")
        mod.download_object = lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("no download"))
        mod.upload_file = mod.download_object
        monkeypatch.setitem(sys.modules, "clips_worker.storage", mod)


def test_upload_broll_and_audio_specs(media, monkeypatch):
    work, _, paths = media
    _stub_storage(monkeypatch)
    from clips_worker.broll_render import load_broll_specs

    edits = {"broll": [
        {"id": "b1", "source": "upload", "uploadId": "upl_w", "startMs": 500, "endMs": 1500, "inMs": 250},
        {"id": "b2", "source": "upload", "uploadId": "upl_i", "still": True, "startMs": 2000, "endMs": 3000},
        {"id": "b3", "source": "upload", "uploadId": "upl_missing", "startMs": 0, "endMs": 1000},
    ]}
    specs = load_broll_specs(_NoDb(), edits, work, media=paths)
    assert [s["id"] for s in specs] == ["b1", "b2"]
    assert specs[0]["local_path"] == paths["upl_w"] and specs[0]["in_s"] == 0.25
    assert specs[1]["local_path"].suffix == ".mp4" and specs[1]["in_s"] == 0.0
    assert abs(duration(specs[1]["local_path"]) - 1.2) < 0.1
    from clips_worker.audio_assets import load_audio_assets

    got = load_audio_assets(_NoDb(), {"audio": {"music": {"generationId": "upl_w", "uploadId": "upl_w", "startMs": 100},
                                                "sfx": [{"generationId": "upl_w", "uploadId": "upl_w", "atMs": 700}]}},
                            work, media=paths)
    assert got["music_path"] == paths["upl_w"] and got["music_meta"]["startMs"] == 100
    assert got["sfx_paths"] == [(paths["upl_w"], 700, 0.8)]
