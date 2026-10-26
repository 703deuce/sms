#!/usr/bin/env python3
"""Prod E2E: 25m upload streamer import (run inside clips-worker container on coolify-server)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import psycopg2


def main() -> int:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL required", file=sys.stderr)
        return 1
    workspace_id = os.environ.get("TRANSOVO_WORKSPACE_ID") or os.environ.get("DEV_WORKSPACE_ID")
    if not workspace_id:
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT id FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1')
                row = cur.fetchone()
                workspace_id = row[0] if row else None
    if not workspace_id:
        print("No workspace", file=sys.stderr)
        return 1

    scratch = Path("/tmp/streamer_e2e")
    scratch.mkdir(parents=True, exist_ok=True)
    video = scratch / "long_cc_25m.mp4"
    if not video.exists() or video.stat().st_size < 1_000_000:
        print("Generating 25m test video (720p, tone + testsrc)...")
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "testsrc=size=1280x720:rate=30",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:sample_rate=48000",
                "-t",
                "1260",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-crf",
                "28",
                "-c:a",
                "aac",
                "-shortest",
                str(video),
            ]
        )

    from clips_worker.storage import upload_file

    upload_id = f"upl_{uuid.uuid4().hex}"
    project_id = f"proj_{uuid.uuid4().hex}"
    vod_id = f"svod_{uuid.uuid4().hex}"
    key = f"ws/{workspace_id}/uploads/{upload_id}/source.mp4"
    upload_file(key, video, "video/mp4")
    duration_ms = 1260 * 1000

    transcript_key = f"ws/{workspace_id}/projects/{project_id}/transcript.json"
    from clips_worker.streamer.keys import stream_audio_key

    audio_path = scratch / "audio.opus"
    print("Extracting audio for long-VOD analyze path...")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-vn",
            "-c:a",
            "libopus",
            "-b:a",
            "64k",
            str(audio_path),
        ]
    )
    audio_key = stream_audio_key(workspace_id, vod_id)
    upload_file(audio_key, audio_path, "audio/opus")
    vod_state = {"audioKey": audio_key}

    job_analyze = f"job_{uuid.uuid4().hex}"

    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO clip_uploads (id, "workspaceId", key, filename, bytes, status, "durationMs", "createdAt", "updatedAt")
                VALUES (%s,%s,%s,%s,%s,'COMPLETE',%s,NOW(),NOW())
                """,
                (upload_id, workspace_id, key, "long_cc_25m.mp4", video.stat().st_size, duration_ms),
            )
            cur.execute(
                """
                INSERT INTO clip_projects (id, "workspaceId", title, "uploadId", settings, "rangeStartMs", "rangeEndMs",
                  status, stage, progress, "transcriptKey", "createdAt", "updatedAt")
                VALUES (%s,%s,%s,%s,%s::jsonb,0,%s,'QUEUED','queued',0,%s,NOW(),NOW())
                """,
                (
                    project_id,
                    workspace_id,
                    "E2E streamer 25m CC test",
                    upload_id,
                    json.dumps({"aspectRatio": "9:16", "genre": "gaming", "streamer": {"clipCount": 8}}),
                    duration_ms,
                    transcript_key,
                ),
            )
            cur.execute(
                """
                INSERT INTO stream_vods (id, "workspaceId", "projectId", platform, "sourceType", "triggeredBy",
                  "durationMs", "rangeStartMs", "rangeEndMs", state, "attestedAt", "createdAt", "updatedAt")
                VALUES (%s,%s,%s,'upload','upload','upload',%s,0,%s,%s::jsonb,NOW(),NOW(),NOW())
                """,
                (vod_id, workspace_id, project_id, duration_ms, duration_ms, json.dumps(vod_state)),
            )
            cur.execute(
                """
                UPDATE clip_projects SET status='TRANSCRIBING', stage='Transcribing', progress=22, "updatedAt"=NOW()
                WHERE id=%s
                """,
                (project_id,),
            )
            cur.execute(
                """
                INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,10,NOW())
                """,
                (job_analyze, project_id, json.dumps({"vodId": vod_id})),
            )
        conn.commit()

    print(
        json.dumps(
            {
                "workspaceId": workspace_id,
                "projectId": project_id,
                "vodId": vod_id,
                "uploadId": upload_id,
                "jobAnalyze": job_analyze,
                "durationMin": 25,
                "startedAt": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
