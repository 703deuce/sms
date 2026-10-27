"""DUB worker job: render clip → ElevenLabs dubbing → m4a + words."""
from __future__ import annotations

import json
import subprocess
import tempfile
import uuid
from pathlib import Path

from clips_worker.dub_srt import parse_srt_to_words
from clips_worker.edits_render import normalize_edits, render_edited_clip
from clips_worker.elevenlabs_dub import (
    create_dubbing,
    download_dub_audio,
    download_dub_transcript_srt,
    poll_dubbing,
)
from clips_worker.render_clip import ffmpeg_cut
from clips_worker.render_job import load_source_words, settings_with_clip_ai_meta
from clips_worker.storage import download_object, upload_file

DUB_COST_MICROS_PER_MIN = int(0.50 * 1_000_000)


def run_dub_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    dub_id = payload.get("dubTrackId")
    if not dub_id:
        raise RuntimeError("missing dubTrackId")

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT d.id, d."clipId", d."targetLang", d.status,
                   c."projectId", c."workspaceId", c."startMs", c."endMs", c.edits, c."aiMeta",
                   p.settings, p."transcriptKey", p."transcriptWords", u.key AS source_key
            FROM dub_tracks d
            JOIN clips c ON c.id = d."clipId"
            JOIN clip_projects p ON p.id = c."projectId"
            LEFT JOIN clip_uploads u ON u.id = p."uploadId"
            WHERE d.id = %s
            """,
            (dub_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("dub track not found")
    (
        track_id,
        clip_id,
        target_lang,
        status,
        project_id,
        workspace_id,
        start_ms,
        end_ms,
        edits,
        ai_meta,
        settings,
        tkey,
        twords,
        source_key,
    ) = row
    if status == "READY":
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
        return

    clip_start, clip_end = int(start_ms), int(end_ms)
    edits = normalize_edits(edits, clip_start, clip_end)
    settings = settings if isinstance(settings, dict) else json.loads(settings or "{}")
    settings = settings_with_clip_ai_meta(settings, ai_meta)
    duration_s = max(1.0, (clip_end - clip_start) / 1000.0)

    with conn.cursor() as cur:
        cur.execute('UPDATE dub_tracks SET status=%s, error=NULL WHERE id=%s', ("RUNNING", track_id))
    conn.commit()
    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "dub_render", "progress": 15})

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        if not source_key:
            raise RuntimeError("missing source")
        src = td_path / "source.mp4"
        download_object(source_key, src)
        clip_file = td_path / "clip.mp4"
        ffmpeg_cut(src, clip_file, clip_start, clip_end)
        words = load_source_words(
            {
                "clipId": clip_id,
                "workspaceId": workspace_id,
                "projectId": project_id,
                "startMs": clip_start,
                "transcriptKey": tkey,
                "transcriptWords": twords,
            },
            td_path,
        )
        edited = td_path / "edited.mp4"
        render_edited_clip(
            clip_file,
            edited,
            words,
            edits,
            clip_start,
            clip_end,
            {**settings, "captions": {"enabled": False}},
            td_path,
            broll_specs=None,
            audio_assets=None,
        )
        dub_src = td_path / "dub_src.mp4"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(edited),
                "-vf",
                "scale=-2:720",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "aac",
                str(dub_src),
            ],
        )

        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "dub_upload", "progress": 35})
        provider_id = create_dubbing(dub_src, target_lang=target_lang, name=clip_id)
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE dub_tracks SET "providerDubId"=%s WHERE id=%s',
                (provider_id, track_id),
            )
        conn.commit()

        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "dub_poll", "progress": 50})
        poll_dubbing(provider_id)

        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "dub_download", "progress": 80})
        audio_bytes = download_dub_audio(provider_id, target_lang)
        raw_audio = td_path / "dub_raw.bin"
        raw_audio.write_bytes(audio_bytes)
        m4a = td_path / "dub.m4a"
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-i", str(raw_audio), "-c:a", "aac", str(m4a)],
        )
        srt_text = download_dub_transcript_srt(provider_id, target_lang)
        srt_path = td_path / "dub.srt"
        srt_path.write_text(srt_text, encoding="utf-8")
        dub_words = parse_srt_to_words(srt_text)

        audio_key = f"ws/{workspace_id}/clips/{clip_id}/dub/{track_id}.m4a"
        srt_key = f"ws/{workspace_id}/clips/{clip_id}/dub/{track_id}.srt"
        upload_file(audio_key, m4a, "audio/mp4")
        upload_file(srt_key, srt_path, "application/x-subrip")

        cost_micros = int(round((duration_s / 60.0) * DUB_COST_MICROS_PER_MIN))
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE dub_tracks
                SET status=%s, "audioKey"=%s, "srtKey"=%s, words=%s, "costUsdMicros"=%s, error=NULL
                WHERE id=%s
                """,
                ("READY", audio_key, srt_key, json.dumps(dub_words), cost_micros, track_id),
            )
            cur.execute(
                """
                INSERT INTO ai_usage (id, "workspaceId", "clipId", provider, model, units, "unitType", "costUsdMicros", "createdAt")
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                """,
                (
                    f"aiu_{uuid.uuid4().hex}",
                    workspace_id,
                    clip_id,
                    "elevenlabs",
                    "dubbing_v1",
                    duration_s,
                    "seconds",
                    cost_micros,
                ),
            )
        conn.commit()

    post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
