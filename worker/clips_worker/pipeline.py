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


def insert_clips_batch(conn, rows: list[dict]) -> None:
    if not rows:
        return
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(
                """
                INSERT INTO clips (
                  id, "projectId", "workspaceId", title, reason,
                  "startMs", "endMs", score, scores,
                  "previewKey", "posterKey", "wordsKey", "cropKey", edits, "aiMeta",
                  favorite, "createdAt", "updatedAt"
                ) VALUES (
                  %s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s::jsonb,false,NOW(),NOW()
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    row["id"],
                    row["projectId"],
                    row["workspaceId"],
                    row["title"],
                    row.get("reason"),
                    row["startMs"],
                    row["endMs"],
                    row["score"],
                    json.dumps(row.get("scores") or {}),
                    row.get("previewKey"),
                    row.get("posterKey"),
                    row.get("wordsKey"),
                    row.get("cropKey"),
                    json.dumps(row.get("edits") or {}),
                    json.dumps(row.get("aiMeta") or {}),
                ),
            )
    conn.commit()


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
) -> tuple[Path, str, dict]:
    """Pick speaker-follow vs fit-blur based on sustained face presence."""
    from clips_worker.subject_reframe import has_face_and_speech, write_motion_crop_track

    reframe_settings = dict(settings)
    clip_words = json.loads(words_path.read_text())
    crop_method = "speaker_follow"

    render_meta: dict = {}

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
    if settings.get("streamer"):
        settings = {**settings, "genre": "gaming_stream"}
    job_payload = {}
    if job:
        job_payload = job.get("payload") or {}
        if isinstance(job_payload, str):
            job_payload = json.loads(job_payload)
    workspace_id = project["workspaceId"]
    project_id = project["id"]
    range_start = int(project.get("rangeStartMs") or 0)
    range_end = int(project.get("rangeEndMs") or 0)

    mode = settings.get("mode") or "talking"
    source_duration_ms = max(1, range_end - range_start) if range_end > range_start else 0
    settings = {**settings, "projectId": project_id}
    if source_duration_ms > 0:
        settings = {**settings, "sourceDurationMs": source_duration_ms}
    pipeline_t0 = time.monotonic()
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
                rendered_spans: set[tuple[int, int]] = set()
                persisted_spans: set[tuple[int, int]] = set()
                span_lock = threading.Lock()
                head_executor = ThreadPoolExecutor(max_workers=1)
                head_render_state: dict = {"by_span": {}}

                def _overlap_existing(start_ms: int, end_ms: int) -> bool:
                    with span_lock:
                        for a0, a1 in rendered_spans:
                            overlap = max(0, min(a1, end_ms) - max(a0, start_ms))
                            span = max(1, min(a1 - a0, end_ms - start_ms))
                            if overlap / span >= 0.35:
                                return True
                    return False

                def _mark_span(start_ms: int, end_ms: int) -> bool:
                    with span_lock:
                        if _overlap_existing(start_ms, end_ms):
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
                        insert_clips_batch(ins_conn, [row])
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

                def build_clip_row_from_pick(pick: dict, idx: int) -> dict:
                    clip_id = f"clip_{uuid.uuid4().hex}"
                    clip_file = td_path / f"clip_{idx}.mp4"
                    ffmpeg_cut(src, clip_file, pick["start_ms"], pick["end_ms"])
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
                    sk = _span_key(pick["start_ms"], pick["end_ms"])
                    if not _mark_span(pick["start_ms"], pick["end_ms"]):
                        return
                    try:
                        row = build_clip_row_from_pick(pick, clip_index)
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
                    if not early_picks:
                        return
                    top = early_picks[0]
                    print(
                        f"[clipper:speed] project={project_id} phase=headstart_render_begin "
                        f"startMs={top.get('start_ms')} endMs={top.get('end_ms')}",
                        flush=True,
                    )
                    head_executor.submit(_render_pick_async, top, 0, max(1, len(early_picks)))

                picks, picker_message = pick_talking_clips(
                    words,
                    str(audio_wav),
                    settings,
                    range_start,
                    range_end,
                    on_headstart_picks=on_headstart,
                )
                head_executor.shutdown(wait=True)
                print(
                    f"[clipper:speed] project={project_id} phase=pick_ms="
                    f"{int((time.monotonic() - pick0) * 1000)} picks={len(picks)}",
                    flush=True,
                )
                post_progress(job_id, {"projectStatus": "FINDING_CLIPS", "stage": "picker_done", "progress": 55, "jobStatus": "RUNNING"})

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

                    def on_talking_reframe_complete(idx: int, row: dict) -> None:
                        _persist_clip_row(row, idx, total_talking)

                    def build_talking_clip_row(idx: int) -> dict:
                        pick = picks[idx]
                        sk = _span_key(pick["start_ms"], pick["end_ms"])
                        cached = head_render_state["by_span"].get(sk)
                        if cached is not None:
                            return cached
                        if not _mark_span(pick["start_ms"], pick["end_ms"]):
                            for other in head_render_state["by_span"].values():
                                if _span_key(other["startMs"], other["endMs"]) == sk:
                                    return other
                            raise RuntimeError(f"clip span overlap blocked render idx={idx}")
                        return build_clip_row_from_pick(pick, idx)

                    index_order = sorted(
                        range(len(picks)),
                        key=lambda i: -float(picks[i].get("score") or 0),
                    )
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

                def on_reframe_complete(idx: int, row: dict) -> None:
                    nonlocal clips_ready_count
                    with psycopg2.connect(dsn) as ins_conn:
                        insert_clips_batch(ins_conn, [row])
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

                def build_clip_row(idx: int) -> dict:
                    pick = picks[idx]
                    clip_id = f"clip_{uuid.uuid4().hex}"
                    clip_file = td_path / f"clip_{idx}.mp4"
                    ffmpeg_cut(src, clip_file, pick["start_ms"], pick["end_ms"])
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
                clip_rows = run_bounded_indexed_pool(
                    len(picks),
                    render_conc,
                    build_clip_row,
                    on_start=on_reframe_start,
                    on_complete=on_reframe_complete,
                    index_order=index_order,
                )

            clips_ready_final = len(clip_rows)
            post_progress(
                job_id,
                {
                    "projectStatus": "RENDERING",
                    "stage": "finalizing",
                    "progress": 92,
                    "jobStatus": "RUNNING",
                    "clipsTotal": total,
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
        from clips_worker.vision_layout import log_project_vision_stats

        print(
            f"[clipper:speed] project={project_id} phase=pipeline_total_ms="
            f"{int((time.monotonic() - pipeline_t0) * 1000)}",
            flush=True,
        )
        log_project_vision_stats(project_id)
        from clips_worker.picker_stats import log_project_pass2_stats

        log_project_pass2_stats(project_id)
