"""Rolling-ready per-chunk signal merge."""
from clips_worker.streamer.chunk_signals import merge_chunk_signal_curves, score_chunk_signals


def test_merge_chunk_signal_curves_overlap_max():
    chunks = [
        {"vodStartMs": 0, "vodEndMs": 10000, "audio": [0.1, 0.9, 0.2], "transcript": [0.0, 0.5, 0.0], "speakerChange": [0.0, 0.0, 0.3]},
        {
            "vodStartMs": 8000,
            "vodEndMs": 18000,
            "audio": [0.4, 0.4, 0.4, 0.4, 0.4],
            "transcript": [0.1, 0.1, 0.1, 0.1, 0.1],
            "speakerChange": [0.2, 0.2, 0.2, 0.2, 0.2],
        },
    ]
    merged = merge_chunk_signal_curves(chunks, duration_s=18)
    assert len(merged["audio"]) == 18
    # Overlap at seconds 8–9: max(0.2, 0.4) = 0.4
    assert merged["audio"][8] == 0.4
    assert merged["audio"][9] == 0.4
    assert merged["audio"][1] == 0.9


def test_score_chunk_signals_vod_relative_metadata():
    words = [{"s": 125.0, "e": 126.0, "w": "hi"}]
    payload = score_chunk_signals(
        chunk_audio=__import__("pathlib").Path("/dev/null"),
        words=words,
        vod_start_ms=120_000,
        vod_end_ms=180_000,
    )
    assert payload["vodStartMs"] == 120_000
    assert payload["vodEndMs"] == 180_000
    assert payload["hz"] == 1
    assert len(payload["transcript"]) == 60
