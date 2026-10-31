"""FV1: "Edit a full video" uses the BYO finalize path with a 3 h cap and full-frame defaults."""
from __future__ import annotations

import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

import pytest

try:  # the real pipeline module needs the whole worker tree; stub it where that is missing
    import clips_worker.pipeline  # noqa: F401
except Exception:  # pragma: no cover - only on partial checkouts
    stub = types.ModuleType("clips_worker.pipeline")
    stub.clip_keys = lambda ws, p, c: {"poster": f"ws/{ws}/projects/{p}/clips/{c}/poster.jpg"}
    stub.initial_clip_edits = lambda s: {"captions": dict(s.get("captions") or {}), "aspectRatio": s.get("aspectRatio") or "9:16"}
    stub.insert_clips_batch = lambda conn, rows: len(rows)
    stub.mark_project_ready = lambda *a, **k: None
    sys.modules["clips_worker.pipeline"] = stub
    for _m in ("clips_worker.probe",):
        if _m not in sys.modules:
            try:
                __import__(_m)
            except Exception:
                pm = types.ModuleType(_m)
                pm.probe_duration = lambda p: 0.0
                sys.modules[_m] = pm

from clips_worker import byo_clip_job as byo  # noqa: E402
from clips_worker.user_errors import ClipUserError  # noqa: E402


def _run(monkeypatch, tmp_path: Path, *, dur_s: float, wh=(1920, 1080), settings=None, job=None):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    monkeypatch.setattr(byo, "probe_duration", lambda _p: dur_s)
    monkeypatch.setattr(byo, "_probe_video_wh", lambda _p: wh)
    monkeypatch.setattr(byo, "initial_clip_edits", lambda s: {"captions": {"enabled": True}, "aspectRatio": s.get("aspectRatio") or "9:16"})
    monkeypatch.setattr(byo, "upload_file", lambda *a, **k: None)
    monkeypatch.setattr(byo, "_poster_frame_jpg", lambda *a, **k: None)
    monkeypatch.setattr(byo, "mark_project_ready", lambda *a, **k: None)
    monkeypatch.setattr(byo, "_build_full_video_assets", lambda *a, **k: {}, raising=False)
    monkeypatch.setattr(byo, "_start_full_video_proxy", lambda *a, **k: None, raising=False)
    rows: list[dict] = []
    monkeypatch.setattr(byo, "insert_clips_batch", lambda _c, r: rows.extend(r) or len(r))
    progress: list[dict] = []
    byo.finalize_byo_clip(
        MagicMock(),
        job or {"id": "j"},
        {"id": "p", "workspaceId": "w", "title": "Long talk", "settings": settings or {}},
        [],
        src,
        lambda _j, pl: progress.append(pl),
    )
    return rows, progress


def test_full_video_one_hour_is_one_full_frame_clip(monkeypatch, tmp_path: Path) -> None:
    rows, progress = _run(
        monkeypatch, tmp_path, dur_s=3600.0, settings={"fullVideo": True, "byo": True, "aspectRatio": "16:9"}
    )
    assert len(rows) == 1
    r = rows[0]
    assert (r["startMs"], r["endMs"]) == (0, 3_600_000)
    assert r["edits"]["trim"] == {"in": 0, "out": 3_600_000}
    assert r["edits"]["aspectRatio"] == "16:9"
    assert r["edits"]["layout"]["mode"] == "full_frame"
    assert r["edits"]["exportTemplate"]["headlineBar"]["enabled"] is False
    assert r["edits"]["exportTemplate"]["platformBadge"]["enabled"] is False
    assert r["aiMeta"]["fullVideo"] is True and r["aiMeta"]["byo"] is True
    assert progress[-1]["jobStatus"] == "DONE"


def test_full_video_rejects_over_three_hours(monkeypatch, tmp_path: Path) -> None:
    with pytest.raises(ClipUserError, match="3 hours"):
        _run(monkeypatch, tmp_path, dur_s=3 * 3600 + 1, settings={"fullVideo": True, "byo": True})


def test_plain_byo_still_capped_at_three_minutes(monkeypatch, tmp_path: Path) -> None:
    with pytest.raises(ClipUserError, match="3 minutes"):
        _run(monkeypatch, tmp_path, dur_s=200.0, settings={"byo": True})


def test_plain_byo_defaults_unchanged(monkeypatch, tmp_path: Path) -> None:
    rows, _ = _run(monkeypatch, tmp_path, dur_s=30.0, wh=(1920, 1080), settings={"byo": True})
    assert rows[0]["edits"]["layout"]["mode"] == "fit_blur"
    assert "exportTemplate" not in rows[0]["edits"]
    assert rows[0]["aiMeta"] == {"byo": True}


def test_payload_flag_and_portrait_source(monkeypatch, tmp_path: Path) -> None:
    rows, _ = _run(
        monkeypatch,
        tmp_path,
        dur_s=600.0,
        wh=(1080, 1920),
        settings={"byo": True, "aspectRatio": "9:16"},
        job={"id": "j", "payload": {"byo": True, "fullVideo": True}},
    )
    assert rows[0]["edits"]["aspectRatio"] == "9:16"
    assert rows[0]["edits"]["layout"]["mode"] == "full_frame"


def test_source_aspect_ratio() -> None:
    assert byo.source_aspect_ratio(1920, 1080) == "16:9"
    assert byo.source_aspect_ratio(1080, 1920) == "9:16"
    assert byo.source_aspect_ratio(1000, 1000) == "1:1"
    assert byo.source_aspect_ratio(1080, 1350) == "4:5"
    assert byo.source_aspect_ratio(0, 0) == "16:9"
