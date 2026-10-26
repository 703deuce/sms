"""Project-level transcription via GPU provider abstraction."""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from clips_worker.gpu import transcribe_with_fallback
from clips_worker.gpu.base import TranscribeReq
from clips_worker.storage import sign_url, upload_file


def _extract_opus_16k(src: Path, dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "libopus",
            "-b:a",
            "24k",
            str(dest),
        ],
    )


def transcribe_video_file(
    conn,
    project: dict,
    src: Path,
    model: str | None = None,
) -> list[dict]:
    workspace_id = project["workspaceId"]
    project_id = project["id"]
    provider_name = (os.environ.get("GPU_PROVIDER_TRANSCRIBE") or os.environ.get("GPU_PROVIDER") or "local").lower()

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        opus = td_path / "audio.opus"
        _extract_opus_16k(src, opus)

        if provider_name == "modal":
            audio_key = f"ws/{workspace_id}/projects/{project_id}/audio.opus"
            upload_file(audio_key, opus, "audio/opus")
            url = sign_url(audio_key)
            res = transcribe_with_fallback(
                conn,
                TranscribeReq(audio_url=url, model=model, language=None),
                workspace_id,
                project_id,
            )
        else:
            res = transcribe_with_fallback(
                conn,
                TranscribeReq(audio_path=str(src), model=model, language=None),
                workspace_id,
                project_id,
            )
    return res.words
