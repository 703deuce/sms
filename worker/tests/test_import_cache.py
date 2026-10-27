from pathlib import Path

from clips_worker.streamer.import_cache import pick_completed_audio, sweep_stale_failed_import_dirs


def test_pick_completed_audio_skips_part(tmp_path: Path):
    (tmp_path / "audio.webm.part").write_bytes(b"x")
    (tmp_path / "audio.webm.ytdl").write_bytes(b"x")
    (tmp_path / "audio.webm.part-Frag1").write_bytes(b"x")
    done = tmp_path / "audio.webm"
    done.write_bytes(b"ok")
    picked = pick_completed_audio(tmp_path)
    assert picked == done


def test_sweep_stale_failed_import_dirs(tmp_path, monkeypatch):
    from clips_worker.streamer import import_cache

    root = tmp_path / "imports"
    root.mkdir()
    old = root / "vod_old"
    old.mkdir()
    import time

    old_time = time.time() - 10 * 86400
    import os

    os.utime(old, (old_time, old_time))
    monkeypatch.setattr(import_cache, "SCRATCH", tmp_path)
    n = sweep_stale_failed_import_dirs(max_age_s=48 * 3600)
    assert n == 1
    assert not old.exists()
