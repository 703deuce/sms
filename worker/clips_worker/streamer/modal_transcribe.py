"""Modal GPU transcribe for streamer full-VOD (not regular clipper path)."""
from __future__ import annotations

import logging
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

from clips_worker.gpu.base import TranscribeReq, TranscribeRes, normalize_words

log = logging.getLogger(__name__)

APP_NAME = os.environ.get("MODAL_APP_NAME", "transovo-gpu")
STREAM_WHISPER_MODEL = (
    os.environ.get("STREAM_WHISPER_GPU_MODEL") or os.environ.get("WHISPER_GPU_MODEL") or "large-v3-turbo"
).strip()


def stream_modal_timeout_s() -> float:
    try:
        return max(60.0, float(os.environ.get("STREAM_MODAL_TRANSCRIBE_TIMEOUT_S", "180")))
    except ValueError:
        return 180.0


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


def _remote_transcribe(req: TranscribeReq, *, diarize: bool, model: str) -> dict:
    cls = _stream_transcriber()
    return cls().transcribe.remote(
        req.audio_url,
        req.language,
        req.initial_prompt,
        diarize=diarize,
        whisper_model=model,
    )


def transcribe_stream_modal_with_meta(req: TranscribeReq, *, diarize: bool) -> tuple[TranscribeRes, dict]:
    """Returns TranscribeRes plus modal telemetry (cold_start_s, whisper_model)."""
    from clips_worker.decision_log import decision_log

    if not req.audio_url:
        raise StreamModalTranscribeError("no_audio_url")
    model = (req.model or STREAM_WHISPER_MODEL).strip() or STREAM_WHISPER_MODEL
    timeout_s = stream_modal_timeout_s()
    attempts = 0
    last_exc: Exception | None = None
    while attempts < 2:
        attempts += 1
        t0 = time.perf_counter()
        stop = threading.Event()

        def _heartbeat() -> None:
            while not stop.wait(25.0):
                decision_log(
                    "modal_transcribe",
                    "progress",
                    attempt=attempts,
                    elapsed_ms=int((time.perf_counter() - t0) * 1000),
                )

        hb = threading.Thread(target=_heartbeat, name="modal-transcribe-hb", daemon=True)
        decision_log(
            "modal_transcribe",
            "begin",
            attempt=attempts,
            timeout_s=timeout_s,
            diarize=diarize,
            model=model,
        )
        hb.start()
        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                fut = pool.submit(_remote_transcribe, req, diarize=diarize, model=model)
                raw = fut.result(timeout=timeout_s)
        except FuturesTimeout as exc:
            last_exc = StreamModalTranscribeError(f"hard_timeout_{int(timeout_s)}s")
            decision_log(
                "modal_transcribe",
                "end",
                ok=False,
                attempt=attempts,
                elapsed_ms=int((time.perf_counter() - t0) * 1000),
                error=str(last_exc),
            )
            if attempts >= 2:
                stop.set()
                hb.join(timeout=1.0)
                raise last_exc from exc
            stop.set()
            hb.join(timeout=1.0)
            continue
        except Exception as exc:
            last_exc = StreamModalTranscribeError(type(exc).__name__)
            decision_log(
                "modal_transcribe",
                "end",
                ok=False,
                attempt=attempts,
                elapsed_ms=int((time.perf_counter() - t0) * 1000),
                error=str(last_exc)[:180],
            )
            stop.set()
            hb.join(timeout=1.0)
            raise last_exc from exc
        finally:
            stop.set()
            hb.join(timeout=1.0)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        cold = float(raw.get("cold_start_s") or 0)
        decision_log(
            "modal_transcribe",
            "end",
            ok=True,
            attempt=attempts,
            elapsed_ms=elapsed_ms,
            cold_start_s=round(cold, 2),
            gpu_seconds=float(raw.get("gpu_seconds") or 0),
        )
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
            "cold_start_s": cold,
            "whisper_model": raw.get("whisper_model") or model,
            "diarized": bool(raw.get("diarized")),
            "elapsed_ms": elapsed_ms,
        }
        return res, meta
    raise StreamModalTranscribeError(str(last_exc or "modal_failed"))


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
