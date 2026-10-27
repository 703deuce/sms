"""STUDIO_SOUND job: extract project audio, ElevenLabs isolation, upload."""
from __future__ import annotations

import json
import subprocess
import tempfile
import uuid
from decimal import Decimal
from pathlib import Path

from clips_worker.elevenlabs_isolation import isolate_audio_file, isolation_cost_micros
from clips_worker.storage import download_object, upload_file


def _probe_duration_sec(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return max(0.1, float(out or "1"))


def _extract_audio(video: Path, wav: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "44100",
            "-ac",
            "1",
            str(wav),
        ],
    )


def run_studio_sound_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    generation_id = payload.get("generationId")
    project_id = job.get("projectId")
    if not generation_id or not project_id:
        raise RuntimeError("missing generationId/projectId")

    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "workspaceId", status, params FROM ai_generations WHERE id=%s',
            (generation_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("generation not found")
    gen_id, workspace_id, status, params = row
    if status == "READY":
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
        return

    if isinstance(params, str):
        params = json.loads(params)
    params = params or {}
    source_key = params.get("sourceKey")
    if not source_key:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.key FROM clip_projects p
                JOIN clip_uploads u ON u.id = p."uploadId"
                WHERE p.id = %s
                """,
                (project_id,),
            )
            urow = cur.fetchone()
        source_key = urow[0] if urow else None
    if not source_key:
        raise RuntimeError("missing source media for studio sound")

    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "studio_sound", "progress": 10})
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE ai_generations SET status=%s, "updatedAt"=NOW() WHERE id=%s',
            ("RUNNING", generation_id),
        )
    conn.commit()

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        src = td_path / "source.mp4"
        wav = td_path / "speech.wav"
        iso_mp3 = td_path / "isolated.mp3"
        download_object(source_key, src)
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "extract", "progress": 25})
        _extract_audio(src, wav)
        dur_sec = _probe_duration_sec(wav)
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "isolate", "progress": 45})
        iso_bytes = isolate_audio_file(wav)
        iso_mp3.write_bytes(iso_bytes)
        storage_key = f"ws/{workspace_id}/projects/{project_id}/studio-sound/{generation_id}.mp3"
        upload_file(storage_key, iso_mp3, "audio/mpeg")

    cost_usd = Decimal(isolation_cost_micros(dur_sec)) / Decimal(1_000_000)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ai_generations
            SET status=%s, "storageKey"=%s, "costUsd"=%s, "updatedAt"=NOW()
            WHERE id=%s
            """,
            ("READY", storage_key, cost_usd, generation_id),
        )
        cur.execute(
            """
            INSERT INTO ai_usage (id, "workspaceId", "projectId", "generationId", provider, model, units, "unitType", "costUsdMicros", "createdAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                f"aiu_{uuid.uuid4().hex}",
                workspace_id,
                project_id,
                generation_id,
                "elevenlabs",
                "audio-isolation",
                dur_sec,
                "seconds",
                isolation_cost_micros(dur_sec),
            ),
        )
    conn.commit()
    post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
