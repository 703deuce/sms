"""Modal GPU transcribe for streamer full-VOD (not regular clipper path)."""
from __future__ import annotations

import logging
import os
import sys

from clips_worker.gpu.base import TranscribeReq, TranscribeRes, normalize_words

log = logging.getLogger(__name__)

APP_NAME = os.environ.get("MODAL_APP_NAME", "transovo-gpu")
STREAM_WHISPER_MODEL = (
    os.environ.get("STREAM_WHISPER_GPU_MODEL") or os.environ.get("WHISPER_GPU_MODEL") or "large-v3-turbo"
).strip()
STREAM_MODAL_TIMEOUT_S = int(os.environ.get("STREAM_MODAL_TRANSCRIBE_TIMEOUT_S", "900"))


class StreamModalTranscribeError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def stream_modal_usd_per_gpu_second() -> float:
    try:
        return float(os.environ.get("MODAL_L4_USD_PER_GPU_S", "0.000542"))
    except ValueError:
        return 0.000542


def estimate_modal_cost_usd(gpu_seconds: float) -> float:
    return max(0.0, gpu_seconds) * stream_modal_usd_per_gpu_second()


def _stream_transcriber():
    import modal

    return modal.Cls.from_name(APP_NAME, "StreamTranscriber")


def transcribe_stream_modal_with_meta(req: TranscribeReq, *, diarize: bool) -> tuple[TranscribeRes, dict]:
    """Returns TranscribeRes plus modal telemetry (cold_start_s, whisper_model)."""
    if not req.audio_url:
        raise StreamModalTranscribeError("no_audio_url")
    model = (req.model or STREAM_WHISPER_MODEL).strip() or STREAM_WHISPER_MODEL
    try:
        cls = _stream_transcriber()
        raw = cls().transcribe.remote(
            req.audio_url,
            req.language,
            req.initial_prompt,
            diarize=diarize,
            whisper_model=model,
        )
    except Exception as exc:
        raise StreamModalTranscribeError(type(exc).__name__) from exc

    raw_word_list = raw.get("words") or []
    words = normalize_words(raw_word_list, offset_ms=req.offset_ms)

    engine = "modal_diarize" if diarize else "modal"
    res = TranscribeRes(
        words=words,
        language=str(raw.get("language") or req.language or "en"),
        duration_s=float(raw.get("duration_s") or 0),
        gpu_seconds=float(raw.get("gpu_seconds") or 0),
        provider=engine,
        transcription_engine=engine,
    )
    meta = {
        "cold_start_s": float(raw.get("cold_start_s") or 0),
        "whisper_model": raw.get("whisper_model") or model,
        "diarized": bool(raw.get("diarized")),
    }
    return res, meta


def log_stream_modal_chunk(
    *,
    vod_id: str,
    chunk_index: int,
    provider: str,
    gpu_seconds: float,
    cold_start_s: float | None = None,
) -> None:
    cost = estimate_modal_cost_usd(gpu_seconds)
    cold = cold_start_s if cold_start_s is not None else 0.0
    print(
        f"[clipper:stream] transcribe_chunk vodId={vod_id} chunk={chunk_index} "
        f"provider={provider} gpuSeconds={gpu_seconds:.2f} coldStartS={cold:.2f} costUsdEst={cost:.4f}",
        file=sys.stderr,
        flush=True,
    )
