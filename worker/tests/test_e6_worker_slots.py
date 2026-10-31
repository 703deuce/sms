import os
import signal
import threading
import time

import pytest

from clips_worker import render_concurrency, worker_slots


def test_worker_concurrency_defaults_and_clamp(monkeypatch):
    monkeypatch.delenv("WORKER_CONCURRENCY", raising=False)
    monkeypatch.setenv("WORKER_LANE", "default")
    assert render_concurrency.worker_concurrency() == 2
    monkeypatch.setenv("WORKER_LANE", "stream")
    assert render_concurrency.worker_concurrency() == 1
    monkeypatch.setenv("WORKER_CONCURRENCY", "99")
    assert render_concurrency.worker_concurrency() == 8
    monkeypatch.setenv("WORKER_CONCURRENCY", "x")
    assert render_concurrency.worker_concurrency() == 1


def test_ffmpeg_threads_split_across_slots(monkeypatch):
    monkeypatch.setattr(os, "cpu_count", lambda: 12)
    monkeypatch.setenv("CLIPS_RENDER_CONCURRENCY", "3")
    monkeypatch.setenv("WORKER_CONCURRENCY", "2")
    assert render_concurrency.ffmpeg_threads_per_job() == 2


def test_single_slot_runs_inline(monkeypatch):
    monkeypatch.setenv("WORKER_CONCURRENCY", "1")
    seen = []
    worker_slots.maybe_run_slots(lambda: seen.append(os.getpid()), "w:abc")
    assert seen == [os.getpid()]


def test_slots_get_distinct_instance_ids(tmp_path):
    out = tmp_path / "ids"
    out.mkdir()

    def target():
        from clips_worker.worker_identity import worker_instance_id

        (out / str(os.getpid())).write_text(worker_instance_id())

    code = worker_slots.run_slots(target, "clips-worker-1:deadbeef", 3, max_wait_s=30)
    assert code == 0
    ids = sorted(p.read_text() for p in out.iterdir())
    assert ids == [f"clips-worker-1:deadbeef-s{k}" for k in range(3)]
    # Boot-recovery prefix still matches every slot.
    assert all(i.startswith("clips-worker-1:") for i in ids)


def test_sigterm_is_forwarded_and_slots_drain(tmp_path):
    done = tmp_path / "done"
    done.mkdir()

    def target():
        from clips_worker.worker_drain import drain_requested

        t0 = time.monotonic()
        while not drain_requested():
            if time.monotonic() - t0 > 20:
                return
            time.sleep(0.05)
        (done / str(os.getpid())).write_text("drained")

    prev = signal.getsignal(signal.SIGTERM)
    threading.Timer(1.0, lambda: os.kill(os.getpid(), signal.SIGTERM)).start()
    try:
        t0 = time.monotonic()
        code = worker_slots.run_slots(target, "w:1", 2, max_wait_s=30)
    finally:
        signal.signal(signal.SIGTERM, prev)
        signal.signal(signal.SIGINT, signal.default_int_handler)
    assert code == 0
    assert time.monotonic() - t0 < 10
    assert len(list(done.iterdir())) == 2


def test_crashed_slot_stops_group(tmp_path):
    def target():
        from clips_worker.worker_drain import drain_requested
        from clips_worker.worker_identity import worker_instance_id

        if worker_instance_id().endswith("-s0"):
            raise SystemExit(1)
        while not drain_requested():
            time.sleep(0.05)

    prev = signal.getsignal(signal.SIGTERM)
    try:
        code = worker_slots.run_slots(target, "w:1", 2, max_wait_s=30)
    finally:
        signal.signal(signal.SIGTERM, prev)
        signal.signal(signal.SIGINT, signal.default_int_handler)
    assert code == 1


def test_max_wait_never_hangs():
    def target():
        signal.signal(signal.SIGTERM, signal.SIG_IGN)  # wedged child ignores drain
        while True:
            time.sleep(0.05)

    prev = signal.getsignal(signal.SIGTERM)
    try:
        t0 = time.monotonic()
        worker_slots.run_slots(target, "w:1", 2, max_wait_s=1)
    finally:
        signal.signal(signal.SIGTERM, prev)
        signal.signal(signal.SIGINT, signal.default_int_handler)
    assert time.monotonic() - t0 < 15
