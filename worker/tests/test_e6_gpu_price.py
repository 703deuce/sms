"""E6: stream Modal cost estimate used the L40S rate while the functions run on L4."""
from __future__ import annotations

from clips_worker.gpu import usage as gpu_usage
from clips_worker.streamer import modal_transcribe as mt


def test_stream_modal_rate_is_l4(monkeypatch):
    monkeypatch.delenv("MODAL_L4_USD_PER_GPU_S", raising=False)
    monkeypatch.delenv("MODAL_L4_USD_PER_S", raising=False)
    assert mt.stream_modal_usd_per_gpu_second() == 0.000222
    assert abs(mt.stream_modal_usd_per_gpu_second() * 3600 - 0.80) < 0.01  # $0.80/h L4
    assert mt.stream_modal_usd_per_gpu_second() == gpu_usage.L4_USD_PER_S


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("MODAL_L4_USD_PER_S", "0.0003")
    assert mt.stream_modal_usd_per_gpu_second() == 0.0003
    monkeypatch.setenv("MODAL_L4_USD_PER_GPU_S", "0.0004")
    assert mt.stream_modal_usd_per_gpu_second() == 0.0004
    monkeypatch.setenv("MODAL_L4_USD_PER_GPU_S", "bogus")
    assert mt.stream_modal_usd_per_gpu_second() == 0.000222
