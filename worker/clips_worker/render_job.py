"""RENDER_CLIP job: apply edits and upload render output."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.edits_render import is_default_edits, normalize_edits, render_edited_clip
from clips_worker.render_clip import ffmpeg_cut
from clips_worker.storage import download_object, upload_file


def load_render_context(conn, render_id: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT r.id AS render_id, r."clipId", r."workspaceId",
                   r.status, r."outputKey", r."editsVersionHash",
                   c."startMs", c."endMs", c."previewKey", c.edits, c."projectId",
                   p.settings, p."transcriptKey", p."transcriptWords", u.key AS source_key
            FROM clip_renders r
            JOIN clips c ON c.id = r."clipId"
            JOIN clip_projects p ON p.id = c."projectId"
            LEFT JOIN clip_uploads u ON u.id = p."uploadId"
            WHERE r.id = %s
            """,
            (render_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("render not found")
    return dict(row)


def mark_render(
    conn,
    render_id: str,
    status: str,
    output_key: str | None = None,
    size_bytes: int | None = None,
    error: str | None = None,
    srt_key: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_renders
            SET status = %s,
                "outputKey" = COALESCE(%s, "outputKey"),
                "sizeBytes" = COALESCE(%s, "sizeBytes"),
                error = %s,
                "srtKey" = COALESCE(%s, "srtKey"),
                "updatedAt" = NOW()
            WHERE id = %s
            """,
            (status, output_key, size_bytes, error, srt_key, render_id),
        )
    conn.commit()


def upload_text(object_key: str, body: str, content_type: str = "text/plain") -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(body)
        tmp = Path(f.name)
    try:
        upload_file(object_key, tmp, content_type)
    finally:
        tmp.unlink(missing_ok=True)


def load_source_words(ctx: dict, work_dir: Path) -> list[dict]:
    words: list[dict] = []
    if ctx.get("transcriptKey"):
        try:
            p = work_dir / "transcript.json"
            download_object(ctx["transcriptKey"], p)
            words = json.loads(p.read_text())
        except Exception:
            words = []
    if not words and ctx.get("transcriptWords"):
        tw = ctx["transcriptWords"]
        if isinstance(tw, str):
            tw = json.loads(tw)
        words = list(tw) if isinstance(tw, list) else []
    if not words:
        clip_id = ctx["clipId"]
        workspace_id = ctx["workspaceId"]
        project_id = ctx["projectId"]
        words_key = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/words.json"
        p = work_dir / "clip_words.json"
        download_object(words_key, p)
        clip_words = json.loads(p.read_text())
        start = int(ctx["startMs"])
        words = [{**w, "s": w["s"] + start / 1000.0, "e": w["e"] + start / 1000.0} for w in clip_words]
    out = []
    for pos, w in enumerate(words):
        wi = w.get("i", w.get("idx", pos))
        out.append({**w, "i": int(wi)})
    return out


def run_render_clip_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    render_id = payload.get("renderId")
    if not render_id:
        raise RuntimeError("missing renderId")

    ctx = load_render_context(conn, render_id)
    mark_render(conn, render_id, "RENDERING")
    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 10})

    clip_start = int(ctx["startMs"])
    clip_end = int(ctx["endMs"])
    edits = normalize_edits(ctx["edits"], clip_start, clip_end)
    settings = ctx["settings"] or {}
    if isinstance(settings, str):
        settings = json.loads(settings)

    preview_key = ctx["previewKey"]
    if is_default_edits(edits, clip_start, clip_end) and preview_key:
        tmp = Path(tempfile.mkdtemp()) / "probe.mp4"
        try:
            download_object(preview_key, tmp)
            size = tmp.stat().st_size
        finally:
            tmp.unlink(missing_ok=True)
        mark_render(conn, render_id, "READY", preview_key, size, None, None)
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
        return

    source_key = ctx["source_key"]
    if not source_key:
        raise RuntimeError("missing source")

    workspace_id = ctx["workspaceId"]
    project_id = ctx["projectId"]
    clip_id = ctx["clipId"]

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        src = td_path / "source.mp4"
        download_object(source_key, src)
        clip_file = td_path / "clip.mp4"
        ffmpeg_cut(src, clip_file, clip_start, clip_end)
        source_words = load_source_words(ctx, td_path)

        from clips_worker.broll_render import load_broll_specs

        broll_specs = load_broll_specs(conn, edits, td_path)

        from clips_worker.audio_assets import load_audio_assets

        audio_assets = load_audio_assets(conn, edits, td_path)
        from clips_worker.dub_assets import load_dub_assets

        dub = load_dub_assets(conn, edits, td_path)
        if dub:
            audio_assets = {**(audio_assets or {}), "dub_assets": dub}

        out_mp4 = td_path / "render.mp4"
        _, _edited_words, srt_body = render_edited_clip(
            clip_file,
            out_mp4,
            source_words,
            edits,
            clip_start,
            clip_end,
            settings,
            td_path,
            broll_specs=broll_specs or None,
            audio_assets=audio_assets,
        )

        out_key = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/renders/{render_id}.mp4"
        srt_key = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/renders/{render_id}.srt"
        upload_file(out_key, out_mp4, "video/mp4")
        upload_text(srt_key, srt_body, "text/plain; charset=utf-8")
        size = out_mp4.stat().st_size
        mark_render(conn, render_id, "READY", out_key, size, None, srt_key)
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
