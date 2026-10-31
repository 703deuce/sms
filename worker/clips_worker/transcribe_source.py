"""Project-level transcription via GPU provider abstraction."""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from clips_worker.gpu.base import TranscribeReq
from clips_worker.storage import sign_url, upload_file
from clips_worker.transcribe_provider import TranscribeMeta, transcribe_audio_request


def _extract_opus_16k(src: Path, dest: Path) -> None:
    from clips_worker.audio_extract import audio_extract_cmd

    # T6.7: timestamp-aligned (gaps / late audio start padded) so words match the video.
    subprocess.check_call(audio_extract_cmd(src, dest, codec="libopus", bitrate="24k"))


def transcribe_video_file(
    conn,
    project: dict,
    src: Path,
    model: str | None = None,
) -> tuple[list[dict], TranscribeMeta]:
    workspace_id = project["workspaceId"]
    project_id = project["id"]
    provider_name = (os.environ.get("GPU_PROVIDER_TRANSCRIBE") or os.environ.get("GPU_PROVIDER") or "local").lower()

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        opus = td_path / "audio.opus"
        _extract_opus_16k(src, opus)

        req: TranscribeReq
        if provider_name == "modal":
            audio_key = f"ws/{workspace_id}/projects/{project_id}/audio.opus"
            upload_file(audio_key, opus, "audio/opus")
            url = sign_url(audio_key)
            req = TranscribeReq(audio_url=url, audio_path=str(opus), model=model, language=None)
        else:
            req = TranscribeReq(audio_path=str(opus), model=model, language=None)

        res, meta = transcribe_audio_request(conn, req, workspace_id, project_id)
    return res.words, meta
