"""Long-VOD analyze: chunk plan, cost cap, concurrent transcribe with per-chunk checkpoint."""
from __future__ import annotations

import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from clips_worker.gpu.base import TranscribeReq
from clips_worker.streamer.chunk_transcribe import transcribe_chunk_with_retry
from clips_worker.streamer.chunk_signals import ensure_chunk_signals_stored
from clips_worker.streamer.chunking import ffmpeg_slice_opus, plan_chunks
from clips_worker.streamer.config import CHUNK_MIN, CHUNK_OVERLAP_S
from clips_worker.streamer.errors import PermanentError
from clips_worker.streamer.keys import stream_chunk_key
from clips_worker.streamer.transcribe_stream import estimate_stream_transcribe_cost_usd
from clips_worker.storage import download_object, put_json, sign_url, upload_file


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError:
        return default


STREAM_ANALYZE_CHUNK_CONCURRENCY = max(1, _int_env("STREAM_ANALYZE_CHUNK_CONCURRENCY", 2))
# Modal L4 ~$0.000542/GPU-s × ~0.35 GPU-s per audio min ≈ $0.00019/min (~$0.07 for 6h).
STREAM_EST_GPU_S_PER_AUDIO_MIN = _float_env("STREAM_EST_GPU_S_PER_AUDIO_MIN", 0.35)
STREAM_VOD_COST_BUFFER = _float_env("STREAM_VOD_COST_BUFFER", 2.5)
STREAM_VOD_MAX_EST_COST_USD = _float_env("STREAM_VOD_MAX_EST_COST_USD", 1.5)


def usd_per_audio_minute_estimate(provider: str) -> float:
    if provider.startswith("modal"):
        from clips_worker.streamer.modal_transcribe import stream_modal_usd_per_gpu_second

        gpu_per_min = _float_env("STREAM_EST_GPU_S_PER_AUDIO_MIN", STREAM_EST_GPU_S_PER_AUDIO_MIN)
        return gpu_per_min * stream_modal_usd_per_gpu_second()
    try:
        return float(os.environ.get("DEEPGRAM_USD_PER_MIN", "0.006"))
    except ValueError:
        return 0.006


def effective_vod_cost_cap_usd(analysed_minutes: float, provider: str) -> float:
    """Per-VOD ceiling from real $/min estimate (6h target well under $2)."""
    per_min = usd_per_audio_minute_estimate(provider)
    buffer = _float_env("STREAM_VOD_COST_BUFFER", STREAM_VOD_COST_BUFFER)
    scaled = analysed_minutes * per_min * buffer
    ceiling = _float_env("STREAM_VOD_MAX_EST_COST_USD", STREAM_VOD_MAX_EST_COST_USD)
    floor = _float_env("STREAM_VOD_MIN_EST_COST_USD", 0.10)
    return max(floor, min(ceiling, scaled))


def pick_chunk_duration_min(duration_ms: int) -> int:
    """Scale chunk size for 2–6h VODs (fewer chunks, same overlap semantics)."""
    minutes = max(0, duration_ms) / 60_000.0
    if minutes >= 360:
        return max(CHUNK_MIN, _int_env("STREAM_LONG_VOD_CHUNK_MIN_6H", 25))
    if minutes >= 120:
        return max(CHUNK_MIN, _int_env("STREAM_LONG_VOD_CHUNK_MIN_2H", 20))
    return CHUNK_MIN


def resolve_analyze_chunk_plan(duration_ms: int) -> tuple[int, int, list[tuple[int, int]]]:
    chunk_ms = pick_chunk_duration_min(duration_ms) * 60 * 1000
    overlap_ms = CHUNK_OVERLAP_S * 1000
    ranges = plan_chunks(duration_ms, chunk_ms, overlap_ms)
    return chunk_ms, overlap_ms, ranges


def estimate_vod_transcribe_cost_usd(provider: str, analysed_minutes: float, chunk_count: int) -> float:
    """Conservative pre-flight estimate before GPU work starts."""
    if provider.startswith("modal"):
        gpu_per_min = _float_env("STREAM_EST_GPU_S_PER_AUDIO_MIN", STREAM_EST_GPU_S_PER_AUDIO_MIN)
        est_gpu_s = analysed_minutes * gpu_per_min * max(1.0, chunk_count / max(1, analysed_minutes / 15))
        return estimate_stream_transcribe_cost_usd(provider, analysed_minutes, gpu_seconds=est_gpu_s)
    return estimate_stream_transcribe_cost_usd(provider, analysed_minutes, gpu_seconds=0.0)


def enforce_vod_cost_cap(provider: str, analysed_minutes: float, chunk_count: int) -> float:
    est = estimate_vod_transcribe_cost_usd(provider, analysed_minutes, chunk_count)
    cap = effective_vod_cost_cap_usd(analysed_minutes, provider)
    if cap > 0 and est > cap:
        raise PermanentError(
            f"Estimated transcribe cost ${est:.4f} exceeds cap ${cap:.4f} for this VOD "
            f"({analysed_minutes:.0f} min, {chunk_count} chunks). "
            "Shorten the range or raise STREAM_VOD_MAX_EST_COST_USD."
        )
    print(
        f"[clipper:stream] analyze_cost_estimate provider={provider} "
        f"audio_min={analysed_minutes:.1f} chunks={chunk_count} est_usd={est:.4f} cap_usd={cap:.4f}",
        flush=True,
    )
    return est


def log_stream_analyze_summary(
    *,
    vod_id: str,
    vod_minutes: float,
    chunks: int,
    transcribe_ms: int,
    est_cost_usd: float,
    clips_out: int,
) -> None:
    print(
        f"[clipper:stream] vodId={vod_id} vod_minutes={vod_minutes:.2f} chunks={chunks} "
        f"transcribe_ms={transcribe_ms} est_cost_usd={est_cost_usd:.4f} clips_out={clips_out}",
        flush=True,
    )


@dataclass
class ChunkTranscribeMetrics:
    transcribe_ms: int
    est_cost_usd: float
    gpu_seconds: float


def transcribe_vod_chunks(
    *,
    conn,
    vod_id: str,
    workspace_id: str,
    project_id: str,
    ranges: list[tuple[int, int]],
    audio_path: Path,
    scratch: Path,
    state: dict,
    chunks_state: dict,
    vod_transcribe_provider: str,
    settings: dict,
    save_state: Callable[[dict], None],
    on_chunk_progress: Callable[[int, int, dict], None] | None = None,
) -> tuple[list[list[dict] | None], list[dict], ChunkTranscribeMetrics]:
    """Transcribe all chunks with overlap; resume from state['chunks']; optional concurrency."""
    done = {int(k) for k, v in chunks_state.items() if v.get("wordsKey")}
    all_word_chunks: list[list[dict] | None] = [None] * len(ranges)
    chunk_signal_payloads: list[dict | None] = [None] * len(ranges)
    state_lock = threading.Lock()
    transcribe_started = time.monotonic()
    total_gpu_seconds = 0.0

    def _load_done(idx: int) -> None:
        wkey = chunks_state[str(idx)]["wordsKey"]
        wp = scratch / f"words_{idx}.json"
        download_object(wkey, wp)
        all_word_chunks[idx] = json.loads(wp.read_text())
        chunk_path = scratch / f"chunk_{idx}.opus"
        if not chunk_path.exists():
            ffmpeg_slice_opus(audio_path, chunk_path, ranges[idx][0], ranges[idx][1])
        skey_existing = (chunks_state.get(str(idx)) or {}).get("signalsKey")

        def _upload_sig(p: Path, _idx=idx) -> None:
            sk = stream_chunk_key(workspace_id, vod_id, _idx, "signals.json")
            upload_file(sk, p, "application/json")

        payload = ensure_chunk_signals_stored(
            chunk_audio=chunk_path,
            words=all_word_chunks[idx] or [],
            vod_start_ms=ranges[idx][0],
            vod_end_ms=ranges[idx][1],
            signals_key=skey_existing,
            scratch=scratch,
            chunk_index=idx,
            upload_fn=_upload_sig,
        )
        chunk_signal_payloads[idx] = payload
        if not skey_existing:
            sk = stream_chunk_key(workspace_id, vod_id, idx, "signals.json")
            with state_lock:
                chunks_state[str(idx)] = {**(chunks_state.get(str(idx)) or {}), "signalsKey": sk}
                state["chunks"] = chunks_state
                save_state(state)

    for idx in sorted(done):
        _load_done(idx)

    def _process_one(idx: int) -> None:
        nonlocal total_gpu_seconds
        start_ms, end_ms = ranges[idx]
        chunk_path = scratch / f"chunk_{idx}.opus"
        ffmpeg_slice_opus(audio_path, chunk_path, start_ms, end_ms)
        ck = stream_chunk_key(workspace_id, vod_id, idx, "opus")
        upload_file(ck, chunk_path, "audio/opus")
        req = TranscribeReq(
            audio_path=str(chunk_path),
            audio_url=sign_url(ck, expires_s=7200),
            offset_ms=start_ms,
            language=(settings.get("streamer") or {}).get("language"),
        )
        prior = int((chunks_state.get(str(idx)) or {}).get("attempts") or 0)
        res, _chunk_meta = transcribe_chunk_with_retry(
            conn,
            req,
            workspace_id,
            project_id,
            idx,
            prior_attempts=prior,
            vod_provider=vod_transcribe_provider,
        )
        if vod_transcribe_provider.startswith("modal") and getattr(res, "gpu_seconds", 0):
            total_gpu_seconds += float(res.gpu_seconds)
        wkey = stream_chunk_key(workspace_id, vod_id, idx, "words.json")
        put_json(wkey, res.words)
        with state_lock:
            chunks_state[str(idx)] = {
                "wordsKey": wkey,
                "startMs": start_ms,
                "endMs": end_ms,
                "attempts": prior + 1,
                "done": True,
            }
            state["chunks"] = chunks_state
            state["analyzeStartedAt"] = state.get("analyzeStartedAt") or time.time()
            save_state(state)
        all_word_chunks[idx] = res.words

        def _upload_sig_fresh(p: Path, _idx=idx) -> None:
            sk = stream_chunk_key(workspace_id, vod_id, _idx, "signals.json")
            upload_file(sk, p, "application/json")

        sig_payload = ensure_chunk_signals_stored(
            chunk_audio=chunk_path,
            words=res.words,
            vod_start_ms=start_ms,
            vod_end_ms=end_ms,
            signals_key=None,
            scratch=scratch,
            chunk_index=idx,
            upload_fn=_upload_sig_fresh,
        )
        chunk_signal_payloads[idx] = sig_payload
        sk = stream_chunk_key(workspace_id, vod_id, idx, "signals.json")
        with state_lock:
            chunks_state[str(idx)]["signalsKey"] = sk
            state["chunks"] = chunks_state
            save_state(state)
        if on_chunk_progress:
            done_n = len([k for k, v in chunks_state.items() if v.get("wordsKey")])
            on_chunk_progress(done_n, len(ranges), res)

    pending = [i for i in range(len(ranges)) if i not in done]
    workers = min(STREAM_ANALYZE_CHUNK_CONCURRENCY, max(1, len(pending)))
    if workers <= 1:
        for idx in pending:
            _process_one(idx)
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_process_one, idx) for idx in pending]
            for fut in as_completed(futures):
                fut.result()

    transcribe_ms = int((time.monotonic() - transcribe_started) * 1000)
    analysed_minutes = max(0.01, (ranges[-1][1] - ranges[0][0]) / 60_000.0) if ranges else 0.01
    est = estimate_stream_transcribe_cost_usd(
        vod_transcribe_provider,
        analysed_minutes,
        gpu_seconds=total_gpu_seconds,
    )
    payloads = [p for p in chunk_signal_payloads if p is not None]
    return all_word_chunks, payloads, ChunkTranscribeMetrics(
        transcribe_ms=transcribe_ms,
        est_cost_usd=est,
        gpu_seconds=total_gpu_seconds,
    )
