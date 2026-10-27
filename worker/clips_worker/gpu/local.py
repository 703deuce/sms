from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
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
        from clips_worker.render_concurrency import ffmpeg_threads_per_job

        out: list[RenderRes] = []
        threads = str(ffmpeg_threads_per_job())
        for req in reqs:
            t0 = time.perf_counter()
            ok = False
            size_bytes = 0
            try:
                with tempfile.TemporaryDirectory() as td:
                    td_path = Path(td)
                    src = td_path / "in.mp4"
                    dest = td_path / "out.mp4"
                    if req.segment_url:
                        urllib.request.urlretrieve(req.segment_url, src)
                    else:
                        raise ValueError("local render requires segment_url")
                    vcodec = "libx264"
                    extra: list[str] = ["-crf", "20", "-preset", "veryfast"]
                    if req.filter_complex:
                        fg = req.filtergraph or ""
                        cmd = [
                            "ffmpeg",
                            "-y",
                            "-threads",
                            threads,
                            "-v",
                            "error",
                            "-i",
                            str(src),
                            "-filter_complex",
                            fg,
                            "-map",
                            "[vfinal]",
                            "-map",
                            "0:a?",
                            "-c:v",
                            vcodec,
                            *extra,
                            "-c:a",
                            "aac",
                            "-movflags",
                            "+faststart",
                            str(dest),
                        ]
                    else:
                        vf = req.filtergraph or "scale=720:1280"
                        cmd = [
                            "ffmpeg",
                            "-y",
                            "-threads",
                            threads,
                            "-v",
                            "error",
                            "-i",
                            str(src),
                            "-vf",
                            vf,
                            "-c:v",
                            vcodec,
                            *extra,
                            "-c:a",
                            "aac",
                            "-movflags",
                            "+faststart",
                            str(dest),
                        ]
                    subprocess.check_call(cmd)
                    data = dest.read_bytes()
                    size_bytes = len(data)
                    if req.out_upload_url:
                        upload_req = urllib.request.Request(
                            req.out_upload_url,
                            data=data,
                            method="PUT",
                            headers={"Content-Type": "video/mp4"},
                        )
                        urllib.request.urlopen(upload_req, timeout=600)
                    ok = True
            except Exception:
                ok = False
            render_ms = (time.perf_counter() - t0) * 1000.0
            out.append(
                RenderRes(
                    ok=ok,
                    size_bytes=size_bytes,
                    gpu_seconds=0.0,
                    provider="local",
                    render_ms=render_ms,
                    clip_id=req.clip_id,
                )
            )
        return out
