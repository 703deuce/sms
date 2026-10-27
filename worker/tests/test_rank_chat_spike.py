from clips_worker.streamer.rank import rank_moments
from pathlib import Path


def _flat_curves(duration_s: int, level: float = 0.05) -> dict:
    base = [level] * duration_s
    return {
        "audio": list(base),
        "transcript": list(base),
        "reaction": list(base),
        "speakerChange": list(base),
    }


def test_chat_spike_lifts_moment_with_chunked_signals(tmp_path: Path):
    duration_s = 120
    duration_ms = duration_s * 1000
    audio_path = tmp_path / "silent.wav"
    audio_path.write_bytes(b"")

    messages = []
    for i in range(80):
        messages.append({"t_s": 60, "user": f"u{i}", "text": "KEKW OMEGALUL Pog clip it"})

    picks, _ = rank_moments(
        audio_path=audio_path,
        words=[],
        duration_ms=duration_ms,
        settings={"streamer": {"clipCount": 4, "minClipS": 10, "maxClipS": 45}, "llmBlend": 0.0},
        use_llm=False,
        chat_messages=messages,
        vod_signal_curves=_flat_curves(duration_s),
    )
    assert picks
    best = picks[0]
    peak_s = best.peak_ms // 1000
    assert 52 <= peak_s <= 68
