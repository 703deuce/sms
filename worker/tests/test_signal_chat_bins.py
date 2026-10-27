import json
from pathlib import Path

from clips_worker.streamer.signals.chat import (
    CHAT_BIN_S,
    chat_bin_metrics,
    chat_signal_per_second,
)


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "stream_chat_burst.jsonl"


def _load_fixture() -> list[dict]:
    out: list[dict] = []
    for line in FIXTURE.read_text().splitlines():
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out


def test_chat_bin_metrics_spike_on_burst():
    messages = _load_fixture()
    duration_s = 120
    metrics = chat_bin_metrics(messages, duration_s, lag_s=0)
    assert metrics.bin_count == (duration_s + CHAT_BIN_S - 1) // CHAT_BIN_S
    assert metrics.spike_count >= 1
    bin_60 = 60 // CHAT_BIN_S
    assert metrics.z_bins[bin_60] >= 0.4


def test_chat_signal_fixture_peak_near_burst():
    messages = _load_fixture()
    duration_s = 120
    sig = chat_signal_per_second(messages, duration_s, lag_s=0)
    peak = max(range(duration_s), key=lambda i: sig[i])
    assert 55 <= peak <= 65
    assert sig[peak] >= 0.35
