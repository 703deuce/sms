"""Per-chunk signal scoring with VOD-relative timestamps (rolling-ready stage 1)."""
from __future__ import annotations

import json
from pathlib import Path

from clips_worker.streamer.signals import audio_signal_per_second, transcript_signal_per_second
from clips_worker.streamer.signals.speaker_change import speaker_change_signal_per_second


def _words_in_vod_window(words: list[dict], start_ms: int, end_ms: int) -> list[dict]:
    out: list[dict] = []
    start_s = start_ms / 1000.0
    end_s = end_ms / 1000.0
    for w in words:
        s = float(w.get("s", 0))
        if start_s <= s < end_s:
            rebased = dict(w)
            rebased["s"] = s - start_s
            rebased["e"] = float(w.get("e", s)) - start_s
            out.append(rebased)
    return out


def score_chunk_signals(
    *,
    chunk_audio: Path,
    words: list[dict],
    vod_start_ms: int,
    vod_end_ms: int,
) -> dict:
    """Score one rolling chunk; curves are chunk-local 1 Hz, keyed by vodStartMs/vodEndMs."""
    duration_s = max(1, int((vod_end_ms - vod_start_ms) / 1000))
    chunk_words = _words_in_vod_window(words, vod_start_ms, vod_end_ms)
    audio = audio_signal_per_second(chunk_audio, duration_s)
    transcript = transcript_signal_per_second(chunk_words, duration_s)
    reaction = [max(float(a), float(t)) for a, t in zip(audio, transcript, strict=False)]
    return {
        "v": 1,
        "vodStartMs": vod_start_ms,
        "vodEndMs": vod_end_ms,
        "hz": 1,
        "audio": audio,
        "transcript": transcript,
        "reaction": reaction,
        "speakerChange": speaker_change_signal_per_second(chunk_words, duration_s),
    }


def ensure_chunk_signals_stored(
    *,
    chunk_audio: Path,
    words: list[dict],
    vod_start_ms: int,
    vod_end_ms: int,
    signals_key: str | None,
    scratch: Path,
    chunk_index: int,
    upload_fn,
) -> dict:
    """Load per-chunk signals from storage or score, upload, and return payload."""
    if signals_key:
        path = scratch / f"chunk_signals_{chunk_index}.json"
        from clips_worker.storage import download_object

        download_object(signals_key, path)
        return json.loads(path.read_text())

    payload = score_chunk_signals(
        chunk_audio=chunk_audio,
        words=words,
        vod_start_ms=vod_start_ms,
        vod_end_ms=vod_end_ms,
    )
    path = scratch / f"chunk_signals_{chunk_index}.json"
    path.write_text(json.dumps(payload))
    upload_fn(path)
    return payload


def merge_chunk_signal_curves(chunks: list[dict], duration_s: int) -> dict[str, list[float]]:
    """Stitch chunk-local curves into full-VOD 1 Hz series (max in overlap)."""
    keys = ("audio", "transcript", "reaction", "speakerChange")
    out: dict[str, list[float]] = {k: [0.0] * duration_s for k in keys}
    for ch in sorted(chunks, key=lambda c: int(c.get("vodStartMs") or 0)):
        off = int(ch.get("vodStartMs") or 0) // 1000
        for key in keys:
            series = ch.get(key) or []
            for i, val in enumerate(series):
                ti = off + i
                if 0 <= ti < duration_s:
                    out[key][ti] = max(out[key][ti], float(val))
    return out
