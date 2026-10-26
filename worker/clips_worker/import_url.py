"""IMPORT_URL job: download public Drive / Dropbox links into clip storage."""
from __future__ import annotations

import json
import subprocess
import tempfile
import uuid
import urllib.request
from pathlib import Path

from clips_worker.import_url_parse import (
    DRIVE_PUBLIC_MSG,
    UNSUPPORTED_MSG,
    YOUTUBE_UNSUPPORTED,
    classify_url,
    drive_download_url,
    normalize_dropbox_url,
    parse_drive_file_id,
)
from clips_worker.probe import probe_duration
from clips_worker.storage import upload_file

MAX_BYTES = 4 * 1024 * 1024 * 1024
MAX_DURATION_S = 3 * 3600


def _looks_like_html(head: bytes, content_type: str) -> bool:
    ct = (content_type or "").lower()
    if "text/html" in ct:
        return True
    sample = head[:512].lstrip().lower()
    return sample.startswith(b"<!doctype") or sample.startswith(b"<html")


def _download_http(url: str, dest: Path, max_bytes: int = MAX_BYTES) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "TransovoClipsImport/1.0"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        ct = resp.headers.get("Content-Type", "")
        chunk = resp.read(8192)
        if _looks_like_html(chunk, ct):
            raise RuntimeError(DRIVE_PUBLIC_MSG)
        total = len(chunk)
        with dest.open("wb") as f:
            f.write(chunk)
            while True:
                more = resp.read(1024 * 1024)
                if not more:
                    break
                total += len(more)
                if total > max_bytes:
                    raise RuntimeError("File exceeds 4GB limit")
                f.write(more)


def probe_video(path: Path) -> tuple[float, int | None, int | None]:
    dur = probe_duration(path)
    try:
        out = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "json",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        data = json.loads(out)
        streams = data.get("streams") or []
        if not streams:
            raise RuntimeError("No video stream found")
        w = streams[0].get("width")
        h = streams[0].get("height")
        return dur, int(w) if w else None, int(h) if h else None
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or exc.stdout or str(exc)).strip()
        raise RuntimeError(f"Invalid video file: {err[:300]}") from exc


def download_import_source(source_url: str, dest: Path) -> str:
    kind = classify_url(source_url)
    if kind == "youtube":
        raise RuntimeError(YOUTUBE_UNSUPPORTED)
    if kind == "unsupported":
        raise RuntimeError(UNSUPPORTED_MSG)
    if kind == "drive":
        file_id = parse_drive_file_id(source_url)
        if not file_id:
            raise RuntimeError("Could not read Google Drive file id from this link.")
        _download_http(drive_download_url(file_id), dest)
        return "imported.mp4"
    if kind == "dropbox":
        _download_http(normalize_dropbox_url(source_url), dest)
        return "imported.mp4"
    raise RuntimeError(UNSUPPORTED_MSG)


def upload_source_key(workspace_id: str, upload_id: str, ext: str) -> str:
    return f"ws/{workspace_id}/uploads/{upload_id}/source.{ext}"


def run_import_url_job(conn, job: dict, project: dict, post_progress) -> None:
    source_url = project.get("sourceUrl") or ""
    if not source_url:
        raise RuntimeError("Missing import URL")

    post_progress(
        job["id"],
        {
            "projectStatus": "QUEUED",
            "stage": "importing",
            "progress": 3,
            "jobStatus": "RUNNING",
        },
    )

    workspace_id = project["workspaceId"]
    project_id = project["id"]
    with tempfile.TemporaryDirectory() as td:
        dest = Path(td) / "source.mp4"
        filename = download_import_source(source_url, dest)
        post_progress(job["id"], {"projectStatus": "QUEUED", "stage": "importing", "progress": 25})

        dur_s, width, height = probe_video(dest)
        if dur_s > MAX_DURATION_S:
            raise RuntimeError("Video exceeds 3 hour limit")
        size = dest.stat().st_size
        if size > MAX_BYTES:
            raise RuntimeError("File exceeds 4GB limit")

        upload_id = f"upl_{uuid.uuid4().hex}"
        ext = "mp4"
        key = upload_source_key(workspace_id, upload_id, ext)
        upload_file(key, dest, "video/mp4")
        post_progress(job["id"], {"projectStatus": "QUEUED", "stage": "importing", "progress": 70})

        duration_ms = int(round(dur_s * 1000))
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO clip_uploads (id, "workspaceId", key, filename, bytes, mime, "durationMs", width, height, status, "createdAt")
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'COMPLETE',NOW())
                """,
                (upload_id, workspace_id, key, filename, size, "video/mp4", duration_ms, width, height),
            )
            cur.execute(
                """
                UPDATE clip_projects
                SET "uploadId"=%s, "rangeEndMs"=GREATEST("rangeEndMs", %s), stage='queued', progress=5, "updatedAt"=NOW()
                WHERE id=%s
                """,
                (upload_id, duration_ms, project_id),
            )
            proc_id = f"job_{uuid.uuid4().hex}"
            cur.execute(
                """
                INSERT INTO clip_jobs (id, "projectId", type, status, payload, "createdAt")
                VALUES (%s,%s,'PROCESS_PROJECT','QUEUED','{}'::jsonb,NOW())
                """,
                (proc_id, project_id),
            )
        conn.commit()

        post_progress(
            job["id"],
            {"projectStatus": "QUEUED", "stage": "queued", "progress": 8, "jobStatus": "DONE"},
        )
