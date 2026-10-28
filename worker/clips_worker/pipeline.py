"""M4 pipeline: find clips, reframe, render, persist."""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import psycopg2

from clips_worker.clip_progress import reframe_progress_payload
from clips_worker.clip_span_resolve import resolve_picks_for_render

from clips_worker.anything_picker import pick_anything_clips
from clips_worker.picker import pick_talking_clips
from clips_worker.bounded_pool import run_bounded_indexed_pool
from clips_worker.render_clip import ffmpeg_cut, poster_jpg, resolve_clip_layout, run_speakercrop, slice_words
from clips_worker.render_concurrency import clips_render_concurrency
from clips_worker.clip_ai_meta import finalize_clip_ai_meta
from clips_worker.clip_polish import apply_clip_polish_initial
from clips_worker.probe import probe_duration
from clips_worker.storage import download_object, put_json, upload_file


def extract_wav_for_picker(src: Path, audio_wav: Path) -> None:
    """16 kHz mono WAV for picker / energy analysis (shared by PROCESS_PROJECT and REPLACE_CLIP)."""
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ac", "1", "-ar", "16000", str(audio_wav)],
    )


def clip_keys(workspace_id: str, project_id: str, clip_id: str) -> dict[str, str]:
    base = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}"
    return {
        "preview": f"{base}/preview.mp4",
        "poster": f"{base}/poster.jpg",
        "words": f"{base}/words.json",
        "crop_track": f"{base}/crop_track.json",
    }


def insert_clips_batch(conn, rows: list[dict]) -> int:
    """Insert clip rows; skip duplicates for same project segment. Returns rows inserted."""
    if not rows:
        return 0
    from clips_worker.clip_segments import row_segment_key
    from clips_worker.stage_log import stage_span

    inserted = 0
    with stage_span("db_write_clips", count=len(rows)):
        with conn.cursor() as cur:
            for row in rows:
                seg_key = row.get("segmentKey") or row_segment_key(row)
                params = (
                    row["id"],
                    row["projectId"],
                    row["workspaceId"],
                    row["title"],
                    row.get("reason"),
                    row["startMs"],
                    row["endMs"],
                    seg_key,
                    row["score"],
                    json.dumps(row.get("scores") or {}),
                    row.get("previewKey"),
                    row.get("posterKey"),
                    row.get("wordsKey"),
                    row.get("cropKey"),
                    json.dumps(row.get("edits") or {}),
                    json.dumps(row.get("aiMeta") or {}),
                )
                insert_sql = """
                    INSERT INTO clips (
                      id, "projectId", "workspaceId", title, reason,
                      "startMs", "endMs", "segmentKey", score, scores,
                      "previewKey", "posterKey", "wordsKey", "cropKey", edits, "aiMeta",
                      favorite, "createdAt", "updatedAt"
                    ) VALUES (
                      %s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s::jsonb,false,NOW(),NOW()
                    )
                """
                if seg_key is None:
                    cur.execute(insert_sql, params)
                else:
                    cur.execute(
                        insert_sql
                        + """
                    ON CONFLICT ("projectId", "segmentKey")
                    WHERE "deletedAt" IS NULL AND "segmentKey" IS NOT NULL
                    DO NOTHING
                    """,
                        params,
                    )
                if cur.rowcount:
                    inserted += 1
        conn.commit()
    return inserted


def write_fit_blur_crop_track(video: Path, crop_out: Path, clip_start_ms: int) -> None:
    """Static wide crop track (x0=-1) for fit-blur fallback."""
    import subprocess as sp

    out = sp.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate",
            "-of",
            "json",
            str(video),
        ],
        text=True,
    )
    data = json.loads(out)["streams"][0]
    w, h = int(data["width"]), int(data["height"])
    fps_s = str(data.get("r_frame_rate", "30/1"))
    if "/" in fps_s:
        a, b = fps_s.split("/")
        fps = float(a) / max(1.0, float(b))
    else:
        fps = float(fps_s)
    dur_ms = int(
        float(
            sp.check_output(
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
        )
        * 1000
    )
    n = max(1, int(dur_ms / 1000 * fps))
    track = {
        "v": 1,
        "W": w,
        "H": h,
        "cw": w,
        "fps": fps,
        "t0_ms": clip_start_ms,
        "x0": [-1] * n,
        "x0_A": [-1] * n,
        "x0_B": [-1] * n,
        "shots": [{"start_ms": clip_start_ms, "end_ms": clip_start_ms + dur_ms, "spk": "A"}],
    }
    crop_out.write_text(json.dumps(track, separators=(",", ":")))


def reframe_clip_preview(
    clip_file: Path,
    out_mp4: Path,
    words_path: Path,
    settings: dict,
    work_dir: Path,
    clip_start_ms: int,
    crop_track_path: Path,
    ai_meta: dict,
    *,
    motion_subject: bool,
    clip_index: int = 0,
    conn=None,
    workspace_id: str | None = None,
    project_id: str | None = None,
    clip_id: str | None = None,
) -> tuple[Path, str, dict]:
    """Pick speaker-follow vs fit-blur based on sustained face presence."""
    from clips_worker.subject_reframe import has_face_and_speech, write_motion_crop_track

    reframe_settings = dict(settings)
    clip_words = json.loads(words_path.read_text())
    crop_method = "speaker_follow"

    render_meta: dict = {}

    layout_cfg = settings.get("layout") if isinstance(settings.get("layout"), dict) else {}
    layout_mode = str(layout_cfg.get("mode") or "speaker_follow").lower()
    needs_speaker_reframe = motion_subject or bool(settings.get("autoZoom"))
    if layout_mode in ("fit_blur", "fit_top", "fit", "center_crop", "full_frame", "fill"):
        needs_speaker_reframe = False

    if not needs_speaker_reframe:
        from clips_worker.render_clip import aspect_size, ffmpeg_fit_export

        aspect = str(settings.get("aspectRatio") or "9:16")
        w, h = aspect_size(aspect, "720p")
        ffmpeg_fit_export(clip_file, out_mp4, w, h)
        write_fit_blur_crop_track(clip_file, crop_track_path, clip_start_ms)
        return out_mp4, "fit_blur", reframe_settings

    if has_face_and_speech(clip_file, clip_words):
        rendered = run_speakercrop(
            clip_file,
            out_mp4,
            words_path,
            reframe_settings,
            work_dir,
            clip_start_ms=clip_start_ms,
            crop_track_out=crop_track_path,
            render_meta=render_meta,
            clip_index=clip_index,
            conn=conn,
            workspace_id=workspace_id,
            project_id=project_id,
            clip_id=clip_id,
        )
        if render_meta.get("layoutRouteShadow"):
            ai_meta["layoutRouteShadow"] = render_meta["layoutRouteShadow"]
        return rendered, crop_method, reframe_settings

    preserve_crop_track = False
    if motion_subject:
        wide = write_motion_crop_track(
            clip_file,
            crop_track_path,
            ai_meta,
            clip_start_ms,
            work_dir / "motion",
        )
        if wide:
            crop_method = "fit_blur"
            reframe_settings = {**reframe_settings, "layout": "fit"}
            write_fit_blur_crop_track(clip_file, crop_track_path, clip_start_ms)
        else:
            crop_method = "subject_follow"
            preserve_crop_track = True
    else:
        crop_method = "fit_blur"
        reframe_settings = {**reframe_settings, "layout": "fit"}
        write_fit_blur_crop_track(clip_file, crop_track_path, clip_start_ms)

    rendered = run_speakercrop(
        clip_file,
        out_mp4,
        words_path,
        reframe_settings,
        work_dir,
        clip_start_ms=clip_start_ms,
        crop_track_out=crop_track_path,
        preserve_existing_crop_track=preserve_crop_track,
        render_meta=render_meta,
        clip_index=clip_index,
        conn=conn,
        workspace_id=workspace_id,
        project_id=project_id,
        clip_id=clip_id,
    )
    if render_meta.get("layoutRouteShadow"):
        ai_meta["layoutRouteShadow"] = render_meta["layoutRouteShadow"]
    if not crop_track_path.exists():
        write_fit_blur_crop_track(clip_file, crop_track_path, clip_start_ms)
        crop_method = "fit_blur"
        reframe_settings = {**reframe_settings, "layout": "fit"}
    return rendered, crop_method, reframe_settings


def initial_clip_edits(settings: dict) -> dict:
    brand = settings.get("brand") or {}
    cap = dict(settings.get("captions") or {})
    cap_preset = brand.get("captionPreset") or {}
    if isinstance(cap_preset, dict):
        cap = {**cap, **cap_preset}
    edits: dict = {"captions": cap}
    aspect = settings.get("aspectRatio") or "9:16"
    edits["aspectRatio"] = aspect
    if settings.get("autoZoom"):
        edits["zoom"] = {"enabled": True, "intensity": 1.08}
        cap["keywordHighlight"] = True
    if settings.get("autoEmojis"):
        cap["autoEmojis"] = True
    if brand:
        edits["brand"] = {
            "templateId": brand.get("templateId"),
            "logoKey": brand.get("logoKey"),
            "logoPosition": brand.get("logoPosition"),
            "logoSizePct": brand.get("logoSizePct"),
            "logoOpacity": brand.get("logoOpacity"),
            "primaryColor": brand.get("primaryColor"),
            "introVideoKey": brand.get("introVideoKey"),
            "outroVideoKey": brand.get("outroVideoKey"),
            "useIntro": brand.get("useIntro", True),
            "useOutro": brand.get("useOutro", True),
        }
    return edits


def streamer_initial_clip_edits(
    settings: dict,
    vod: dict | None = None,
    *,
    suggested_headline: str = "",
    clip_start_ms: int = 0,
    clip_end_ms: int = 0,
) -> dict:
    """Default stream clip editor: fit_top + headline bar when headline on, else fit_blur."""
    from clips_worker.stream_headline_ass import format_headline_for_export

    edits = initial_clip_edits(settings)
    edits["v"] = 2
    if clip_end_ms > clip_start_ms:
        edits["trim"] = {"in": int(clip_start_ms), "out": int(clip_end_ms)}

    platform = str((vod or {}).get("platform") or "twitch").lower()
    if platform not in ("twitch", "kick"):
        platform = "twitch"
    vod_state = (vod or {}).get("state") or {}
    if isinstance(vod_state, str):
        import json as _json

        vod_state = _json.loads(vod_state) if vod_state else {}
    login = str(
        (vod or {}).get("channelLogin")
        or (vod_state.get("channelLogin") if isinstance(vod_state, dict) else "")
        or ""
    ).strip().lower()
    channel_url = (vod or {}).get("url") or ""
    if login:
        channel_url = f"https://kick.com/{login}" if platform == "kick" else f"https://twitch.tv/{login}"
    elif channel_url and not str(channel_url).startswith("http"):
        channel_url = f"https://{channel_url}"

    headline_text = format_headline_for_export(suggested_headline or "")
    headline_on = bool(headline_text)
    layout_mode = "fit_top" if headline_on else "fit_blur"
    edits["layout"] = {"mode": layout_mode, "shotOverrides": []}

    streamer_cfg = settings.get("streamer") if isinstance(settings.get("streamer"), dict) else {}
    chat_cfg = streamer_cfg.get("chatOverlay") if isinstance(streamer_cfg.get("chatOverlay"), dict) else {}
    edits["chatOverlay"] = {
        "enabled": bool(chat_cfg.get("enabled")),
        "position": chat_cfg.get("position") or "bottom",
        "opacity": float(chat_cfg.get("opacity") or 0.6),
    }

    edits["exportTemplate"] = {
        "headlineBar": {"enabled": headline_on, "text": headline_text},
        "platformBadge": {"enabled": True},
        "channelLink": {
            "enabled": bool(channel_url),
            "url": str(channel_url)[:200] if channel_url else None,
        },
        "suggestedHeadline": headline_text or suggested_headline[:120] if suggested_headline else "",
        "platform": platform,
        "exportPlatformId": "tiktok",
    }
    return edits


def _finalize_regular_clip_edits(
    edits: dict,
    clip_file: Path,
    clip_words: list[dict],
    settings: dict,
    mode: str,
) -> dict:
    if mode == "anything" or settings.get("streamer"):
        return edits
    from clips_worker.regular_auto_layout import apply_regular_auto_layout

    return apply_regular_auto_layout(
        edits,
        clip_file,
        clip_words,
        streamer=bool(settings.get("streamer")),
    )


def mark_project_ready(conn, project_id: str, error: str | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_projects
            SET status = 'READY', stage = 'ready', progress = 100, error = %s, "updatedAt" = NOW()
            WHERE id = %s
            """,
            (error, project_id),
        )
    conn.commit()


def _span_key(start_ms: int, end_ms: int) -> tuple[int, int]:
    return (int(start_ms), int(end_ms))


def run_m4_pipeline(
    conn,
    job_id: str,
    project: dict,
    words: list[dict],
    source_key: str,
    post_progress,
    job: dict | None = None,
    local_src: Path | None = None,
    local_audio_wav: Path | None = None,
) -> None:
    settings = project.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    job_payload = {}
    if job:
        job_payload = job.get("payload") or {}
        if isinstance(job_payload, str):
            job_payload = json.loads(job_payload)
    workspace_id = project["workspaceId"]
    project_id = project["id"]
    range_start = int(project.get("rangeStartMs") or 0)
    range_end = int(project.get("rangeEndMs") or 0)

    from clips_worker.content_detection import normalize_content_mode

    mode = normalize_content_mode(settings.get("mode"))
    source_duration_ms = max(1, range_end - range_start) if range_end > range_start else 0
    from clips_worker.target_clip_len import enrich_settings_with_clip_length

    settings = enrich_settings_with_clip_length(
        {**settings, "projectId": project_id},
        job_payload,
    )
    if source_duration_ms > 0:
        settings = {**settings, "sourceDurationMs": source_duration_ms}
    pipeline_t0 = time.monotonic()
    from clips_worker.stage_log import bind_stage_context, stage_span

    bind_stage_context(project_id=project_id, job_id=job_id)
    from clips_worker.job_telemetry import bind_job_telemetry, make_picker_cache_telemetry_sink

    job_pl_state: dict = dict(job_payload) if job else {}
    bind_job_telemetry(
        make_picker_cache_telemetry_sink(conn, job_id, job_pl_state) if job_id else None
    )
    from clips_worker.clip_segments import load_project_segment_spans, load_project_segments_with_preview

    existing_segments = load_project_segment_spans(conn, project_id)
    existing_preview_segments = load_project_segments_with_preview(conn, project_id)
    try:
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            src = local_src if local_src is not None else td_path / "source.mp4"
            if local_src is None:
                dl0 = time.monotonic()
                download_object(source_key, src)
                print(
                    f"[clipper:speed] project={project_id} phase=pipeline_source_download_ms="
                    f"{int((time.monotonic() - dl0) * 1000)}",
                    flush=True,
                )
            audio_wav = local_audio_wav if local_audio_wav is not None else td_path / "audio.wav"
            if local_audio_wav is None:
                extract_wav_for_picker(src, audio_wav)
            talking_render_done = False
            talking_clip_rows: list[dict] | None = None
            if job_payload.get("singleClip"):
                dur_ms = int(round(probe_duration(src) * 1000))
                start_ms = range_start
                end_ms = range_end if range_end > range_start else dur_ms
                picks = [
                    {
                        "start_ms": start_ms,
                        "end_ms": end_ms,
                        "score": 100,
                        "title": project.get("title") or "Clip",
                        "reason": "Imported clip",
                        "hook": "Imported clip",
                    }
                ]
                picker_message = None
            elif mode == "anything":
                post_progress(
                    job_id,
                    {"projectStatus": "SCANNING", "stage": "scanning", "progress": 55, "jobStatus": "RUNNING"},
                )
                with stage_span("scene_scan", heartbeat=True):
                    picks, picker_message = pick_anything_clips(
                        conn,
                        src,
                        words,
                        settings,
                        range_start,
                        range_end,
                        workspace_id,
                        project_id,
                        td_path,
                    )
                post_progress(
                    job_id,
                    {"projectStatus": "FINDING_CLIPS", "stage": "vision_rank", "progress": 58, "jobStatus": "RUNNING"},
                )
            elif settings.get("streamer") and not job_payload.get("singleClip"):
                from clips_worker.streamer.keys import stream_signals_key
                from clips_worker.streamer.rank import rank_moments

                post_progress(
                    job_id,
                    {"projectStatus": "FINDING_CLIPS", "stage": "Finding moments", "progress": 52, "jobStatus": "RUNNING"},
                )
                dur_ms = range_end if range_end > range_start else int(round(probe_duration(src) * 1000))
                fusion_picks, signals_payload = rank_moments(
                    audio_path=audio_wav,
                    words=words,
                    duration_ms=dur_ms,
                    settings=settings,
                )
                picks = [
                    {
                        "start_ms": p.start_ms,
                        "end_ms": p.end_ms,
                        "score": p.score,
                        "title": p.title,
                        "reason": p.hook,
                        "hook": p.hook,
                        "scores": p.scores,
                        "aiMeta": p.ai_meta,
                    }
                    for p in fusion_picks
                ]
                picker_message = None
                with conn.cursor() as cur:
                    cur.execute('SELECT id FROM stream_vods WHERE "projectId" = %s LIMIT 1', (project_id,))
                    row = cur.fetchone()
                if row:
                    sig_key = stream_signals_key(workspace_id, row[0])
                    put_json(sig_key, signals_payload)
                    with conn.cursor() as cur:
                        cur.execute(
                            'UPDATE stream_vods SET "signalsKey" = %s, "updatedAt" = NOW() WHERE id = %s',
                            (sig_key, row[0]),
                        )
                    conn.commit()
                post_progress(job_id, {"projectStatus": "FINDING_CLIPS", "stage": "picker_done", "progress": 55, "jobStatus": "RUNNING"})
            else:
                post_progress(
                    job_id,
                    {"projectStatus": "FINDING_CLIPS", "stage": "finding_clips", "progress": 52, "jobStatus": "RUNNING"},
                )
                post_progress(job_id, {"projectStatus": "FINDING_CLIPS", "stage": "picker_pass1", "progress": 52, "jobStatus": "RUNNING"})
                pick0 = time.monotonic()
                render_conc = clips_render_concurrency()
                rendered_spans = set(existing_segments)
                persisted_spans = set(existing_segments)
                span_lock = threading.Lock()
                head_executor = ThreadPoolExecutor(max_workers=1)
                head_render_state: dict = {"by_span": {}, "clip_id_by_span": {}, "head_future": None, "headstart_pick": None}
                head_future = None
                headstart_pick: dict | None = None
                from clips_worker.clip_segments import spans_same_segment

                def _headstart_row_for_pick(pick: dict) -> dict | None:
                    sk = _span_key(int(pick["start_ms"]), int(pick["end_ms"]))
                    by_span = head_render_state.get("by_span") or {}
                    row = by_span.get(sk)
                    if row is not None:
                        return row
                    s0, e0 = int(pick["start_ms"]), int(pick["end_ms"])
                    for cached in by_span.values():
                        rs, re = int(cached["startMs"]), int(cached["endMs"])
                        if spans_same_segment(rs, re, s0, e0):
                            return cached
                    if headstart_pick is not None:
                        hs = int(headstart_pick["start_ms"])
                        he = int(headstart_pick["end_ms"])
                        if spans_same_segment(hs, he, s0, e0):
                            return by_span.get(_span_key(hs, he))
                    return None

                def _overlap_existing_locked(start_ms: int, end_ms: int) -> bool:
                    """Caller must hold span_lock (non-reentrant threading.Lock)."""
                    for a0, a1 in rendered_spans:
                        if spans_same_segment(a0, a1, start_ms, end_ms):
                            continue
                        overlap = max(0, min(a1, end_ms) - max(a0, start_ms))
                        span = max(1, min(a1 - a0, end_ms - start_ms))
                        if overlap / span >= 0.35:
                            return True
                    return False

                def _mark_span(start_ms: int, end_ms: int) -> bool:
                    with span_lock:
                        if _overlap_existing_locked(start_ms, end_ms):
                            return False
                        rendered_spans.add(_span_key(start_ms, end_ms))
                        return True

                reframe_started_at = time.time()
                clips_ready_lock = threading.Lock()
                clips_ready_count = 0
                dsn = os.environ["DATABASE_URL"]

                def _persist_clip_row(row: dict, clip_index: int, clips_total: int) -> None:
                    nonlocal clips_ready_count
                    sk = _span_key(int(row["startMs"]), int(row["endMs"]))
                    with span_lock:
                        if sk in persisted_spans:
                            return
                        persisted_spans.add(sk)
                    with psycopg2.connect(dsn) as ins_conn:
                        inserted = insert_clips_batch(ins_conn, [row])
                    if not inserted:
                        return
                    with clips_ready_lock:
                        clips_ready_count += 1
                        ready = clips_ready_count
                    post_progress(
                        job_id,
                        reframe_progress_payload(
                            clip_index, clips_total, reframe_started_at, render_conc, clips_ready=ready
                        ),
                    )
                    print(
                        f"[clipper:progress] job={job_id} project={project_id} event=clip_ready "
                        f"clip_index={clip_index + 1} clips_ready={ready} clips_total={clips_total}",
                        flush=True,
                    )
                    if ready == 1:
                        print(
                            f"[clipper:speed] project={project_id} phase=first_clip_card_ms="
                            f"{int((time.monotonic() - pipeline_t0) * 1000)}",
                            flush=True,
                        )

                def build_clip_row_from_pick(pick: dict, idx: int, clip_id: str | None = None) -> dict:
                    sk_pick = _span_key(int(pick["start_ms"]), int(pick["end_ms"]))
                    clip_id = clip_id or head_render_state.get("clip_id_by_span", {}).get(sk_pick)
                    clip_id = clip_id or f"clip_{uuid.uuid4().hex}"
                    head_render_state.setdefault("clip_id_by_span", {})[sk_pick] = clip_id
                    clip_file = td_path / f"clip_{idx}.mp4"
                    ffmpeg_cut(src, clip_file, pick["start_ms"], pick["end_ms"], clip_index=idx)
                    clip_words = slice_words(words, pick["start_ms"], pick["end_ms"])
                    words_path = td_path / f"words_{idx}.json"
                    words_path.write_text(json.dumps(clip_words))

                    out_mp4 = td_path / f"out_{idx}.mp4"
                    crop_track_path = td_path / f"crop_track_{idx}.json"
                    ai_meta = pick.get("aiMeta") or {}
                    resolved_layout = resolve_clip_layout(settings, idx)
                    clip_settings = {**settings, "layout": resolved_layout}
                    rendered, crop_method, _reframe_settings = reframe_clip_preview(
                        clip_file,
                        out_mp4,
                        words_path,
                        clip_settings,
                        td_path / f"reframe_work_{idx}",
                        pick["start_ms"],
                        crop_track_path,
                        ai_meta,
                        motion_subject=mode == "anything",
                        clip_index=idx,
                        conn=conn,
                        workspace_id=workspace_id,
                        project_id=project_id,
                        clip_id=clip_id,
                    )
                    poster = td_path / f"poster_{idx}.jpg"
                    poster_jpg(rendered, poster)

                    keys = clip_keys(workspace_id, project_id, clip_id)
                    upload_file(keys["preview"], rendered, "video/mp4")
                    upload_file(keys["poster"], poster, "image/jpeg")
                    put_json(keys["words"], clip_words)
                    crop_key = None
                    if crop_track_path.exists():
                        upload_file(keys["crop_track"], crop_track_path, "application/json")
                        crop_key = keys["crop_track"]
                    elif mode == "anything":
                        raise RuntimeError(f"ClipAnything clip missing crop track: {clip_id}")

                    ai_meta_out = finalize_clip_ai_meta(pick, ai_meta, crop_method, resolved_layout)
                    if mode == "anything" and not crop_key:
                        raise RuntimeError(f"ClipAnything clip missing cropKey: {clip_id}")

                    return {
                        "id": clip_id,
                        "projectId": project_id,
                        "workspaceId": workspace_id,
                        "title": pick["title"],
                        "reason": pick.get("reason") or pick.get("hook"),
                        "startMs": pick["start_ms"],
                        "endMs": pick["end_ms"],
                        "score": pick["score"],
                        "scores": pick.get("scores") or {},
                        "previewKey": keys["preview"],
                        "posterKey": keys["poster"],
                        "wordsKey": keys["words"],
                        "cropKey": crop_key,
                        "edits": _finalize_regular_clip_edits(
                            apply_clip_polish_initial(
                                initial_clip_edits(settings),
                                pick,
                                clip_words,
                                settings,
                            ),
                            clip_file,
                            clip_words,
                            settings,
                            mode,
                        ),
                        "aiMeta": ai_meta_out,
                    }

                def _render_pick_async(pick: dict, clip_index: int, clips_total_hint: int) -> None:
                    if not _mark_span(pick["start_ms"], pick["end_ms"]):
                        resolved = resolve_picks_for_render([dict(pick)], min_clip_ms=15_000)
                        if resolved:
                            pick["start_ms"] = int(resolved[0]["start_ms"])
                            pick["end_ms"] = int(resolved[0]["end_ms"])
                        if not _mark_span(pick["start_ms"], pick["end_ms"]):
                            with span_lock:
                                rendered_spans.add(_span_key(int(pick["start_ms"]), int(pick["end_ms"])))
                    sk = _span_key(pick["start_ms"], pick["end_ms"])
                    try:
                        cid = head_render_state.get("clip_id_by_span", {}).get(sk)
                        row = build_clip_row_from_pick(pick, clip_index, clip_id=cid)
                        head_render_state["by_span"][sk] = row
                        _persist_clip_row(row, clip_index, clips_total_hint)
                    except Exception as exc:
                        with span_lock:
                            rendered_spans.discard(sk)
                            head_render_state["by_span"].pop(sk, None)
                        print(
                            f"[clipper:speed] project={project_id} phase=headstart_render_failed "
                            f"span={sk} error={exc!s}"[:400],
                            flush=True,
                        )

                def on_headstart(early_picks: list[dict]) -> None:
                    nonlocal head_future, headstart_pick
                    if not early_picks:
                        return
                    top = early_picks[0]
                    headstart_pick = top
                    head_render_state["headstart_pick"] = top
                    sk = _span_key(int(top["start_ms"]), int(top["end_ms"]))
                    if sk not in head_render_state.setdefault("clip_id_by_span", {}):
                        head_render_state["clip_id_by_span"][sk] = f"clip_{uuid.uuid4().hex}"
                    print(
                        f"[clipper:speed] project={project_id} phase=headstart_render_begin "
                        f"startMs={top.get('start_ms')} endMs={top.get('end_ms')}",
                        flush=True,
                    )
                    head_future = head_executor.submit(_render_pick_async, top, 0, max(1, len(early_picks)))

                from clips_worker.picker_checkpoint import load_picker_cache, save_picker_cache
                from clips_worker.process_helpers import job_payload as _job_payload

                picker_cache = load_picker_cache(job_pl_state, settings, range_start, range_end)

                def _checkpoint_picker(moments: list[dict] | None, scored: list[dict] | None) -> None:
                    nonlocal job_pl_state
                    if not job:
                        return
                    job_pl_state = save_picker_cache(
                        conn,
                        job_id,
                        job_pl_state,
                        settings,
                        range_start,
                        range_end,
                        moments=moments,
                        scored=scored,
                    )

                picker_settings = {**settings, "sourceVideoPath": str(src)}
                with stage_span("picker", heartbeat=True):
                    picks, picker_message = pick_talking_clips(
                        words,
                        str(audio_wav),
                        picker_settings,
                        range_start,
                        range_end,
                        on_headstart_picks=on_headstart,
                        picker_cache=picker_cache,
                        on_picker_checkpoint=_checkpoint_picker,
                    )
                post_progress(
                    job_id,
                    {"projectStatus": "FINDING_CLIPS", "stage": "picker_done", "progress": 55, "jobStatus": "RUNNING"},
                )
                vp_cache = (job_pl_state.get("pickerCache") or {}).get("videoPicker") or {}
                if vp_cache.get("model_used"):
                    post_progress(
                        job_id,
                        {
                            "videoPickerModel": vp_cache.get("model_used"),
                            "videoPickerModelRequested": vp_cache.get("model_requested"),
                            "videoPickerFallback": bool(vp_cache.get("model_fallback")),
                            "videoPickerFallbackReason": vp_cache.get("fallback_reason"),
                        },
                    )
                from clips_worker.headstart_render import await_headstart_render

                with stage_span("headstart_render", heartbeat=True):
                    await_headstart_render(
                        head_executor,
                        head_future,
                        head_render_state=head_render_state,
                        rendered_spans=rendered_spans,
                        persisted_spans=persisted_spans,
                        span_lock=span_lock,
                        span_key=_span_key,
                        headstart_pick=headstart_pick,
                        project_id=project_id,
                    )
                print(
                    f"[clipper:speed] project={project_id} phase=pick_ms="
                    f"{int((time.monotonic() - pick0) * 1000)} picks={len(picks)}",
                    flush=True,
                )

                if picks:
                    total_talking = len(picks)
                    post_progress(
                        job_id,
                        {
                            **reframe_progress_payload(
                                0, total_talking, reframe_started_at, render_conc, clips_ready=clips_ready_count
                            ),
                            "projectStatus": "REFRAMING",
                            "stage": f"reframe_1_of_{total_talking}",
                        },
                    )
                    print(
                        f"[clipper:progress] job={job_id} project={project_id} event=reframe_start clips_total={total_talking}",
                        flush=True,
                    )

                    def on_talking_reframe_start(idx: int, clip_total: int) -> None:
                        post_progress(
                            job_id,
                            reframe_progress_payload(
                                idx, clip_total, reframe_started_at, render_conc, clips_ready=clips_ready_count
                            ),
                        )

                    def on_talking_reframe_complete(idx: int, row: dict | None) -> None:
                        if row is None:
                            return
                        _persist_clip_row(row, idx, total_talking)

                    def build_talking_clip_row(idx: int) -> dict | None:
                        pick = picks[idx]
                        cached = _headstart_row_for_pick(pick)
                        if cached is None:
                            from clips_worker.headstart_render import wait_for_headstart_row

                            cached = wait_for_headstart_row(
                                head_render_state,
                                _span_key,
                                pick,
                                project_id=project_id,
                            )
                        if cached is not None:
                            return cached
                        if not _mark_span(pick["start_ms"], pick["end_ms"]):
                            resolved = resolve_picks_for_render([dict(pick)], min_clip_ms=15_000)
                            if resolved:
                                pick["start_ms"] = int(resolved[0]["start_ms"])
                                pick["end_ms"] = int(resolved[0]["end_ms"])
                            if not _mark_span(pick["start_ms"], pick["end_ms"]):
                                print(
                                    f"[clipper:overlap] project={project_id} force_render idx={idx} "
                                    f"startMs={pick.get('start_ms')} endMs={pick.get('end_ms')}",
                                    flush=True,
                                )
                                with span_lock:
                                    rendered_spans.add(_span_key(int(pick["start_ms"]), int(pick["end_ms"])))
                        sk = _span_key(int(pick["start_ms"]), int(pick["end_ms"]))
                        cid = head_render_state.get("clip_id_by_span", {}).get(sk)
                        return build_clip_row_from_pick(pick, idx, clip_id=cid)

                    index_order = sorted(
                        range(len(picks)),
                        key=lambda i: -float(picks[i].get("score") or 0),
                    )
                    with stage_span("reframe", heartbeat=True, clips=len(picks)):
                        talking_clip_rows = run_bounded_indexed_pool(
                            len(picks),
                            render_conc,
                            build_talking_clip_row,
                            on_start=on_talking_reframe_start,
                            on_complete=on_talking_reframe_complete,
                            index_order=index_order,
                        )
                else:
                    talking_clip_rows = []
                talking_render_done = True

            print(
                f"[clipper:picker] project={project_id} mode={mode} picks={len(picks)} "
                f"message={picker_message!r}",
                flush=True,
            )

            from clips_worker.clip_span_resolve import resolve_overlaps

            picks = resolve_overlaps(picks)

            if not picks:
                empty_msg = picker_message or "No complete, self-contained moments found."
                mark_project_ready(conn, project_id, error=empty_msg)
                post_progress(
                    job_id,
                    {
                        "projectStatus": "READY",
                        "stage": "ready",
                        "progress": 100,
                        "jobStatus": "DONE",
                        "error": empty_msg,
                    },
                )
                return

            total = max(1, len(picks))
            if talking_render_done:
                clip_rows = talking_clip_rows or []
            else:
                render_conc = clips_render_concurrency()
                reframe_started_at = time.time()
                clips_ready_lock = threading.Lock()
                clips_ready_count = 0
                dsn = os.environ["DATABASE_URL"]

                post_progress(
                    job_id,
                    {
                        **reframe_progress_payload(0, total, reframe_started_at, render_conc, clips_ready=0),
                        "projectStatus": "REFRAMING",
                        "stage": f"reframe_1_of_{total}",
                    },
                )
                print(
                    f"[clipper:progress] job={job_id} project={project_id} event=reframe_start clips_total={total}",
                    flush=True,
                )

                def on_reframe_start(idx: int, clip_total: int) -> None:
                    post_progress(
                        job_id,
                        reframe_progress_payload(idx, clip_total, reframe_started_at, render_conc, clips_ready=clips_ready_count),
                    )

                def on_reframe_complete(idx: int, row: dict | None) -> None:
                    nonlocal clips_ready_count
                    if row is None:
                        return
                    sk = _span_key(int(row["startMs"]), int(row["endMs"]))
                    if sk in existing_preview_segments:
                        return
                    with psycopg2.connect(dsn) as ins_conn:
                        inserted = insert_clips_batch(ins_conn, [row])
                    if not inserted:
                        return
                    with clips_ready_lock:
                        clips_ready_count += 1
                        ready = clips_ready_count
                    post_progress(
                        job_id,
                        reframe_progress_payload(idx, total, reframe_started_at, render_conc, clips_ready=ready),
                    )
                    print(
                        f"[clipper:progress] job={job_id} project={project_id} event=clip_ready "
                        f"clip_index={idx + 1} clips_ready={ready} clips_total={total}",
                        flush=True,
                    )
                    if ready == 1:
                        print(
                            f"[clipper:speed] project={project_id} phase=first_clip_card_ms="
                            f"{int((time.monotonic() - pipeline_t0) * 1000)}",
                            flush=True,
                        )

                def build_clip_row(idx: int) -> dict | None:
                    pick = picks[idx]
                    if _span_key(pick["start_ms"], pick["end_ms"]) in existing_preview_segments:
                        return None
                    clip_id = f"clip_{uuid.uuid4().hex}"
                    clip_file = td_path / f"clip_{idx}.mp4"
                    ffmpeg_cut(src, clip_file, pick["start_ms"], pick["end_ms"], clip_index=idx)
                    clip_words = slice_words(words, pick["start_ms"], pick["end_ms"])
                    words_path = td_path / f"words_{idx}.json"
                    words_path.write_text(json.dumps(clip_words))

                    out_mp4 = td_path / f"out_{idx}.mp4"
                    crop_track_path = td_path / f"crop_track_{idx}.json"
                    ai_meta = pick.get("aiMeta") or {}
                    resolved_layout = resolve_clip_layout(settings, idx)
                    clip_settings = {**settings, "layout": resolved_layout}
                    rendered, crop_method, _reframe_settings = reframe_clip_preview(
                        clip_file,
                        out_mp4,
                        words_path,
                        clip_settings,
                        td_path / f"reframe_work_{idx}",
                        pick["start_ms"],
                        crop_track_path,
                        ai_meta,
                        motion_subject=mode == "anything",
                        clip_index=idx,
                        conn=conn,
                        workspace_id=workspace_id,
                        project_id=project_id,
                        clip_id=clip_id,
                    )
                    poster = td_path / f"poster_{idx}.jpg"
                    poster_jpg(rendered, poster)

                    keys = clip_keys(workspace_id, project_id, clip_id)
                    upload_file(keys["preview"], rendered, "video/mp4")
                    upload_file(keys["poster"], poster, "image/jpeg")
                    put_json(keys["words"], clip_words)
                    crop_key = None
                    if crop_track_path.exists():
                        upload_file(keys["crop_track"], crop_track_path, "application/json")
                        crop_key = keys["crop_track"]
                    elif mode == "anything":
                        raise RuntimeError(f"ClipAnything clip missing crop track: {clip_id}")

                    ai_meta_out = finalize_clip_ai_meta(pick, ai_meta, crop_method, resolved_layout)
                    if mode == "anything" and not crop_key:
                        raise RuntimeError(f"ClipAnything clip missing cropKey: {clip_id}")

                    return {
                        "id": clip_id,
                        "projectId": project_id,
                        "workspaceId": workspace_id,
                        "title": pick["title"],
                        "reason": pick.get("reason") or pick.get("hook"),
                        "startMs": pick["start_ms"],
                        "endMs": pick["end_ms"],
                        "score": pick["score"],
                        "scores": pick.get("scores") or {},
                        "previewKey": keys["preview"],
                        "posterKey": keys["poster"],
                        "wordsKey": keys["words"],
                        "cropKey": crop_key,
                        "edits": _finalize_regular_clip_edits(
                            apply_clip_polish_initial(
                                initial_clip_edits(settings),
                                pick,
                                clip_words,
                                settings,
                            ),
                            clip_file,
                            clip_words,
                            settings,
                            mode,
                        ),
                        "aiMeta": ai_meta_out,
                    }

                index_order = sorted(range(len(picks)), key=lambda i: -float(picks[i].get("score") or 0))
                with stage_span("reframe", heartbeat=True, clips=len(picks)):
                    clip_rows = run_bounded_indexed_pool(
                        len(picks),
                        render_conc,
                        build_clip_row,
                        on_start=on_reframe_start,
                        on_complete=on_reframe_complete,
                        index_order=index_order,
                    )

            clips_ready_final = len(load_project_segments_with_preview(conn, project_id))
            post_progress(
                job_id,
                {
                    "projectStatus": "RENDERING",
                    "stage": "finalizing",
                    "progress": 92,
                    "jobStatus": "RUNNING",
                    "clipsTotal": max(total, clips_ready_final),
                    "clipsReady": clips_ready_final,
                },
            )

            if mode == "anything":
                for row in clip_rows:
                    if not row.get("cropKey"):
                        raise RuntimeError(f"pipeline invariant: missing cropKey for clip {row.get('id')}")
            if settings.get("autoStockBroll") and clip_rows:
                from clips_worker.internal_callback import post_project_auto_broll

                post_project_auto_broll(project_id)
            if settings.get("autoEmojis") and clip_rows:
                from clips_worker.internal_callback import post_project_auto_emojis

                post_project_auto_emojis(project_id)
            if clip_rows:
                poster = clip_rows[0].get("posterKey")
                if poster:
                    with conn.cursor() as cur:
                        cur.execute(
                            'UPDATE clip_projects SET "thumbKey" = %s, "updatedAt" = NOW() WHERE id = %s',
                            (poster, project_id),
                        )
                    conn.commit()
            mark_project_ready(conn, project_id)
            post_progress(
                job_id,
                {"projectStatus": "READY", "stage": "ready", "progress": 100, "jobStatus": "DONE", "error": None},
            )
    finally:
        bind_job_telemetry(None)
        from clips_worker.vision_layout import log_project_vision_stats

        print(
            f"[clipper:speed] project={project_id} phase=pipeline_total_ms="
            f"{int((time.monotonic() - pipeline_t0) * 1000)}",
            flush=True,
        )
        print(
            f"[clipper:speed] project={project_id} stage=summary "
            f"total_ms={int((time.monotonic() - pipeline_t0) * 1000)}",
            flush=True,
        )
        log_project_vision_stats(project_id)
        from clips_worker.picker_stats import log_project_pass2_stats

        log_project_pass2_stats(project_id)
