"""RENDER_SCRIPT_COMPOSITION — export script editor composition via EDL + clip render stack."""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.edits_render import build_srt, normalize_edits, render_edited_clip
from clips_worker.render_clip import aspect_size, ffmpeg_cut
from clips_worker.script_edl import derive_edl, edl_to_cut_ranges_and_trim, output_duration_ms
from clips_worker.storage import download_object, upload_file


def load_composition_render_context(conn, composition_id: str, render_id: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT r.id AS render_id, r."compositionId", r."workspaceId", r.status,
                   r.resolution, r."aspectRatio", r.settings,
                   c.id AS composition_id, c.document, c.aspect, c."projectId",
                   p."rangeStartMs", p."rangeEndMs", p.settings AS project_settings,
                   p."transcriptKey", p."transcriptWords", p."uploadId",
                   u.key AS source_key
            FROM script_composition_renders r
            JOIN script_compositions c ON c.id = r."compositionId"
            JOIN clip_projects p ON p.id = c."projectId"
            LEFT JOIN clip_uploads u ON u.id = p."uploadId"
            WHERE r.id = %s AND c.id = %s
            """,
            (render_id, composition_id),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("composition render not found")
    return dict(row)


def mark_composition_render(
    conn,
    render_id: str,
    status: str,
    output_key: str | None = None,
    error: str | None = None,
    progress: int | None = None,
) -> None:
    settings_patch = None
    if progress is not None:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT settings FROM script_composition_renders WHERE id = %s', (render_id,))
            row = cur.fetchone()
            base = row["settings"] if row else {}
            if isinstance(base, str):
                base = json.loads(base)
            settings_patch = {**(base or {}), "progress": progress}
    with conn.cursor() as cur:
        if settings_patch is not None:
            cur.execute(
                """
                UPDATE script_composition_renders
                SET status = %s, "outputKey" = COALESCE(%s, "outputKey"), error = %s,
                    settings = %s::jsonb, "updatedAt" = NOW()
                WHERE id = %s
                """,
                (status, output_key, error, json.dumps(settings_patch), render_id),
            )
        else:
            cur.execute(
                """
                UPDATE script_composition_renders
                SET status = %s, "outputKey" = COALESCE(%s, "outputKey"), error = %s, "updatedAt" = NOW()
                WHERE id = %s
                """,
                (status, output_key, error, render_id),
            )
    conn.commit()


def _load_transcript_words(ctx: dict, work_dir: Path) -> list[dict]:
    words: list[dict] = []
    if ctx.get("transcriptKey"):
        p = work_dir / "transcript.json"
        download_object(ctx["transcriptKey"], p)
        words = json.loads(p.read_text())
    elif ctx.get("transcriptWords"):
        tw = ctx["transcriptWords"]
        if isinstance(tw, str):
            tw = json.loads(tw)
        words = list(tw) if isinstance(tw, list) else []
    return words


def _editor_words_from_transcript(words: list[dict], source_media_id: str, range_start_ms: int) -> dict[str, dict]:
    """Match new-app `toEditorWords` ids: `{sourceMediaId}:{w.i ?? w.idx ?? pos}`."""
    by_id: dict[str, dict] = {}
    for pos, w in enumerate(words):
        index = int(w.get("i", w.get("idx", pos)))
        wid = f"{source_media_id}:{index}"
        s_ms = int(float(w["s"]) * 1000)
        e_ms = int(float(w["e"]) * 1000)
        by_id[wid] = {
            "id": wid,
            "t0Ms": s_ms,
            "t1Ms": e_ms,
            "text": str(w.get("w", "")),
            "i": index,
        }
    return by_id


def _document_settings_edits(document: dict, project_settings: dict) -> dict:
    doc_settings = document.get("settings") or {}
    captions = doc_settings.get("captions") or {}
    preset = captions.get("presetId") or captions.get("preset") or "bold_pop"
    return {
        "v": 2,
        "captions": {
            "enabled": bool(captions.get("enabled", True)),
            "presetId": preset,
            "burnIn": captions.get("burnIn", True),
        },
        "layout": {"mode": doc_settings.get("reframeMode") or "speaker_follow", "shotOverrides": []},
        "aspectRatio": doc_settings.get("aspect") or project_settings.get("aspectRatio") or "9:16",
    }


def _probe_duration_ms(video: Path) -> int:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video),
        ],
        text=True,
    ).strip()
    return int(float(out) * 1000)


def _export_audio(src: Path, dest: Path, fmt: str) -> None:
    if fmt == "wav":
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-acodec", "pcm_s16le", str(dest)],
        )
    elif fmt == "mp3":
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-c:a", "libmp3lame", "-q:a", "2", str(dest)],
        )
    else:
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-c:a", "aac", str(dest)])


def run_script_composition_render_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    composition_id = payload.get("compositionId")
    render_id = payload.get("renderId")
    if not composition_id or not render_id:
        raise RuntimeError("missing compositionId/renderId")

    # DB status first — UI must not stay QUEUED during long download/render if callbacks fail.
    mark_composition_render(conn, render_id, "RENDERING", progress=1)

    ctx = load_composition_render_context(conn, composition_id, render_id)
    mark_composition_render(conn, render_id, "RENDERING", progress=5)
    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "script_export", "progress": 5})

    document = ctx.get("document") or {}
    if isinstance(document, str):
        document = json.loads(document)
    settings = ctx.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)

    export_kind = str(settings.get("exportKind") or "video")
    range_start = int(ctx["rangeStartMs"] or 0)
    range_end = int(ctx["rangeEndMs"] or 0)
    source_key = ctx.get("source_key")
    if not source_key:
        raise RuntimeError("missing source media")

    workspace_id = ctx["workspaceId"]
    project_id = ctx["projectId"]
    resolution = ctx.get("resolution") or "1080p"
    aspect = ctx.get("aspectRatio") or ctx.get("aspect") or "9:16"
    project_settings = ctx.get("project_settings") or {}
    if isinstance(project_settings, str):
        project_settings = json.loads(project_settings)

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        source_words = _load_transcript_words(ctx, td_path)
        upload_id = ctx.get("uploadId")
        source_media_id = f"clip_upload:{upload_id}" if upload_id else f"import:{project_id}"
        words_by_id = _editor_words_from_transcript(source_words, source_media_id, range_start)

        if range_end <= range_start:
            if source_words:
                last = source_words[-1]
                range_end = int(float(last["e"]) * 1000) + 500
            else:
                range_end = range_start + 60_000

        edl = derive_edl(document, words_by_id)
        edl_out_ms = output_duration_ms(edl)

        trim_in, trim_out, cut_ranges = edl_to_cut_ranges_and_trim(
            document, words_by_id, range_start, range_end,
        )
        edits = _document_settings_edits(document, project_settings)
        edits["trim"] = {"in": trim_in, "out": trim_out}
        edits["cutRanges"] = cut_ranges
        edits = normalize_edits(edits, trim_in, trim_out)

        render_settings = {
            **project_settings,
            "aspectRatio": aspect,
            "exportResolution": resolution,
            "captions": edits.get("captions"),
        }

        src = td_path / "source.mp4"
        download_object(source_key, src)
        mark_composition_render(conn, render_id, "RENDERING", progress=15)
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render", "progress": 15})

        clip_file = td_path / "clip.mp4"
        ffmpeg_cut(src, clip_file, range_start, range_end)

        out_mp4 = td_path / "out.mp4"
        _, caption_words, srt_body = render_edited_clip(
            clip_file,
            out_mp4,
            source_words,
            edits,
            trim_in,
            trim_out,
            render_settings,
            td_path,
            broll_specs=None,
            audio_assets=None,
            render_id=render_id,
            render_meta={},
        )

        mark_composition_render(conn, render_id, "RENDERING", progress=85)
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "upload", "progress": 85})

        base_key = f"ws/{workspace_id}/projects/{project_id}/compositions/{composition_id}/renders/{render_id}"

        if export_kind == "audio":
            fmt = str(settings.get("audioFormat") or "wav").lower()
            ext = "wav" if fmt == "wav" else "mp3"
            audio_out = td_path / f"out.{ext}"
            _export_audio(out_mp4, audio_out, fmt)
            out_key = f"{base_key}.{ext}"
            upload_file(out_key, audio_out, f"audio/{ext}")
        elif export_kind in ("srt", "vtt", "txt", "md"):
            if export_kind == "vtt":
                body = _srt_to_vtt(srt_body)
                ext, ctype = "vtt", "text/vtt"
            elif export_kind == "txt":
                body = "\n".join(w["w"] for w in caption_words if str(w.get("w", "")).strip())
                ext, ctype = "txt", "text/plain"
            elif export_kind == "md":
                body = "# Transcript\n\n" + "\n".join(
                    f"- {w['w']}" for w in caption_words if str(w.get("w", "")).strip()
                )
                ext, ctype = "md", "text/markdown"
            else:
                body = srt_body
                ext, ctype = "srt", "text/plain"
            text_path = td_path / f"out.{ext}"
            text_path.write_text(body, encoding="utf-8")
            out_key = f"{base_key}.{ext}"
            upload_file(out_key, text_path, ctype)
        else:
            out_key = f"{base_key}.mp4"
            upload_file(out_key, out_mp4, "video/mp4")

        actual_ms = _probe_duration_ms(out_mp4) if export_kind == "video" else edl_out_ms
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE script_composition_renders
                SET status = %s, "outputKey" = %s, error = NULL,
                    settings = settings || %s::jsonb, "updatedAt" = NOW()
                WHERE id = %s
                """,
                (
                    "READY",
                    out_key,
                    json.dumps({"progress": 100, "edlDurationMs": edl_out_ms, "outputDurationMs": actual_ms}),
                    render_id,
                ),
            )
        conn.commit()
        post_progress(
            job["id"],
            {
                "jobStatus": "DONE",
                "stage": "ready",
                "progress": 100,
                "edlDurationMs": edl_out_ms,
                "outputDurationMs": actual_ms,
            },
        )


def _srt_to_vtt(srt: str) -> str:
    lines = ["WEBVTT", ""]
    for block in srt.strip().split("\n\n"):
        parts = block.split("\n")
        if len(parts) < 3:
            continue
        times = parts[1].replace(",", ".")
        text = "\n".join(parts[2:])
        lines.append(times)
        lines.append(text)
        lines.append("")
    return "\n".join(lines)
