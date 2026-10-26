"""Per-chunk transcribe with retries (failed chunk only, never full job restart)."""
from __future__ import annotations

import random
import time

from clips_worker.gpu.base import TranscribeReq
from clips_worker.transcribe_provider import transcribe_audio_request
from clips_worker.streamer.errors import RetryableError

MAX_CHUNK_ATTEMPTS = 5


def transcribe_chunk_with_retry(
    conn,
    req: TranscribeReq,
    workspace_id: str,
    project_id: str,
    chunk_index: int,
    prior_attempts: int = 0,
):
    delay = 2.0
    attempt = prior_attempts
    last_exc: Exception | None = None
    while attempt < MAX_CHUNK_ATTEMPTS:
        try:
            res, _meta = transcribe_audio_request(conn, req, workspace_id, project_id)
            return res
        except Exception as exc:
            last_exc = exc
            attempt += 1
            if attempt >= MAX_CHUNK_ATTEMPTS:
                break
            time.sleep(delay + random.uniform(0, 1))
            delay = min(60.0, delay * 2)
    raise RetryableError(f"chunk {chunk_index} transcribe failed after {attempt} tries: {last_exc}")
