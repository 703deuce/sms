from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from clips_worker.gpu.base import (
    FaceTrackReq,
    GpuProvider,
    RenderReq,
    RenderRes,
    TranscribeReq,
    TranscribeRes,
    normalize_words,
)

TRANSCRIBE = Path(os.environ.get("TRANSCRIBE_SCRIPT", "/app/transcribe.py"))


class LocalProvider:
    name = "local"

    def transcribe(self, req: TranscribeReq) -> TranscribeRes:
        if not req.audio_path:
            raise ValueError("local transcribe requires audio_path")
        path = Path(req.audio_path)
        model = req.model or os.environ.get("ASR_MODEL", "small.en")
        words_path = path.parent / f"_words_{path.stem}.json"
        t0 = time.time()
        subprocess.check_call([sys.executable, str(TRANSCRIBE), str(path), str(words_path), model])
        raw = json.loads(words_path.read_text())
        words = normalize_words(raw, offset_ms=req.offset_ms)
        duration_s = max((w["e"] for w in words), default=0.0)
        lang = req.language or "en"
        return TranscribeRes(
            words=words,
            language=lang,
            duration_s=float(duration_s),
            gpu_seconds=0.0,
            provider="local",
        )

    def transcribe_many(self, reqs: list[TranscribeReq]) -> list[TranscribeRes]:
        return [self.transcribe(r) for r in reqs]

    def face_track(self, req: FaceTrackReq) -> dict:
        raise NotImplementedError("local face_track not implemented in S0")

    def render_batch(self, reqs: list[RenderReq]) -> list[RenderRes]:
        raise NotImplementedError("local render_batch not implemented in S0")
