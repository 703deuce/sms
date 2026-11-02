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
from clips_worker.trim_bounds import expanded_source_cut_ms, export_trim_limits_ms
from clips_worker.render_settings import settings_with_clip_ai_meta
from clips_worker.preview_reuse import can_reuse_clip_preview_for_render
from clips_worker.render_fit_fallback import merge_job_fit_fallback_payload
from clips_worker.render_clip import ffmpeg_cut
from clips_worker.storage import download_object, upload_file
from clips_worker.export_progress import ETA_UPLOAD_S, overall_progress


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


def _concat_accurate(src: Path, dest: Path, segs_sec: list[tuple[float, float]]) -> None:
    """Frame-accurate segment concat (re-encode) for composite preview exports."""
    import subprocess

    from clips_worker.edits_render import ffmpeg_concat_segments

    if not segs_sec:
        raise RuntimeError("no segments")
    if len(segs_sec) == 1:
        a, b = segs_sec[0]
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-ss",
                f"{a:.3f}",
                "-to",
                f"{b:.3f}",
                "-i",
                str(src),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "20",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                str(dest),
            ],
        )
        return
    ffmpeg_concat_segments(src, dest, segs_sec)


def apply_composite_edits(
    clip_file: Path,
    td_path: Path,
    edits: dict,
    cut_start: int,
    clip_start: int,
    clip_end: int,
    render_id: str,
) -> Path:
    from clips_worker.clip_keep_segments import keep_segments, normalize_section_order
    from clips_worker.edits_render import output_duration_ms

    if normalize_section_order(
        edits.get("sectionOrder"), int(edits["trim"]["in"]), int(edits["trim"]["out"])
    ):
        print("[clipper:reorder] ignored reason=composite", flush=True)

    clip_len_s = max(0.001, (clip_end - clip_start) / 1000.0)
    segs_ms = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    segs_sec: list[tuple[float, float]] = []
    for a, b in segs_ms:
        ra = (max(a, clip_start) - clip_start) / 1000.0
        rb = (min(b, clip_end) - clip_start) / 1000.0
        if rb - ra >= 0.08:
            segs_sec.append((ra, rb))
    if not segs_sec:
        segs_sec = [(0.0, clip_len_s)]

    edited = td_path / "composite_edited.mp4"
    full_span = (
        len(segs_sec) == 1
        and segs_sec[0][0] <= 0.01
        and abs(segs_sec[0][1] - clip_len_s) < 0.15
    )
    if full_span:
        import shutil

        shutil.copy(clip_file, edited)
    else:
        _concat_accurate(clip_file, edited, segs_sec)

    expected_s = output_duration_ms(edits) / 1000.0
    actual_s = _probe_duration_sec(edited)
    print(
        f"[clipper:composite_edits] {json.dumps({'renderId': render_id, 'segments': len(segs_sec), 'expected_s': round(expected_s, 3), 'actual_s': round(actual_s, 3), 'full_span': full_span})}",
        flush=True,
    )
    return edited


def _studio_segs_sec(edits: dict, clip_start: int, clip_end: int) -> list[tuple[float, float]]:
    from clips_worker.edits_render import keep_segments

    segs_ms = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    segs_sec: list[tuple[float, float]] = []
    for a, b in segs_ms:
        ra = (max(a, clip_start) - clip_start) / 1000.0
        rb = (min(b, clip_end) - clip_start) / 1000.0
        if rb - ra >= 0.08:
            segs_sec.append((ra, rb))
    if not segs_sec:
        segs_sec = [(0.0, max(0.08, (clip_end - clip_start) / 1000.0))]
    return segs_sec


def _apply_studio_sound_to_mp4(
    out_mp4: Path,
    td_path: Path,
    edits: dict,
    audio_assets: dict,
    *,
    clip_start: int,
    clip_end: int,
    cut_start: int,
) -> Path:
    studio_path = (audio_assets or {}).get("studio_path")
    studio_mix = (audio_assets or {}).get("studio_mix")
    if not studio_path or studio_mix is None or not Path(studio_path).is_file():
        return out_mp4
    offset_ms = audio_assets.get("studio_source_offset_ms")
    if offset_ms is None:
        offset_ms = 0
    track_start = max(0.0, (cut_start - int(offset_ms)) / 1000.0)
    segs_sec = _studio_segs_sec(edits, clip_start, clip_end)
    from clips_worker.audio_render import apply_studio_sound_mix_aligned

    mixed = td_path / "studio_composite.mp4"
    apply_studio_sound_mix_aligned(
        out_mp4,
        Path(studio_path),
        mixed,
        float(studio_mix),
        segs_sec,
        track_start_sec=track_start,
        work_dir=td_path,
    )
    return mixed


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


def _clear_stale_project_render_error(conn, project_id: str) -> None:
    if not project_id:
        return
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_projects
            SET error = NULL,
                status = CASE WHEN status = 'FAILED' THEN 'READY' ELSE status END,
                "updatedAt" = NOW()
            WHERE id = %s AND error IS NOT NULL
            """,
            (project_id,),
        )
    conn.commit()


def mark_render(
    conn,
    render_id: str,
    status: str,
    output_key: str | None = None,
    size_bytes: int | None = None,
    error: str | None = None,
    srt_key: str | None = None,
    stems_key: str | None = None,
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
                "stemsKey" = COALESCE(%s, "stemsKey"),
                "updatedAt" = NOW()
            WHERE id = %s
            """,
            (status, output_key, size_bytes, error, srt_key, stems_key, render_id),
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


def load_source_words(ctx: dict, work_dir: Path) -> tuple[list[dict], bool]:
    start_ms = int(ctx.get("startMs") or 0)
    end_ms = int(ctx.get("endMs") or start_ms)
    words_fallback = False

    def _overlaps_clip(words: list[dict]) -> bool:
        start_s = start_ms / 1000.0
        end_s = end_ms / 1000.0
        for w in words:
            try:
                ws = float(w.get("s", 0))
                we = float(w.get("e", ws))
            except (TypeError, ValueError):
                continue
            if we > start_s and ws < end_s:
                return True
        return False

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
    if words and not _overlaps_clip(words):
        print("[clipper:words] words_fallback reason=no_overlap", flush=True)
        words = []
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
        words_fallback = True
        print("[clipper:words] words_fallback source=clip_words", flush=True)
    out = []
    for pos, w in enumerate(words):
        wi = w.get("i", w.get("idx", pos))
        out.append({**w, "i": int(wi)})
    return out, words_fallback


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


def _start_render_progress_reporter(job_id: str, post_progress, tracker, every_s: float | None = None):
    """FV4a: post real progress (ffmpeg -progress) every ~15 s while the full render runs.

    Replaces the fake 58→74 % steps that stopped after one minute and let the web watchdog requeue
    healthy long renders. Also runs the worker-side stall / hard-cap checks (tracker.tick()).
    Returns a stop() callable.
    """
    import os

    every = every_s if every_s is not None else max(5.0, float(os.environ.get("RENDER_PROGRESS_EVERY_SEC", "15") or 15))
    stop = threading.Event()

    def _loop() -> None:
        while not stop.wait(every):
            try:
                snap = tracker.tick()
                body = {
                    "jobStatus": "RUNNING",
                    "stage": "render_clip",
                    "progress": int(snap["progress"]),
                    "renderStep": int(snap["step"]),
                    "renderSteps": int(snap["steps"]),
                    "activity": str(snap["activity"]),
                }
                if snap.get("step_pct") is not None:
                    body["stepPct"] = int(snap["step_pct"])
                if snap.get("eta_s") is not None:
                    body["etaSeconds"] = max(0, int(snap["eta_s"]))
                post_progress(job_id, body)
            except Exception as exc:  # never kill the render over a progress ping
                print(f"[clipper:export_progress] post failed job={job_id}: {exc}", flush=True)

    th = threading.Thread(target=_loop, daemon=True)
    th.start()

    def _stop() -> None:
        stop.set()
        th.join(timeout=2.0)

    return _stop


def _assert_still_owned(conn, job: dict) -> None:
    """FV4a: a requeued job (watchdog / stale lock) must not be finished by the old process."""
    from clips_worker.export_progress import RenderCanceled
    from clips_worker.job_lock import job_still_owned

    if not job_still_owned(conn, str(job["id"])):
        raise RenderCanceled("claim_lost")


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
    from clips_worker.export_deliver import normalize_deliver

    ctx = load_render_context(conn, render_id)
    _export_stage_log(render_id, "load_context", t_job)
    _check_drain("load_context")
    mark_render(conn, render_id, "RENDERING")
    # FV4b: overall bands prep 0–10 / encode 10–90 / upload 90–100; no made-up ETA during prep.
    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": overall_progress("prep", 0.2)})
    from clips_worker.gpu.render_warmup import schedule_modal_warmup_background

    schedule_modal_warmup_background()

    clip_start = int(ctx["startMs"])
    clip_end = int(ctx["endMs"])
    from clips_worker.clip_source_media import resolve_clip_export_source

    source_key, source_offset_ms, source_reason = resolve_clip_export_source(
        {**ctx, "clipId": ctx.get("clipId")}
    )
    if source_key and source_reason in ("sourceSegKey", "canonical_source_seg"):
        clip_start = max(clip_start, source_offset_ms)
        seg_end = ctx.get("sourceSegEndMs")
        if seg_end is not None:
            clip_end = min(clip_end, int(seg_end))
    elif source_reason == "previewKey_composite":
        clip_start = max(clip_start, int(ctx["startMs"]))
        clip_end = min(clip_end, int(ctx["endMs"]))
    from clips_worker.decision_log import decision_log

    decision_log(
        "editor",
        "export_source_resolved",
        renderId=render_id,
        clipId=ctx.get("clipId"),
        reason=source_reason,
        hasSource=bool(source_key),
    )
    edits = normalize_edits(ctx["edits"], clip_start, clip_end)
    # E2: hidden / muted timeline lanes are dropped before any asset load or render path.
    from clips_worker.timeline_lanes import apply_timeline_lane_state

    edits = apply_timeline_lane_state(edits)
    settings = ctx["settings"] or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    settings = settings_with_clip_ai_meta(settings, ctx.get("aiMeta"))
    from clips_worker.render_clip import is_landscape_aspect, normalize_aspect_token

    aspect = normalize_aspect_token(
        ctx.get("aspectRatio") or edits.get("aspectRatio") or settings.get("aspectRatio") or "9:16"
    )
    resolution = ctx.get("resolution") or "720p"
    if resolution in (720, "720"):
        resolution = "720p"
    if resolution in (1080, "1080"):
        resolution = "1080p"
    settings = {**settings, "aspectRatio": aspect, "exportResolution": resolution}
    if is_landscape_aspect(aspect):
        from clips_worker.layout_router import landscape_layout

        layout_mode = str((edits.get("layout") or {}).get("mode") or "")
        settings = {**settings, "layout": landscape_layout(layout_mode)}

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
    compose_spec = payload.get("composeSpec") if isinstance(payload.get("composeSpec"), dict) else None
    deliver_spec = normalize_deliver(payload.get("deliver"))
    if deliver_spec and deliver_spec.get("targetResolution") in ("1440p", "2160p"):
        resolution = "1080p"
        settings = {**settings, "exportResolution": resolution}
    if preview_key and not compose_spec and not deliver_spec and can_reuse_clip_preview_for_render(aspect, resolution, edits, clip_start, clip_end):
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

    from contextlib import ExitStack

    with tempfile.TemporaryDirectory() as td, ExitStack() as progress_stack:
        td_path = Path(td)
        src = td_path / "source.mp4"
        download_object(source_key, src)
        _export_stage_log(render_id, "download_source", t_job)
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": overall_progress("prep", 0.6)})
        upload_dur_ms = int(_probe_duration_sec(src) * 1000)
        trim_limits = export_trim_limits_ms(ctx, clip_start, clip_end, source_reason, upload_dur_ms)
        clip_file = td_path / "clip.mp4"
        cut_start, cut_end, lo_ms, hi_ms = expanded_source_cut_ms(
            clip_start, clip_end, edits, limits=trim_limits,
        )
        print(
            f"[clipper:trim_window] {json.dumps({'renderId': render_id, 'lo_ms': lo_ms, 'hi_ms': hi_ms, 'cut_start_ms': cut_start, 'cut_end_ms': cut_end})}",
            flush=True,
        )
        rel_start = cut_start - source_offset_ms
        rel_end = cut_end - source_offset_ms
        ffmpeg_cut(src, clip_file, rel_start, rel_end)
        _export_stage_log(render_id, "ffmpeg_cut", t_job)
        cut_dur = _probe_duration_sec(clip_file)
        if cut_dur < 0.1:
            raise RuntimeError(f"empty_source_cut reason={source_reason} rel_start={rel_start}")
        source_words, words_fallback = load_source_words(ctx, td_path)
        if words_fallback:
            edits = {**edits, "_wordsFallback": True}
        _export_stage_log(render_id, "load_words", t_job, {"wordCount": len(source_words), "wordsFallback": words_fallback})

        # E5: user uploads / Rooms angles referenced by the edits (scoped to this workspace + project).
        from clips_worker.media_sources import load_media_assets, referenced_media

        media_paths = load_media_assets(conn, edits, td_path, workspace_id, project_id) if referenced_media(edits) else {}
        from clips_worker.media_sources import prepare_canvas_bg_image

        edits = prepare_canvas_bg_image(edits, media_paths, td_path)

        # E5b: words of transcribed media join the captions over 'source'-sound segments / inserts.
        media_transcripts: dict = {}
        if edits.get("sourceSegments") or edits.get("inserts"):
            from clips_worker.media_sources import normalize_media_sources
            from clips_worker.media_words import load_media_transcripts, merge_media_words

            ref_ids = [s["refId"] for s in normalize_media_sources(edits.get("sources")) or []]
            media_transcripts = load_media_transcripts(conn, project_id, workspace_id, ref_ids)
            if media_transcripts:
                source_words = merge_media_words(source_words, edits, media_transcripts)

        from clips_worker.broll_render import load_broll_specs

        broll_specs = load_broll_specs(conn, edits, td_path, media=media_paths)

        from clips_worker.audio_assets import load_audio_assets

        audio_assets = load_audio_assets(conn, edits, td_path, media=media_paths)
        if audio_assets is None:
            audio_assets = {}
        if media_paths:
            audio_assets["media_paths"] = media_paths
        if audio_assets.get("studio_source_offset_ms") is None:
            audio_assets["studio_source_offset_ms"] = source_offset_ms
        if not audio_assets.get("studio_source_key") and source_key:
            audio_assets["studio_source_key"] = source_key
        from clips_worker.dub_assets import load_dub_assets

        dub = load_dub_assets(conn, edits, td_path)
        if dub:
            audio_assets = {**(audio_assets or {}), "dub_assets": dub}

        out_mp4 = td_path / "render.mp4"
        from clips_worker.preview_reuse import export_edits_allow_preview_reuse, materialize_export_from_preview

        render_meta: dict = {}
        if deliver_spec and deliver_spec.get("stems"):
            render_meta["export_stems"] = True
        preview_crop_track: Path | None = None
        crop_key = ctx.get("cropKey")
        if crop_key:
            preview_crop_track = td_path / "preview_crop_track.json"
            try:
                download_object(str(crop_key), preview_crop_track)
            except Exception:
                preview_crop_track = None

        if source_reason == "previewKey_composite":
            post_progress(
                job["id"],
                {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 55, "etaSeconds": 45},
            )
            from clips_worker.preview_reuse import CLIP_PREVIEW_RESOLUTION
            from clips_worker.render_clip import aspect_size
            import shutil
            import subprocess

            edited = clip_file
            try:
                edited = apply_composite_edits(
                    clip_file,
                    td_path,
                    edits,
                    cut_start,
                    clip_start,
                    clip_end,
                    render_id,
                )
            except Exception as e:
                _log.warning("composite_edits_fallback renderId=%s err=%s", render_id, e)
                print(
                    f"[clipper:composite_edits] fallback err={type(e).__name__}:{str(e)[:120]}",
                    flush=True,
                )

            if resolution in (CLIP_PREVIEW_RESOLUTION, 720, "720", "720p"):
                shutil.copy(edited, out_mp4)
            else:
                res = "1080p" if resolution in (1080, "1080") else resolution
                w, h = aspect_size(aspect, res)
                subprocess.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-v",
                        "error",
                        "-i",
                        str(edited),
                        "-vf",
                        f"scale={w}:{h}:flags=lanczos",
                        "-c:v",
                        "libx264",
                        "-crf",
                        "20",
                        "-preset",
                        "veryfast",
                        "-c:a",
                        "aac",
                        "-movflags",
                        "+faststart",
                        str(out_mp4),
                    ],
                    check=True,
                )
            out_mp4 = _apply_studio_sound_to_mp4(
                out_mp4,
                td_path,
                edits,
                audio_assets or {},
                clip_start=clip_start,
                clip_end=clip_end,
                cut_start=cut_start,
            )
            from clips_worker.edits_render import ensure_word_i, export_srt, words_after_edits

            remapped, _ = words_after_edits(ensure_word_i(source_words), edits)
            srt_body = export_srt(edits, remapped)
            _export_stage_log(render_id, "preview_composite_cut", t_job, {"resolution": resolution})
        elif preview_key and export_edits_allow_preview_reuse(aspect, edits, clip_start, clip_end):
            post_progress(
                job["id"],
                {"jobStatus": "RUNNING", "stage": "render_clip", "progress": 55, "etaSeconds": 45},
            )
            from clips_worker.preview_reuse import CLIP_PREVIEW_RESOLUTION

            scaled = resolution not in (CLIP_PREVIEW_RESOLUTION, 720, "720")
            materialize_export_from_preview(preview_key, resolution, out_mp4, td_path)
            from clips_worker.edits_render import ensure_word_i, export_srt, words_after_edits

            remapped, _ = words_after_edits(ensure_word_i(source_words), edits)
            srt_body = export_srt(edits, remapped)
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
            from clips_worker.edits_render import output_duration_ms as _out_ms
            from clips_worker.export_progress import RenderProgress, estimate_export_pass_weights

            pass_weights = [w for _, w in estimate_export_pass_weights(edits, deliver_spec)]
            tracker = progress_stack.enter_context(
                RenderProgress(
                    _out_ms(edits) / 1000.0,
                    len(pass_weights),
                    pass_weights=pass_weights,
                    work_dir=td_path,
                )
            )
            post_progress(
                job["id"],
                {
                    "jobStatus": "RUNNING",
                    "stage": "render_clip",
                    "progress": overall_progress("encode", 0.0),
                    "renderStep": 1,
                    "renderSteps": tracker.est_passes,
                    "activity": "start",
                },
            )
            _export_decision(
                render_id,
                "render_start",
                path="full_edits_render",
                est_passes=tracker.est_passes,
                max_seconds=int(tracker.max_seconds),
            )
            t_render = time.perf_counter()
            progress_stack.callback(_start_render_progress_reporter(job["id"], post_progress, tracker))
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
                    compose_spec=compose_spec,
                )
            except Exception as exc:
                if tracker.cancel_reason:
                    from clips_worker.export_progress import RenderCanceled

                    raise RenderCanceled(tracker.cancel_reason) from exc
                raise
            tracker.check()
            _export_decision(
                render_id,
                "render_done",
                render_sec=round(time.perf_counter() - t_render, 3),
                gpu_provider=str(render_meta.get("gpu_provider") or render_meta.get("provider") or ""),
                fit_fallback=bool(render_meta.get("fit_fallback")),
                speakercrop_tail=str(render_meta.get("speakercrop_tail") or "")[:120],
            )

        from clips_worker.export_post import apply_export_post

        out_mp4, srt_body = apply_export_post(
            out_mp4, td_path, edits, render_meta, srt_body=srt_body
        )

        from clips_worker.media_inserts import edits_insert_windows, has_inserts, splice_inserts

        if has_inserts(edits):
            # E5b: splice inserted clips into the finished file (ripple), shift the SRT, add their words.
            from clips_worker.media_words import insert_words

            ins_words = insert_words(
                edits_insert_windows(edits, render_meta.get("keep_segs_src")), edits, media_transcripts
            )
            out_mp4, srt_body, added_ms = splice_inserts(
                out_mp4, td_path, edits, render_meta, media_paths, srt_body, ins_words
            )
            if added_ms:
                from clips_worker.edits_render import output_duration_ms as _odm

                base_eff = int(render_meta.get("effective_edits_ms") or _odm(edits))
                base_exp = int(render_meta.get("expected_editor_ms") or base_eff)
                render_meta["effective_edits_ms"] = base_eff + added_ms
                render_meta["expected_editor_ms"] = base_exp + added_ms

        brand = edits.get("brand") if isinstance(edits.get("brand"), dict) else {}
        if not render_meta.get("effective_edits_ms"):
            from clips_worker.edits_render import output_duration_ms

            render_meta["expected_editor_ms"] = int(
                render_meta.get("expected_editor_ms") or output_duration_ms(edits)
            )
            render_meta["effective_edits_ms"] = output_duration_ms(edits)
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

        from clips_worker.export_progress import active as _active_tracker

        active_tracker = _active_tracker()
        if active_tracker is not None:
            active_tracker.check()
        progress_stack.close()  # FV4a: stop the progress reporter + PATH shim before the upload
        _assert_still_owned(conn, job)
        post_progress(
            job["id"],
            {"jobStatus": "RUNNING", "stage": "render_clip", "progress": overall_progress("upload", 0.0), "etaSeconds": ETA_UPLOAD_S},
        )
        _export_stage_log(render_id, "pre_upload", t_job)
        pre_deliver = out_mp4
        from clips_worker.export_deliver import normalize_deliver, deliver as run_deliver, srt_slice

        deliver_spec = normalize_deliver(payload.get("deliver"))
        out_ext = "mp4"
        content_type = "video/mp4"
        upload_srt = srt_body
        final_out = pre_deliver
        if deliver_spec:
            fmt = deliver_spec.get("format") or "mp4"
            if fmt in ("gif", "mp3", "wav", "m4a", "flac", "png"):
                upload_srt = None
            rin, rout = deliver_spec.get("rangeInMs"), deliver_spec.get("rangeOutMs")
            if upload_srt and rin is not None and rout is not None and not deliver_spec.get("softSubs"):
                upload_srt = srt_slice(upload_srt, rin, rout)
            final_out, out_ext, content_type = run_deliver(pre_deliver, td_path, deliver_spec, srt_body if deliver_spec.get("softSubs") else None)
        stems_key = None
        if deliver_spec and deliver_spec.get("stems"):
            stems_ctx = render_meta.get("stems_ctx")
            if isinstance(stems_ctx, dict) and stems_ctx.get("video"):
                from clips_worker.export_stems import pack_stems_zip

                stems_zip = td_path / "stems.zip"
                pack_stems_zip(stems_ctx, td_path, stems_zip)
                stems_key = (
                    f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/renders/{render_id}.stems.zip"
                )
                upload_file(stems_key, stems_zip, "application/zip")
        out_key = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/renders/{render_id}.{out_ext}"
        srt_key = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/renders/{render_id}.srt"
        upload_file(out_key, final_out, content_type)
        if upload_srt and out_ext in ("mp4", "mov"):
            upload_text(srt_key, upload_srt, "text/plain; charset=utf-8")
        else:
            srt_key = None
        # E6: upload finished — show movement past 82% (stage stays render_clip: it is also the project stage).
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "render_clip", "progress": overall_progress("upload", 0.5), "etaSeconds": 5})
        size = final_out.stat().st_size
        from clips_worker.edits_render import output_duration_ms

        expected_editor_ms = int(render_meta.get("expected_editor_ms") or output_duration_ms(edits))
        expected_effective_ms = int(render_meta.get("effective_edits_ms") or expected_editor_ms)
        expected_editor_s = expected_editor_ms / 1000.0
        expected_effective_s = expected_effective_ms / 1000.0
        actual_s = _probe_duration_sec(pre_deliver)
        length_mismatch = (
            abs(actual_s - expected_effective_s) > 0.35
            or expected_effective_s < 0.6 * expected_editor_s
        )
        print(
            f"[clipper:duration] {json.dumps({'renderId': render_id, 'expected_editor_s': round(expected_editor_s, 3), 'expected_effective_s': round(expected_effective_s, 3), 'actual_s': round(actual_s, 3), 'length_mismatch': length_mismatch})}",
            flush=True,
        )
        _export_decision(
            render_id,
            "duration_check",
            expected_editor_s=round(expected_editor_s, 3),
            expected_effective_s=round(expected_effective_s, 3),
            expected_s=round(expected_effective_s, 3),
            actual_s=round(actual_s, 3),
            delta_s=round(actual_s - expected_effective_s, 3),
            length_mismatch=length_mismatch,
        )
        _assert_still_owned(conn, job)
        mark_render(conn, render_id, "READY", out_key, size, None, srt_key, stems_key)
        _clear_stale_project_render_error(conn, str(ctx.get("projectId") or ""))
        if render_meta.get("fit_fallback"):
            merge_job_fit_fallback_payload(conn, job["id"], str(render_meta.get("speakercrop_tail") or ""))
        if render_meta.get("warnings"):
            from clips_worker.render_export_warnings import merge_job_export_warnings

            merge_job_export_warnings(conn, job["id"], list(render_meta["warnings"]))
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
        _export_stage_log(render_id, "done", t_job, {"sizeBytes": size})
