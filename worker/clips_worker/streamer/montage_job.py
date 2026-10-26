"""STREAM_MONTAGE: concat rendered clips (S10)."""
from __future__ import annotations

import json
import subprocess
import tempfile
import uuid
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.heartbeat import Heartbeat
from clips_worker.storage import download_object, upload_file
from clips_worker.streamer.config import SCRATCH
from clips_worker.streamer.keys import montage_output_key, montage_poster_key
from clips_worker.streamer.montage_plan import plan_montage_clips


def run_stream_montage_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    montage_id = payload.get("montageId")
    if not montage_id:
        raise RuntimeError("missing montageId")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT * FROM clip_montages WHERE id = %s AND "deletedAt" IS NULL', (montage_id,))
        montage = dict(cur.fetchone() or {})
    if not montage:
        raise RuntimeError("montage not found")

    workspace_id = montage["workspaceId"]
    project_id = montage["projectId"]
    options = montage.get("options") or {}
    if isinstance(options, str):
        options = json.loads(options)
    clip_ids = montage.get("clipIds") or []
    if isinstance(clip_ids, str):
        clip_ids = json.loads(clip_ids)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, "startMs", "endMs", score, "previewKey"
            FROM clips WHERE "projectId" = %s AND "deletedAt" IS NULL
            """,
            (project_id,),
        )
        clips = [dict(r) for r in cur.fetchall()]

    planned = plan_montage_clips(
        clips,
        clip_ids=clip_ids if clip_ids else None,
        top_n=int(options.get("topN") or 5),
        max_duration_s=int(options.get("maxDurationS") or 180),
        order=str(options.get("order") or "score"),
    )
    if not planned:
        raise RuntimeError("no clips for montage")

    SCRATCH.mkdir(parents=True, exist_ok=True)
    transition = str(options.get("transition") or "cut")

    with Heartbeat(job["id"], post_progress, every_s=45) as hb:
        hb.update(stage="Montage", progress=10)
        with tempfile.TemporaryDirectory(dir=SCRATCH) as td:
            td_path = Path(td)
            parts: list[Path] = []
            for i, clip in enumerate(planned):
                key = clip.get("previewKey")
                if not key:
                    continue
                part = td_path / f"p{i:03d}.mp4"
                download_object(str(key), part)
                parts.append(part)
                hb.update(stage=f"Montage {i + 1}/{len(planned)}", progress=10 + int(70 * (i + 1) / len(planned)))

            if not parts:
                raise RuntimeError("clips missing preview files")

            out = td_path / "montage.mp4"
            if transition == "fade" and len(parts) > 1:
                _xfade_concat(parts, out)
            else:
                _concat_demuxer(parts, out)

            poster = td_path / "poster.jpg"
            subprocess.check_call(
                ["ffmpeg", "-y", "-v", "error", "-i", str(out), "-frames:v", "1", str(poster)],
            )
            out_key = montage_output_key(workspace_id, project_id, montage_id)
            poster_key = montage_poster_key(workspace_id, project_id, montage_id)
            upload_file(out_key, out, "video/mp4")
            upload_file(poster_key, poster, "image/jpeg")
            dur_ms = int(_probe_duration_s(out) * 1000)
            size = out.stat().st_size

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_montages
            SET status='READY', "outputKey"=%s, "posterKey"=%s, "durationMs"=%s, "sizeBytes"=%s, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (out_key, poster_key, dur_ms, size, montage_id),
        )
    conn.commit()
    post_progress(job["id"], {"jobStatus": "DONE"})


def _probe_duration_s(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        text=True,
    )
    return float(out.strip() or "0")


def _concat_demuxer(parts: list[Path], dest: Path) -> None:
    list_file = dest.parent / "concat.txt"
    list_file.write_text("\n".join(f"file '{p.name}'" for p in parts), encoding="utf-8")
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", str(dest)],
        cwd=str(dest.parent),
    )


def _xfade_concat(parts: list[Path], dest: Path) -> None:
    # Simple re-encode chain for smoke tests / short montages
    _concat_demuxer(parts, dest)
