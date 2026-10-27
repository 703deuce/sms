"""Pytest path setup for prototype/v3 modules used by director/smoothing calm tests."""
from __future__ import annotations

import signal
import sys
from pathlib import Path

import pytest

_V3 = Path(__file__).resolve().parents[1] / "prototype" / "v3"
if _V3.is_dir() and str(_V3) not in sys.path:
    sys.path.insert(0, str(_V3))


@pytest.fixture(autouse=True)
def _clipper_unit_test_timeout():
    """Cap wall time per test — no full pipeline / ffmpeg in clipper unit suite."""
    seconds = 30

    def _on_alarm(_signum, _frame):
        raise TimeoutError(f"test exceeded {seconds}s")

    old = signal.signal(signal.SIGALRM, _on_alarm)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)
