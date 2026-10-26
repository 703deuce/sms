"""Primary Deepgram + existing GPU/local Whisper fallback (Whisper code untouched)."""
from __future__ import annotations

import logging

from clips_worker.deepgram_transcribe import (
    DeepgramTranscribeError,
    TranscribeMeta,
    resolve_transcribe_provider,
    transcribe_deepgram,
)
from clips_worker.gpu import transcribe_with_fallback
from clips_worker.gpu.base import TranscribeReq, TranscribeRes

log = logging.getLogger(__name__)


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
            log.warning("transcribe.deepgram_fallback reason=%s status=%s", reason, exc.status)
            res = transcribe_with_fallback(conn, req, workspace_id, project_id)
            engine = "local_whisper" if res.provider == "local" else res.provider
            meta = TranscribeMeta(transcription_engine=engine, fallback_reason=reason)
            res.transcription_engine = meta.transcription_engine
            res.fallback_reason = meta.fallback_reason
            return res, meta

    res = transcribe_with_fallback(conn, req, workspace_id, project_id)
    engine = "local_whisper" if res.provider == "local" else res.provider
    meta = TranscribeMeta(transcription_engine=engine)
    res.transcription_engine = meta.transcription_engine
    return res, meta
