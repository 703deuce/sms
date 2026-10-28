"""RENDER_CLIP job: apply edits and upload render output."""
from __future__ import annotations

import json
import logging
import tempfile
import threading
import time
from pathlib import Path

_log = logging.getLogger(__name__)

from psycopg2.extras import RealDictCursor

from clips_worker.edits_render import normalize_edits, render_edited_clip
from clips_worker.trim_bounds import expanded_source_cut_ms
from clips_worker.render_settings import settings_with_clip_ai_meta
from clips_worker.preview_reuse import can_reuse_clip_preview_for_render
from clips_worker.render_fit_fallback import merge_job_fit_fallback_payload
from clips_worker.render_clip import ffmpeg_cut
from clips_worker.storage import download_object, upload_file


def _probe_duration_sec(path: Path) -> float:
    import subprocess

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
    return max(0.0, float(out or "0"))


def load_render_context(conn, render_id: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT r.id AS render_id, r."clipId", r."workspaceId",
                   r.status, r."outputKey", r."editsVersionHash",
                   r."aspectRatio", r.resolution,
                   c."startMs", c."endMs", c."previewKey", c."cropKey", c.edits, c."projectId",
                   c."sourceSegKey", c."sourceSegStartMs", c."sourceSegEndMs", c."aiMeta",
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


def _export_stage_log(render_id: str, stage: str, t0: float, extra: dict | None = None) -> None:
    payload = {"tag": "clipper:export_stage", "renderId": render_id, "stage": stage, "elapsedSec": round(time.perf_counter() - t0, 3)}
    if extra:
        payload.update(extra)
    print(f"[clipper:export_stage] {json.dumps(payload)}", flush=True)


def run_render_clip_job(conn, job: dict, post_progress) -> None:
    from clips_worker.worker_drain import WorkerDrainExit, drain_requested

    def _check_drain(stage: str) -> None:
        if drain_requested():
            payload = job.get("payload") or {}
            if isinstance(payload, str):
                payload = json.loads(payload)
            rid = payload.get("renderId")
            if rid:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE clip_renders
                        SET status = 'QUEUED', error = NULL, "updatedAt" = NOW()
                        WHERE id = %s
                        """,
                        (rid,),
                    )
                conn.commit()
            raise WorkerDrainExit(f"render_clip_drain_{stage}")

    t_job = time.perf_counter()
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    render_id = payload.get("renderId")
    if not render_id:
        raise RuntimeError("missing renderId")

    from clips_worker.decision_log import bind_decision_log, decision_log, flush_decision_log, unbind_decision_log

    bind_decision_log(conn, job["id"])
    try:
        _run_render_clip_job_body(
            conn,
            job,
            post_progress,
            render_id=render_id,
            payload=payload,
            t_job=t_job,
            _check_drain=_check_drain,
        )
    finally:
        flush_decision_log(force=True)
        unbind_decision_log()


def _export_decision(render_id: str, event: str, **fields: object) -> None:
    from clips_worker.decision_log import decision_log

    decision_log("export", event, renderId=render_id, **fields)


def _run_render_clip_job_body(
    conn,
    job: dict,
    post_progress,
    *,
    render_id: str,
    payload: dict,
    t_job: float,
    _check_drain,
) -> None:
    ctx = load_render_context(conn, render_id)
    _export_stage_log(render_id, "load_context", t_job)
    _check_drain("load_context")
    mark_render(conn, render_id, "RENDERING")
    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 10, "etaSeconds": 180})
    from clips_worker.gpu.render_warmup import schedule_modal_warmup_background

    schedule_modal_warmup_background()

    clip_start = int(ctx["startMs"])
    clip_end = int(ctx["endMs"])
    source_offset_ms = 0
    if ctx.get("sourceSegKey"):
        source_key = ctx["sourceSegKey"]
        source_offset_ms = int(ctx.get("sourceSegStartMs") or 0)
        clip_start = max(clip_start, source_offset_ms)
        seg_end = ctx.get("sourceSegEndMs")
        if seg_end is not None:
            clip_end = min(clip_end, int(seg_end))
    else:
        source_key = ctx["source_key"]
    edits = normalize_edits(ctx["edits"], clip_start, clip_end)
    settings = ctx["settings"] or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    settings = settings_with_clip_ai_meta(settings, ctx.get("aiMeta"))
    aspect = ctx.get("aspectRatio") or edits.get("aspectRatio") or settings.get("aspectRatio") or "9:16"
    resolution = ctx.get("resolution") or "720p"
    if resolution in (720, "720"):
        resolution = "720p"
    if resolution in (1080, "1080"):
        resolution = "1080p"
    settings = {**settings, "aspectRatio": aspect, "exportResolution": resolution}
    if aspect == "16:9":
        settings = {**settings, "layout": "fit"}

    from clips_worker.edits_render import keep_segments, output_duration_ms

    segs = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    expected_ms = output_duration_ms(edits)
    layout_mode = (edits.get("layout") or {}).get("mode")
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    _export_decision(
        render_id,
        "inputs",
        clip_start_ms=clip_start,
        clip_end_ms=clip_end,
        trim_in=int(edits["trim"]["in"]),
        trim_out=int(edits["trim"]["out"]),
        cut_count=len(edits.get("cutRanges") or []),
        keep_segments=len(segs),
        expected_duration_s=round(expected_ms / 1000.0, 3),
        layout_mode=str(layout_mode or ""),
        captions_enabled=bool((edits.get("captions") or {}).get("enabled")),
        headline_enabled=bool((tpl.get("headlineBar") or {}).get("enabled")),
        aspect=aspect,
        resolution=resolution,
    )

    preview_key = ctx["previewKey"]
    if preview_key and can_reuse_clip_preview_for_render(aspect, resolution, edits, clip_start, clip_end):
        tmp = Path(tempfile.mkdtemp()) / "probe.mp4"
        try:
            download_object(preview_key, tmp)
            size = tmp.stat().st_size
        finally:
            tmp.unlink(missing_ok=True)
        mark_render(conn, render_id, "READY", preview_key, size, None, None)
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
        _export_stage_log(render_id, "preview_reuse", t_job, {"sizeBytes": size})
        return

    if not source_key:
        raise RuntimeError("missing source")

    workspace_id = ctx["workspaceId"]
    project_id = ctx["projectId"]
    clip_id = ctx["clipId"]

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        src = td_path / "source.mp4"
        download_object(source_key, src)
        _export_stage_log(render_id, "download_source", t_job)
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 28, "etaSeconds": 120})
        clip_file = td_path / "clip.mp4"
        cut_start, cut_end = expanded_source_cut_ms(clip_start, clip_end, edits)
        rel_start = cut_start - source_offset_ms
        rel_end = cut_end - source_offset_ms
        ffmpeg_cut(src, clip_file, rel_start, rel_end)
        _export_stage_log(render_id, "ffmpeg_cut", t_job)
        source_words = load_source_words(ctx, td_path)
        _export_stage_log(render_id, "load_words", t_job, {"wordCount": len(source_words)})

        from clips_worker.broll_render import load_broll_specs

        broll_specs = load_broll_specs(conn, edits, td_path)

        from clips_worker.audio_assets import load_audio_assets

        audio_assets = load_audio_assets(conn, edits, td_path)
        from clips_worker.dub_assets import load_dub_assets

        dub = load_dub_assets(conn, edits, td_path)
        if dub:
            audio_assets = {**(audio_assets or {}), "dub_assets": dub}

        out_mp4 = td_path / "render.mp4"
        from clips_worker.preview_reuse import export_edits_allow_preview_reuse, materialize_export_from_preview

        render_meta: dict = {}
        preview_crop_track: Path | None = None
        crop_key = ctx.get("cropKey")
        if crop_key:
            preview_crop_track = td_path / "preview_crop_track.json"
            try:
                download_object(str(crop_key), preview_crop_track)
            except Exception:
                preview_crop_track = None

        if preview_key and export_edits_allow_preview_reuse(aspect, edits, clip_start, clip_end):
            post_progress(
                job["id"],
                {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 55, "etaSeconds": 45},
            )
            from clips_worker.preview_reuse import CLIP_PREVIEW_RESOLUTION

            scaled = resolution not in (CLIP_PREVIEW_RESOLUTION, 720, "720")
            materialize_export_from_preview(preview_key, resolution, out_mp4, td_path)
            from clips_worker.edits_render import build_srt, ensure_word_i, words_after_edits

            remapped, _ = words_after_edits(ensure_word_i(source_words), edits)
            srt_body = build_srt(remapped)
            post_progress(
                job["id"],
                {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 72, "etaSeconds": 20},
            )
            _export_stage_log(
                render_id,
                "preview_materialize",
                t_job,
                {"resolution": resolution, "scaled": scaled},
            )
        else:
            post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 55, "etaSeconds": 90})
            _export_decision(render_id, "render_start", path="full_edits_render")
            t_render = time.perf_counter()
            progress_stop = threading.Event()

            def _render_progress_heartbeat() -> None:
                for p in (58, 62, 66, 70, 74):
                    if progress_stop.wait(12):
                        return
                    post_progress(
                        job["id"],
                        {"jobStatus": "RUNNING", "stage": "render_clip", "progress": p, "etaSeconds": max(15, 90 - p)},
                    )

            hb = threading.Thread(target=_render_progress_heartbeat, daemon=True)
            hb.start()
            try:
                _, _edited_words, srt_body = render_edited_clip(
                    clip_file,
                    out_mp4,
                    source_words,
                    edits,
                    cut_start,
                    cut_end,
                    settings,
                    td_path,
                    broll_specs=broll_specs or None,
                    audio_assets=audio_assets,
                    render_id=render_id,
                    render_meta=render_meta,
                    conn=conn,
                    workspace_id=workspace_id,
                    project_id=project_id,
                    clip_id=clip_id,
                    preview_crop_track=preview_crop_track,
                )
            finally:
                progress_stop.set()
                hb.join(timeout=1.0)
            post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 78, "etaSeconds": 45})
            _export_decision(
                render_id,
                "render_done",
                render_sec=round(time.perf_counter() - t_render, 3),
                gpu_provider=str(render_meta.get("gpu_provider") or render_meta.get("provider") or ""),
                fit_fallback=bool(render_meta.get("fit_fallback")),
                speakercrop_tail=str(render_meta.get("speakercrop_tail") or "")[:120],
            )

        brand = edits.get("brand") if isinstance(edits.get("brand"), dict) else {}
        intro_key = brand.get("introVideoKey") if brand.get("useIntro", True) else None
        outro_key = brand.get("outroVideoKey") if brand.get("useOutro", True) else None
        if intro_key or outro_key:
            from clips_worker.brand_concat import concat_brand_bookends
            from clips_worker.render_clip import aspect_size

            intro_p = td_path / "intro.mp4" if intro_key else None
            outro_p = td_path / "outro.mp4" if outro_key else None
            if intro_p:
                download_object(str(intro_key), intro_p)
            if outro_p:
                download_object(str(outro_key), outro_p)
            aspect = settings.get("aspectRatio", "9:16")
            resolution = settings.get("exportResolution", "720p")
            w, h = aspect_size(aspect, resolution)
            bookended = td_path / "bookended.mp4"
            concat_brand_bookends(out_mp4, bookended, intro_p, outro_p, w, h, td_path)
            out_mp4 = bookended

        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 82, "etaSeconds": 30})
        _export_stage_log(render_id, "pre_upload", t_job)
        out_key = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/renders/{render_id}.mp4"
        srt_key = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/renders/{render_id}.srt"
        upload_file(out_key, out_mp4, "video/mp4")
        upload_text(srt_key, srt_body, "text/plain; charset=utf-8")
        size = out_mp4.stat().st_size
        from clips_worker.edits_render import output_duration_ms

        expected_s = output_duration_ms(edits) / 1000.0
        actual_s = _probe_duration_sec(out_mp4)
        _export_decision(
            render_id,
            "duration_check",
            expected_s=round(expected_s, 3),
            actual_s=round(actual_s, 3),
            delta_s=round(actual_s - expected_s, 3),
        )
        mark_render(conn, render_id, "READY", out_key, size, None, srt_key)
        if render_meta.get("fit_fallback"):
            merge_job_fit_fallback_payload(conn, job["id"], str(render_meta.get("speakercrop_tail") or ""))
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
        _export_stage_log(render_id, "done", t_job, {"sizeBytes": size})
