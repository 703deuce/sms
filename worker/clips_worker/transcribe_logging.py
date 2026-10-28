"""Shared transcribe decision logging (Modal / Deepgram / fallback)."""
from __future__ import annotations

import time
from typing import Any

from clips_worker.gpu.base import TranscribeReq, TranscribeRes


def log_transcribe_end(*, provider: str, elapsed_ms: int, **extra: Any) -> None:
    from clips_worker.decision_log import decision_log

    decision_log(
        "transcribe",
        "transcribe_end",
        provider=str(provider)[:40],
        elapsed_ms=int(elapsed_ms),
        **{k: v for k, v in extra.items() if k not in ("api_key", "DEEPGRAM_API_KEY")},
    )


def log_transcribe_fallback(
    *,
    from_provider: str,
    to_provider: str,
    reason: str,
    elapsed_ms: int,
) -> None:
    from clips_worker.decision_log import decision_log

    decision_log(
        "transcribe",
        "transcribe_fallback",
        **{
            "from": str(from_provider)[:20],
            "to": str(to_provider)[:20],
            "reason": str(reason)[:200],
            "elapsed_ms": int(elapsed_ms),
        },
    )


def transcribe_deepgram_with_logs(
    req: TranscribeReq,
    *,
    model: str | None = None,
    context: str = "stream",
) -> TranscribeRes:
    from clips_worker.deepgram_transcribe import transcribe_deepgram

    t0 = time.perf_counter()
    res = transcribe_deepgram(req, model=model) if model else transcribe_deepgram(req)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    res.provider = "deepgram"
    res.transcription_engine = "deepgram"
    log_transcribe_end(provider="deepgram", elapsed_ms=elapsed_ms, context=context)
    return res
