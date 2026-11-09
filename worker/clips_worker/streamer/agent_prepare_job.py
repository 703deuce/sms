"""Prepare a short, real VIDEO window from an authorized Twitch/Kick VOD.

The existing streamer ingestion is deliberately audio-first. AI Producer's
Gemini video observer must receive an actual source MP4, so prepare one
bounded window, rebase ASR to video-local time and never fetch the full VOD.
"""
from __future__ import annotations

import json
import tempfile
import uuid
from pathlib import Path

from clips_worker.import_url import probe_video, upload_source_key
from clips_worker.storage import upload_file, download_object
from clips_worker.streamer.ytdlp import download_video


MAX_WINDOW_MS = 20 * 60_000


def rebase_window_words(raw, start_ms: int, end_ms: int) -> list[dict]:
    if isinstance(raw, str):
        raw = json.loads(raw)
    if isinstance(raw, dict):
        raw = raw.get("words") or raw.get("segments") or []
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for word in raw:
        if not isinstance(word, dict):
            continue
        try:
            s, e = float(word["s"]), float(word["e"])
        except (ValueError, TypeError, KeyError):
            continue
        if not (e > s and e * 1000 > start_ms and s * 1000 < end_ms):
            continue
        # Word-local offsets must match t=0 of the newly downloaded MP4.
        a = dict(word)
        a["s"] = max(0, s - start_ms / 1000)
        a["e"] = min((end_ms - start_ms) / 1000, e - start_ms / 1000)
        if a["e"] > a["s"]:
            out.append(a)
    for index, word in enumerate(out):
        word["i"] = index
    return out


def run_stream_agent_prepare_job(conn, job: dict, post_progress) -> None:
    from psycopg2.extras import RealDictCursor
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    project_id = str(job["projectId"])
    parent_id = str(payload.get("parentProjectId") or "")
    start_ms = int(payload.get("rangeStartMs") or 0)
    end_ms = int(payload.get("rangeEndMs") or 0)
    if not parent_id or start_ms < 0 or end_ms - start_ms < 15_000 or end_ms - start_ms > MAX_WINDOW_MS:
        raise ValueError("stream_agent_invalid_window")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT p."workspaceId",p."rangeStartMs",p."rangeEndMs",p."transcriptWords",p."transcriptKey",
                   p.status,v.url,v.platform
            FROM clip_projects p JOIN stream_vods v ON v."projectId"=p.id
            WHERE p.id=%s AND p."deletedAt" IS NULL
        """, (parent_id,))
        parent = cur.fetchone()
        cur.execute('SELECT "workspaceId" FROM clip_projects WHERE id=%s AND "deletedAt" IS NULL', (project_id,))
        child = cur.fetchone()
    if not parent or not child or child["workspaceId"] != parent["workspaceId"]:
        raise ValueError("stream_agent_source_not_owned")
    if parent["status"] != "READY":
        raise ValueError("stream_agent_source_not_ready")
    if start_ms < int(parent["rangeStartMs"] or 0) or end_ms > int(parent["rangeEndMs"] or 0):
        raise ValueError("stream_agent_window_outside_vod")
    url = parent["url"]
    if not url or parent["platform"] not in ("twitch", "kick"):
        raise ValueError("stream_agent_vod_url_unavailable")

    # No full-VOD copy on disk: yt-dlp downloads exactly this bounded section.
    with tempfile.TemporaryDirectory(prefix="stream_agent_") as td:
        dest = Path(td) / "source.mp4"
        section = f"*{start_ms/1000:.3f}-{end_ms/1000:.3f}"
        post_progress(job["id"], {"stage": "Downloading selected video window", "progress": 15})
        download_video(url, str(dest), section=section, workdir=td)
        if not dest.is_file() or dest.stat().st_size == 0:
            raise RuntimeError("stream_agent_video_window_download_missing")
        duration_s, width, height = probe_video(dest)
        duration_ms = int(round(duration_s * 1000))
        if duration_ms < 12_000 or duration_ms > MAX_WINDOW_MS + 10_000:
            raise RuntimeError("stream_agent_window_duration_invalid")
        # STREAM_ANALYZE stores ASR in the source media's local timebase.
        # A manually trimmed or rolling VOD can begin at nonzero absolute ms.
        source_base_ms = int(parent["rangeStartMs"] or 0)
        original_words = parent["transcriptWords"]
        if not original_words and parent.get("transcriptKey"):
            transcript_path = Path(td) / "original_words.json"
            download_object(str(parent["transcriptKey"]), transcript_path)
            original_words = json.loads(transcript_path.read_text(encoding="utf-8"))
        words = rebase_window_words(
            original_words,start_ms-source_base_ms,end_ms-source_base_ms
        )
        # Clip specialists can use actual observed video events without spoken
        # dialogue. Empty ASR is not a reason to discard the prepared footage;
        # the clip-only source-time validation requires real Gemini observations.
        upload_id = f"upl_{uuid.uuid4().hex}"
        key = upload_source_key(str(parent["workspaceId"]), upload_id, "mp4")
        upload_file(key, dest, "video/mp4")
        post_progress(job["id"], {"stage": "Preparing agent transcript", "progress": 85})
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO clip_uploads (id,"workspaceId",key,filename,bytes,mime,"durationMs",width,height,status,"createdAt")
                VALUES (%s,%s,%s,%s,%s,'video/mp4',%s,%s,%s,'COMPLETE',NOW())
            """, (upload_id, parent["workspaceId"], key, "stream_agent_window.mp4",
                  dest.stat().st_size, duration_ms, width, height))
            cur.execute("""
                UPDATE clip_projects
                SET "uploadId"=%s,"rangeStartMs"=0,"rangeEndMs"=%s,
                    "transcriptWords"=%s::jsonb,status='READY',stage='Agent source ready',
                    progress=100,"updatedAt"=NOW()
                WHERE id=%s
            """, (upload_id, duration_ms, json.dumps(words), project_id))
        conn.commit()
    post_progress(job["id"], {"stage": "Agent source ready", "progress": 100})
