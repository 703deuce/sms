"""STREAMER_render_fix1: fit_top scale/crop + per-clip render resilience."""
from __future__ import annotations

import json
import shutil
import subprocess
from contextlib import ExitStack, contextmanager
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from clips_worker.streamer.layout.stream_frame import fit_top_fg_scale_crop_filter
from clips_worker.streamer.layout.stream_overlay_layout import PLAY_W, video_band_height
from clips_worker.streamer.render_job import mark_project_failed, run_stream_render_job


needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")
needs_ffprobe = pytest.mark.skipif(shutil.which("ffprobe") is None, reason="ffprobe missing")


def _run_ffmpeg(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _probe_wh(path: Path) -> tuple[int, int]:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    st = json.loads(out)["streams"][0]
    return int(st["width"]), int(st["height"])


@pytest.mark.parametrize("size", ["1280x720", "1920x1080", "640x360"])
@needs_ff
@needs_ffprobe
def test_fit_top_fg_scale_filter_synthetic_sources(tmp_path: Path, size: str) -> None:
    play_w = PLAY_W
    vid_h = video_band_height(play_w=play_w)
    vf = fit_top_fg_scale_crop_filter(play_w, vid_h)
    src = tmp_path / f"src_{size}.mp4"
    out = tmp_path / f"out_{size}.mp4"
    _run_ffmpeg(
        "-f",
        "lavfi",
        "-i",
        f"testsrc=size={size}:duration=2:rate=30",
        "-vf",
        vf,
        "-frames:v",
        "30",
        str(out),
    )
    w, h = _probe_wh(out)
    assert w == play_w
    assert h == vid_h


@contextmanager
def _null_ctx(*_a, **_k):
    yield


@contextmanager
def _fake_heartbeat(*_a, **_k):
    hb = MagicMock()
    hb.update = MagicMock()
    yield hb


def _clip_row(clip_id: str, start: int, end: int) -> dict:
    return {
        "id": clip_id,
        "startMs": start,
        "endMs": end,
        "score": 50,
        "previewKey": None,
        "edits": {"v": 2, "layout": {"mode": "fit_top"}},
        "aiMeta": {"streamer": {"vodRangeStartMs": 0}},
    }


def test_render_job_continues_after_one_clip_fails(tmp_path: Path) -> None:
    clips = [_clip_row("c1", 0, 12_000), _clip_row("c2", 15_000, 27_000), _clip_row("c3", 30_000, 42_000)]
    preview_keys: dict[str, str] = {}
    conn = MagicMock()

    def fake_cursor(*_a, **_k):
        cur = MagicMock()
        cur.__enter__ = lambda s: s
        cur.__exit__ = lambda *a: None
        cur.execute = MagicMock()
        cur.fetchone = MagicMock(return_value=None)
        cur.fetchall = MagicMock(return_value=[])
        return cur

    conn.cursor.side_effect = fake_cursor

    vod = {
        "id": "vod1",
        "workspaceId": "ws1",
        "project_id": "proj1",
        "platform": "upload",
        "uploadId": "up1",
        "url": None,
        "durationMs": 240_000,
        "rangeStartMs": 0,
        "transcriptKey": "t.json",
        "settings": {},
        "state": json.dumps({"localUploadKey": "upload/full.mp4", "audioKey": "audio.opus", "layout": {"layout": "fit_top"}}),
    }

    transcript_words = [{"w": "hi", "s": 0.0, "e": 1.0}]

    def write_seg(_clip, _state, *, seg_path, **_k):
        seg_path.parent.mkdir(parents=True, exist_ok=True)
        seg_path.write_bytes(b"\x00" * 64)

    def fake_cut(src: Path, dest: Path, *_a, **_k):
        dest.write_bytes(b"cut")

    def fake_render(clip_file: Path, out_mp4: Path, **kwargs):
        if kwargs.get("clip_id") == "c2":
            raise RuntimeError("Invalid too big or non positive size for width '720'")
        out_mp4.write_bytes(b"preview")

    ready_calls: list[str] = []

    patches = [
        patch("clips_worker.streamer.render_job._load_vod", return_value=vod),
        patch("clips_worker.streamer.render_job._clips_for_project", return_value=clips),
        patch("clips_worker.streamer.render_job.SCRATCH", tmp_path),
        patch("clips_worker.streamer.render_job.tempfile.TemporaryDirectory"),
        patch("clips_worker.streamer.render_job.download_object"),
        patch("clips_worker.streamer.render_job._fetch_segment_mp4", side_effect=write_seg),
        patch(
            "clips_worker.streamer.render_job._probe_file_duration_ms",
            side_effect=lambda p: 240_000 if "seg_" not in str(p) else 30_000,
        ),
        patch("clips_worker.streamer.render_job.apply_segment_align_policy", return_value=(0.0, False)),
        patch("clips_worker.streamer.render_job.upload_file"),
        patch("clips_worker.streamer.render_job._checkpoint_segment_key", side_effect=lambda _c, _v, s, *_a: s),
        patch("clips_worker.streamer.render_job.deepgram_api_key", return_value=None),
        patch("clips_worker.streamer.render_job.subprocess.check_call"),
        patch("clips_worker.streamer.render_job.ffmpeg_cut", side_effect=fake_cut),
        patch("clips_worker.streamer.render_job.poster_jpg"),
        patch("clips_worker.streamer.render_job.put_json"),
        patch("clips_worker.streamer.render_job.delete_clip_source_segment"),
        patch(
            "clips_worker.streamer.layout.stream_preview_render.render_stream_clip_preview",
            side_effect=fake_render,
        ),
        patch("clips_worker.streamer.render_job.mark_project_ready", side_effect=lambda _c, pid: ready_calls.append(pid)),
        patch("clips_worker.streamer.render_job.mark_project_failed"),
        patch("clips_worker.streamer.render_job.enqueue_stream_cleanup_job"),
        patch("clips_worker.streamer.notify.notify_event"),
        patch("clips_worker.streamer.render_job.Heartbeat", side_effect=_fake_heartbeat),
        patch("clips_worker.stage_log.stage_span", side_effect=lambda *_a, **_k: _null_ctx()),
        patch("clips_worker.stage_log.bind_stage_context"),
        patch("clips_worker.streamer.render_job.resolve_clip_window_media", return_value=(tmp_path / "up.mp4", "upload")),
    ]

    with ExitStack() as stack:
        mocks = [stack.enter_context(p) for p in patches]
        td = mocks[3]
        dl = mocks[4]
        up = mocks[8]
        failed = mocks[18]

        work = tmp_path / "work"
        work.mkdir()
        (tmp_path / "up.mp4").write_bytes(b"x")
        (work / "full.mp4").write_bytes(b"x")
        (work / "window_audio_0.opus").write_bytes(b"x")

        @contextmanager
        def _td(*_a, **_k):
            yield str(work)

        td.side_effect = _td

        def _dl(key, dest: Path):
            dest.parent.mkdir(parents=True, exist_ok=True)
            if str(key).endswith(".json"):
                dest.write_text(json.dumps(transcript_words))
            else:
                dest.write_bytes(b"x")

        dl.side_effect = _dl

        def _up(key, path: Path, *_m):
            if "preview" in key:
                preview_keys[key.split("/")[-2]] = key

        up.side_effect = _up

        progress: list[dict] = []

        run_stream_render_job(conn, {"id": "job1", "payload": {"vodId": "vod1"}}, lambda _jid, body: progress.append(body))

    assert ready_calls == ["proj1"]
    failed.assert_not_called()
    assert any(p.get("projectStatus") == "READY" for p in progress)
    preview_uploads = [str(c[0][0]) for c in up.call_args_list if "preview" in str(c[0][0])]
    assert any("/clips/c1/" in k for k in preview_uploads)
    assert any("/clips/c3/" in k for k in preview_uploads)
    assert not any("/clips/c2/" in k for k in preview_uploads)


def test_mark_project_failed_sets_status() -> None:
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: cur
    conn.cursor.return_value.__exit__ = lambda *a: None
    mark_project_failed(conn, "proj_x", "All clip renders failed")
    assert "FAILED" in cur.execute.call_args[0][0]
