"""RENDER_SCRIPT_COMPOSITION — export script editor composition via EDL + clip render stack."""
from __future__ import annotations

import inspect
import json
import subprocess
import tempfile
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.edits_render import build_srt, normalize_edits, render_edited_clip
from clips_worker.edl_gap_render import apply_edl_gap_freezes
from clips_worker.heartbeat import Heartbeat
from clips_worker.render_clip import aspect_size, ffmpeg_cut_or_copy, probe_duration_ms
from clips_worker.script_edl import (
    derive_edl,
    edl_to_trim_and_cut_ranges,
    output_duration_ms,
    sum_merged_source_span_ms,
)
from clips_worker.storage import download_object, upload_file


def load_composition_render_context(conn, composition_id: str, render_id: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT r.id AS render_id, r."compositionId", r."workspaceId", r.status,
                   r.resolution, r."aspectRatio", r.settings,
                   c.id AS composition_id, c.document, c.aspect, c."projectId",
                   p."rangeStartMs", p."rangeEndMs", p.settings AS project_settings,
                   p."sourceKind", p."transcriptKey", p."transcriptWords", p."uploadId",
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


def _document_settings_edits(document: dict, project_settings: dict, *, source_kind: str | None = None) -> dict:
    doc_settings = document.get("settings") or {}
    captions = doc_settings.get("captions") or {}
    preset = captions.get("presetId") or captions.get("preset") or "bold_pop"
    edits = {
        "v": 2,
        "captions": {
            "enabled": bool(captions.get("enabled", True)),
            "presetId": preset,
            "burnIn": captions.get("burnIn", True),
        },
        "layout": {"mode": doc_settings.get("reframeMode") or "speaker_follow", "shotOverrides": []},
        "aspectRatio": doc_settings.get("aspect") or project_settings.get("aspectRatio") or "9:16",
    }
    if source_kind == "t2v":
        brand = doc_settings.get("brand")
        if isinstance(brand, dict) and brand:
            edits["brand"] = brand
        elif isinstance(project_settings.get("brand"), dict):
            edits["brand"] = project_settings["brand"]
    return edits


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


def _coerce_progress_cb(post_progress):
    """Accept progress(job_id, payload) or legacy progress(payload) callbacks."""

    try:
        arity = len(inspect.signature(post_progress).parameters)
    except (TypeError, ValueError):
        arity = 2

    def progress(job_id: str, payload: dict) -> None:
        if arity >= 2:
            post_progress(job_id, payload)
        else:
            post_progress(payload)

    return progress


def run_script_composition_render_job(conn, job: dict, post_progress) -> None:
    post_progress = _coerce_progress_cb(post_progress)
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
    source_kind = str(ctx.get("sourceKind") or "")

    with tempfile.TemporaryDirectory() as td, Heartbeat(job["id"], post_progress) as heartbeat:
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
        _ = sum_merged_source_span_ms(edl)

        trim_in, trim_out, cut_ranges = edl_to_trim_and_cut_ranges(edl, range_start, range_end)
        edits = _document_settings_edits(document, project_settings, source_kind=source_kind)
        if "burnCaptions" in settings:
            edits.setdefault("captions", {})
            edits["captions"]["enabled"] = bool(settings.get("burnCaptions"))
        edits["trim"] = {"in": trim_in, "out": trim_out}
        edits["cutRanges"] = cut_ranges
        broll = document.get("broll") or []
        if broll:
            edits["broll"] = broll
        audio = document.get("audio")
        if audio:
            edits["audio"] = audio
        audio_fx = document.get("audioFx") or {}
        studio = audio_fx.get("studioSound") or {}
        if studio.get("enabled") and studio.get("assetId"):
            edits.setdefault("audio", {})
            edits["audio"]["studioSound"] = {
                "enabled": True,
                "generationId": studio["assetId"],
                "mix": float(studio.get("mix", 0.8)),
            }
        if audio_fx.get("loudnessLufs") is not None:
            edits["loudnessLufs"] = int(audio_fx["loudnessLufs"])
        if audio_fx.get("roomTone"):
            edits["roomTone"] = True
        if not edits.get("audio") and document.get("musicTracks"):
            mt = document["musicTracks"][0]
            if mt.get("assetId"):
                edits["audio"] = {
                    "music": {
                        "generationId": mt["assetId"],
                        "volume": float(mt.get("volume", 0.25)),
                        "duckDepth": 0.7 if mt.get("duckUnderSpeech") else 0.3,
                        "fadeInMs": 500,
                        "fadeOutMs": 1000,
                    }
                }
        edits = normalize_edits(edits, trim_in, trim_out)

        from clips_worker.broll_render import load_broll_specs
        from clips_worker.audio_assets import load_audio_assets

        broll_specs = load_broll_specs(conn, edits, td_path) or None
        audio_assets = load_audio_assets(conn, edits, td_path) or None

        render_settings = {
            **project_settings,
            "aspectRatio": aspect,
            "exportResolution": resolution,
            "captions": edits.get("captions"),
        }

        src = td_path / "source.mp4"
        download_object(source_key, src)
        mark_composition_render(conn, render_id, "RENDERING", progress=15)
        heartbeat.update(stage="download", progress=15)
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "download", "progress": 15})

        clip_file = td_path / "clip.mp4"
        ffmpeg_cut_or_copy(src, clip_file, trim_in, trim_out)
        mark_composition_render(conn, render_id, "RENDERING", progress=25)
        heartbeat.update(stage="trim", progress=25)
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "trim", "progress": 25})

        cut_mp4 = td_path / "cut.mp4"
        _, caption_words, srt_body = render_edited_clip(
            clip_file,
            cut_mp4,
            source_words,
            edits,
            trim_in,
            trim_out,
            render_settings,
            td_path,
            broll_specs=broll_specs,
            audio_assets=audio_assets,
            render_id=render_id,
            render_meta={},
        )

        out_mp4 = td_path / "out.mp4"
        has_gaps = any(s.get("kind") == "gap" for s in edl)
        if has_gaps:
            apply_edl_gap_freezes(src, cut_mp4, out_mp4, edl, td_path, trim_in)
        else:
            out_mp4 = cut_mp4

        if edits.get("roomTone"):
            gap_segs = [g for g in edl if g.get("kind") == "gap"]
            if gap_segs:
                from clips_worker.room_tone import apply_room_tone_under_gaps, extract_room_tone_sample

                room_loop = extract_room_tone_sample(src, td_path)
                room_out = td_path / "with_room_tone.mp4"
                apply_room_tone_under_gaps(out_mp4, room_out, room_loop, gap_segs)
                out_mp4 = room_out

        mark_composition_render(conn, render_id, "RENDERING", progress=85)
        heartbeat.update(stage="upload", progress=85)
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
            brand = edits.get("brand") if isinstance(edits.get("brand"), dict) else {}
            intro_key = None
            outro_key = None
            if source_kind == "t2v":
                intro_key = brand.get("introVideoKey") if brand.get("useIntro", True) else None
                outro_key = brand.get("outroVideoKey") if brand.get("useOutro", True) else None

                def _brand_key_ok(key: str | None) -> bool:
                    if not key:
                        return False
                    return str(key).startswith(f"ws/{workspace_id}/") or str(key).startswith("stock/")

                if intro_key and not _brand_key_ok(str(intro_key)):
                    intro_key = None
                if outro_key and not _brand_key_ok(str(outro_key)):
                    outro_key = None
            if intro_key or outro_key:
                from clips_worker.brand_concat import concat_brand_bookends
                from clips_worker.render_clip import aspect_size
                from clips_worker.storage import download_object

                intro_p = td_path / "brand_intro.mp4" if intro_key else None
                outro_p = td_path / "brand_outro.mp4" if outro_key else None
                if intro_p:
                    download_object(str(intro_key), intro_p)
                if outro_p:
                    download_object(str(outro_key), outro_p)
                w, h = aspect_size(aspect, resolution)
                bookended = td_path / "bookended.mp4"
                concat_brand_bookends(out_mp4, bookended, intro_p, outro_p, w, h, td_path)
                out_mp4 = bookended
            out_key = f"{base_key}.mp4"
            upload_file(out_key, out_mp4, "video/mp4")

        actual_ms = probe_duration_ms(out_mp4) if export_kind == "video" else edl_out_ms
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
