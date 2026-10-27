"""Streamer VOD transcription (Modal GPU + Deepgram fallback)."""
from __future__ import annotations

import os
import sys

from clips_worker.deepgram_transcribe import (
    DeepgramTranscribeError,
    TranscribeMeta,
    deepgram_api_key,
    transcribe_deepgram,
)
from clips_worker.gpu.base import TranscribeReq, TranscribeRes
from clips_worker.streamer.modal_transcribe import (
    StreamModalTranscribeError,
    estimate_modal_cost_usd,
    transcribe_stream_modal_with_meta,
)

STREAM_CHUNK_MAX_BYTES = int(os.environ.get("STREAMER_CHUNK_MAX_BYTES", str(100 * 1024 * 1024)))


def resolve_stream_transcribe_provider() -> str:
    """modal | deepgram — streamer default is Modal (no Groq)."""
    explicit = (os.environ.get("STREAM_TRANSCRIBE_PROVIDER") or "").strip().lower()
    if explicit == "deepgram":
        return "deepgram" if deepgram_api_key() else "modal"
    if explicit == "modal":
        return "modal"
    return "modal"


def stream_whisper_model() -> str:
    return (
        os.environ.get("STREAM_WHISPER_GPU_MODEL") or os.environ.get("WHISPER_GPU_MODEL") or "large-v3-turbo"
    ).strip()


def deepgram_caption_model() -> str:
    return (os.environ.get("DEEPGRAM_CAPTION_MODEL") or "nova-3").strip() or "nova-3"


def estimate_stream_transcribe_cost_usd(provider: str, audio_minutes: float, gpu_seconds: float = 0.0) -> float:
    if provider in ("modal", "modal_diarize"):
        return estimate_modal_cost_usd(gpu_seconds)
    if provider == "deepgram":
        try:
            per_min = float(os.environ.get("DEEPGRAM_USD_PER_MIN", "0.006"))
        except ValueError:
            per_min = 0.006
        return audio_minutes * per_min
    return 0.0


def log_stream_transcribe_summary(
    *,
    vod_id: str,
    project_id: str,
    provider: str,
    audio_minutes: float,
    gpu_seconds: float = 0.0,
    cold_start_s: float | None = None,
    fallback: str | None = None,
) -> None:
    cost = estimate_stream_transcribe_cost_usd(provider, audio_minutes, gpu_seconds)
    fb = fallback or "none"
    cold = cold_start_s if cold_start_s is not None else 0.0
    print(
        f"[clipper:stream] transcribe_vod vodId={vod_id} projectId={project_id} "
        f"provider={provider} audioMinutes={audio_minutes:.1f} gpuSeconds={gpu_seconds:.2f} "
        f"coldStartS={cold:.2f} costUsdEst={cost:.4f} fallback={fb}",
        file=sys.stderr,
        flush=True,
    )


def _deepgram_fallback(
    conn,
    req: TranscribeReq,
    workspace_id: str,
    project_id: str,
    reason: str,
) -> tuple[TranscribeRes, TranscribeMeta]:
    if not deepgram_api_key():
        raise StreamModalTranscribeError(reason)
    print(
        f"[clipper:stream] transcribe_chunk modal_failed reason={reason} falling_back=deepgram",
        file=sys.stderr,
        flush=True,
    )
    res = transcribe_deepgram(req)
    meta = TranscribeMeta(transcription_engine="deepgram", fallback_reason=f"modal_{reason}")
    res.transcription_engine = meta.transcription_engine
    res.fallback_reason = meta.fallback_reason
    res.provider = "deepgram"
    return res, meta


def transcribe_stream_audio_request(
    conn,
    req: TranscribeReq,
    workspace_id: str,
    project_id: str,
    *,
    vod_provider: str | None = None,
) -> tuple[TranscribeRes, TranscribeMeta]:
    """Full-VOD chunk transcribe for streamer analyze."""
    provider = (vod_provider or resolve_stream_transcribe_provider()).strip().lower()
    if provider == "deepgram":
        try:
            res = transcribe_deepgram(req)
            meta = TranscribeMeta(transcription_engine="deepgram")
            res.transcription_engine = meta.transcription_engine
            return res, meta
        except DeepgramTranscribeError as exc:
            raise StreamModalTranscribeError(exc.reason) from exc

    diarize = provider == "modal_diarize"
    modal_provider = "modal_diarize" if diarize else "modal"
    req_with_model = TranscribeReq(
        audio_url=req.audio_url,
        audio_path=req.audio_path,
        offset_ms=req.offset_ms,
        language=req.language,
        initial_prompt=req.initial_prompt,
        model=stream_whisper_model(),
    )
    try:
        res, telemetry = transcribe_stream_modal_with_meta(req_with_model, diarize=diarize)
        meta = TranscribeMeta(transcription_engine=modal_provider, telemetry=telemetry)
        res.transcription_engine = meta.transcription_engine
        return res, meta
    except StreamModalTranscribeError as exc:
        if deepgram_api_key():
            return _deepgram_fallback(conn, req, workspace_id, project_id, exc.reason)
        raise


def transcribe_clip_caption(req: TranscribeReq) -> TranscribeRes:
    """Caption-grade Deepgram (nova-3, diarize) on final clip audio only."""
    model = deepgram_caption_model()
    if not deepgram_api_key():
        raise DeepgramTranscribeError("no_api_key")
    return transcribe_deepgram(req, model=model)
