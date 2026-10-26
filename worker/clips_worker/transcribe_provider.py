"""Primary Deepgram + existing GPU/local Whisper fallback (Whisper code untouched)."""
from __future__ import annotations

import logging
import sys

from clips_worker.deepgram_transcribe import (
    DeepgramTranscribeError,
    TranscribeMeta,
    deepgram_api_key,
    resolve_transcribe_provider,
    transcribe_deepgram,
)
from clips_worker.gpu import transcribe_with_fallback
from clips_worker.gpu.base import TranscribeReq, TranscribeRes

log = logging.getLogger(__name__)


def _warn_transcribe(msg: str) -> None:
    """Visible in docker logs (logging may not be configured to stdout)."""
    print(msg, file=sys.stderr, flush=True)
    log.warning("%s", msg)


def transcribe_audio_request(
    conn,
    req: TranscribeReq,
    workspace_id: str,
    project_id: str,
) -> tuple[TranscribeRes, TranscribeMeta]:
    if resolve_transcribe_provider() == "deepgram":
        try:
            res = transcribe_deepgram(req)
            meta = TranscribeMeta(transcription_engine="deepgram")
            res.transcription_engine = meta.transcription_engine
            return res, meta
        except DeepgramTranscribeError as exc:
            reason = exc.reason
            _warn_transcribe(f"WARN transcribe.deepgram_fallback reason={reason} status={exc.status}")
            res = transcribe_with_fallback(conn, req, workspace_id, project_id)
            engine = "local_whisper" if res.provider == "local" else res.provider
            meta = TranscribeMeta(transcription_engine=engine, fallback_reason=reason)
            res.transcription_engine = meta.transcription_engine
            res.fallback_reason = meta.fallback_reason
            return res, meta

    if not deepgram_api_key():
        _warn_transcribe(
            "WARN transcribe.deepgram_skipped reason=no_api_key_in_process_env "
            "(worker container needs recreate after worker.env update; docker restart does not reload --env-file)"
        )
    res = transcribe_with_fallback(conn, req, workspace_id, project_id)
    engine = "local_whisper" if res.provider == "local" else res.provider
    meta = TranscribeMeta(transcription_engine=engine, fallback_reason="no_api_key_in_process_env" if not deepgram_api_key() else None)
    res.transcription_engine = meta.transcription_engine
    if meta.fallback_reason:
        res.fallback_reason = meta.fallback_reason
    return res, meta
