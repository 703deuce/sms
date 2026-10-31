"""E5b on-demand media transcription job (DB + providers mocked)."""
from __future__ import annotations

import shutil
import subprocess
import types
from pathlib import Path

import pytest

from clips_worker import media_transcribe_job as mtj
from clips_worker.job_types import JOB_TYPES


def test_job_type_registered():
    assert "MEDIA_TRANSCRIBE" in JOB_TYPES
    src = (Path(mtj.__file__).parent / "main.py").read_text()
    assert 'DISPATCH["MEDIA_TRANSCRIBE"] = handle_media_transcribe' in src
    assert "run_media_transcribe_job(conn, job)\n    _mark_job_done(conn, job[\"id\"])" in src


def _stub(monkeypatch, name: str, **attrs):
    import sys

    mod = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(mod, k, v)
    monkeypatch.setitem(sys.modules, name, mod)


def test_cost(monkeypatch):
    monkeypatch.delenv("CLIPS_TRANSCRIBE_USD_PER_MIN", raising=False)
    assert mtj.transcribe_cost_usd("deepgram", 60.0, 0) == pytest.approx(0.0043)
    assert mtj.transcribe_cost_usd("deepgram", 2.0, 0) == pytest.approx(15 / 60 * 0.0043)
    monkeypatch.setenv("CLIPS_TRANSCRIBE_USD_PER_MIN", "0.0059")
    assert mtj.transcribe_cost_usd("deepgram", 600.0, 0) == pytest.approx(0.059)
    assert mtj.transcribe_cost_usd("modal", 600.0, 10.0) == pytest.approx(10 * 0.000222)
    assert mtj.transcribe_cost_usd("local", 600.0, 10.0) == 0.0


def test_clean_words():
    got = mtj.clean_words([{"w": " hi ", "s": 0.1234, "e": 0.5}, {"w": "", "s": 0, "e": 1}, {"w": "x", "s": 2, "e": 1}, {"word": "yo", "s": 1, "e": 1.2, "p": 0.9}])
    assert got == [{"w": "hi", "s": 0.123, "e": 0.5}, {"w": "yo", "s": 1.0, "e": 1.2, "p": 0.9}]


class _Cur:
    def __init__(self, db):
        self.db = db
        self._row = None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params):
        self.db.calls.append((sql, params))
        if sql.startswith('SELECT ref, "refId"'):
            self._row = ("upload", "upl_v", "ws1")
        elif sql.startswith("SELECT u.key"):
            self._row = ("ws1/uploads/upl_v.mp4", "video/mp4")
        else:
            self._row = None

    def fetchone(self):
        return self._row


class _Conn:
    def __init__(self):
        self.calls = []
        self.commits = 0

    def cursor(self):
        return _Cur(self)

    def commit(self):
        self.commits += 1


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")
def test_job_writes_words_and_cost(monkeypatch, tmp_path):
    def fake_download(key, dest):
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=440:d=2", "-c:a", "aac", "-f", "mp4", str(dest)])

    seen = {}

    def fake_transcribe(conn, req, ws, project):
        seen["audio"] = Path(req.audio_path).suffix
        seen["scope"] = (ws, project)
        res = types.SimpleNamespace(words=[{"w": "hello", "s": 0.1, "e": 0.4}], language="en", duration_s=2.0, provider="deepgram", gpu_seconds=0.0)
        return res, types.SimpleNamespace(transcription_engine="deepgram")

    _stub(monkeypatch, "clips_worker.storage", download_object=fake_download)
    _stub(monkeypatch, "clips_worker.transcribe_provider", transcribe_audio_request=fake_transcribe)
    monkeypatch.delenv("CLIPS_TRANSCRIBE_USD_PER_MIN", raising=False)
    conn = _Conn()
    mtj.run_media_transcribe_job(conn, {"id": "j1", "projectId": "p1", "payload": {"transcriptId": "t1"}})
    assert seen == {"audio": ".wav", "scope": ("ws1", "p1")}
    upd = conn.calls[-1]
    assert upd[0].startswith("UPDATE clip_media_transcripts SET status = %s, words")
    status, words, lang, dur_ms, cost, provider, err, tid = upd[1]
    assert (status, lang, provider, err, tid) == ("done", "en", "deepgram", None, "t1")
    assert '"hello"' in words and 1900 <= dur_ms <= 2100
    assert cost == round(15 / 60 * 0.0043 * 1e6)
    # Upload lookup is scoped to the workspace + project.
    sel = next(c for c in conn.calls if c[0].startswith("SELECT u.key"))
    assert sel[1] == ("upl_v", "ws1", "p1", "COMPLETE")


def test_job_records_failure(monkeypatch):
    def boom(key, dest):
        raise OSError("nope")

    _stub(monkeypatch, "clips_worker.storage", download_object=boom)
    _stub(monkeypatch, "clips_worker.transcribe_provider", transcribe_audio_request=None)
    conn = _Conn()
    mtj.run_media_transcribe_job(conn, {"id": "j1", "projectId": "p1", "payload": '{"transcriptId": "t1"}'})
    status, *_rest, err, tid = conn.calls[-1][1]
    assert status == "failed" and "nope" in err and tid == "t1"
