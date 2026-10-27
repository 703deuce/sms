"""Streamer VOD transcription provider (Groq full-VOD + Deepgram fallback)."""
from __future__ import annotations

import os
import sys

from clips_worker.deepgram_transcribe import (
    DeepgramTranscribeError,
    TranscribeMeta,
    deepgram_api_key,
    transcribe_deepgram,
)
from clips_worker.gpu import transcribe_with_fallback
from clips_worker.gpu.base import TranscribeReq, TranscribeRes
from clips_worker.groq_transcribe import (
    GroqTranscribeError,
    StreamTranscribeCost,
    groq_api_key,
    groq_usd_per_audio_hour,
    transcribe_groq,
)

# Max upload size per Groq request (Rick: <100 MB per chunk).
STREAM_CHUNK_MAX_BYTES = int(os.environ.get("STREAMER_CHUNK_MAX_BYTES", str(100 * 1024 * 1024)))


def resolve_stream_transcribe_provider() -> str:
    """groq | deepgram | local — see STREAM_TRANSCRIBE_PROVIDER."""
    explicit = (os.environ.get("STREAM_TRANSCRIBE_PROVIDER") or "").strip().lower()
    has_groq = bool(groq_api_key())
    has_dg = bool(deepgram_api_key())
    if explicit == "groq":
        return "groq" if has_groq else ("deepgram" if has_dg else "local")
    if explicit == "deepgram":
        return "deepgram" if has_dg else "local"
    if explicit == "local":
        return "local"
    # Auto: prefer Groq when key exists (Rick: switch from Deepgram once GROQ_API_KEY is set).
    if has_groq:
        return "groq"
    if has_dg:
        return "deepgram"
    return "local"


def deepgram_caption_model() -> str:
    """Nova-3 for caption-grade words on final clips only (render path)."""
    return (os.environ.get("DEEPGRAM_CAPTION_MODEL") or "nova-3").strip() or "nova-3"


def estimate_stream_transcribe_cost_usd(provider: str, audio_minutes: float) -> float:
    if provider == "groq":
        return (audio_minutes / 60.0) * groq_usd_per_audio_hour()
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
    fallback: str | None = None,
) -> None:
    cost = estimate_stream_transcribe_cost_usd(provider, audio_minutes)
    fb = fallback or "none"
    print(
        f"[clipper:stream] transcribe_vod vodId={vod_id} projectId={project_id} "
        f"provider={provider} audioMinutes={audio_minutes:.1f} costUsdEst={cost:.4f} fallback={fb}",
        file=sys.stderr,
        flush=True,
    )


def transcribe_stream_audio_request(
    conn,
    req: TranscribeReq,
    workspace_id: str,
    project_id: str,
    *,
    vod_provider: str | None = None,
) -> tuple[TranscribeRes, TranscribeMeta]:
    """Full-VOD chunk transcribe for streamer analyze (not caption-grade Deepgram)."""
    provider = (vod_provider or resolve_stream_transcribe_provider()).strip().lower()
    if provider == "groq":
        try:
            res = transcribe_groq(req)
            meta = TranscribeMeta(transcription_engine="groq")
            res.transcription_engine = meta.transcription_engine
            return res, meta
        except GroqTranscribeError as exc:
            if deepgram_api_key():
                print(
                    f"[clipper:stream] transcribe_chunk groq_failed reason={exc.reason} falling_back=deepgram",
                    file=sys.stderr,
                    flush=True,
                )
                res = transcribe_deepgram(req)
                meta = TranscribeMeta(transcription_engine="deepgram", fallback_reason=f"groq_{exc.reason}")
                res.transcription_engine = meta.transcription_engine
                res.fallback_reason = meta.fallback_reason
                return res, meta
            raise

    if provider == "deepgram":
        try:
            res = transcribe_deepgram(req)
            meta = TranscribeMeta(transcription_engine="deepgram")
            res.transcription_engine = meta.transcription_engine
            return res, meta
        except DeepgramTranscribeError as exc:
            res = transcribe_with_fallback(conn, req, workspace_id, project_id)
            engine = "local_whisper" if res.provider == "local" else res.provider
            meta = TranscribeMeta(transcription_engine=engine, fallback_reason=exc.reason)
            res.transcription_engine = meta.transcription_engine
            res.fallback_reason = meta.fallback_reason
            return res, meta

    res = transcribe_with_fallback(conn, req, workspace_id, project_id)
    engine = "local_whisper" if res.provider == "local" else res.provider
    meta = TranscribeMeta(transcription_engine=engine)
    res.transcription_engine = meta.transcription_engine
    return res, meta


def transcribe_clip_caption(req: TranscribeReq) -> TranscribeRes:
    """Caption-grade Deepgram (nova-3, diarize) on final clip audio only."""
    model = deepgram_caption_model()
    if not deepgram_api_key():
        raise DeepgramTranscribeError("no_api_key")
    # diarize=true is set in deepgram _listen_params (speaker labels for captions).
    return transcribe_deepgram(req, model=model)
