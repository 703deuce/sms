"""STREAM_IMPORT: metadata; audio-first for vod/highlight; video section only for clip kind."""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from clips_worker.heartbeat import Heartbeat
from clips_worker.import_url import probe_video, upload_source_key
from clips_worker.probe import probe_duration
from clips_worker.storage import download_object, upload_file
from clips_worker.streamer.config import FULL_DOWNLOAD_MAX_MIN, PASTE_MAX_VOD_HOURS, SCRATCH
from clips_worker.streamer.keys import stream_audio_key
from clips_worker.streamer.upload_proxy import (
    build_analysis_proxy,
    should_build_upload_proxy,
    stream_analysis_proxy_key,
)
from clips_worker.streamer.usage import check_cap, job_priority
from clips_worker.streamer.import_cache import cleanup_vod_import_dir, pick_completed_audio, sweep_stale_failed_import_dirs, vod_import_dir
from clips_worker.streamer.ytdlp import download_audio, download_video, metadata, parse_metadata


def _enforce_paste_vod_duration_cap(vod: dict, effective_ms: int) -> None:
    """Rick: ~10 h cap for one-shot paste VOD links only; marathon/rolling uses monthly cap."""
    triggered = str(vod.get("triggeredBy") or "paste").lower()
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state) if state else {}
    mode = str((state or {}).get("processMode") or "").lower()
    if triggered != "paste" or mode in ("marathon", "rolling"):
        return
    max_s = PASTE_MAX_VOD_HOURS * 3600
    if effective_ms > max_s * 1000:
        raise RuntimeError(
            f"VOD is longer than {PASTE_MAX_VOD_HOURS} h for paste import. "
            "Connect your channel for marathon mode, pick a shorter range, or wait for highlight batches."
        )


def _extract_upload_audio(
    src: Path,
    audio_out: Path,
    long_form: bool,
    *,
    range_start_ms: int = 0,
    range_end_ms: int = 0,
) -> None:
    args = ["ffmpeg", "-y", "-v", "error"]
    if range_start_ms > 0:
        args.extend(["-ss", f"{range_start_ms / 1000.0:.3f}"])
    args.extend(["-i", str(src), "-vn", "-c:a", "libopus"])
    if range_end_ms > range_start_ms > 0:
        args.extend(["-t", f"{(range_end_ms - range_start_ms) / 1000.0:.3f}"])
    elif range_end_ms > 0:
        args.extend(["-t", f"{range_end_ms / 1000.0:.3f}"])
    if long_form:
        args.extend(["-b:a", "64k"])
    args.append(str(audio_out))
    subprocess.check_call(args)


def _state_for_upload(
    workspace_id: str,
    vod_id: str,
    master_key: str,
    src: Path,
    td: str,
) -> dict:
    """Master stays at master_key; optional 720p proxy for analysis/layout only."""
    state: dict = {"localUploadKey": master_key}
    if should_build_upload_proxy(src.stat().st_size):
        proxy_path = Path(td) / "analysis_proxy.mp4"
        build_analysis_proxy(src, proxy_path)
        proxy_key = stream_analysis_proxy_key(workspace_id, vod_id)
        upload_file(proxy_key, proxy_path, "video/mp4")
        state["analysisProxyKey"] = proxy_key
    return state


def _vod_state_dict(vod: dict) -> dict:
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state) if state else {}
    return state if isinstance(state, dict) else {}


def _rolling_import_mode(vod: dict) -> bool:
    from clips_worker.streamer.config import streamer_twitch_rolling_enabled

    if not streamer_twitch_rolling_enabled():
        return False
    state = _vod_state_dict(vod)
    mode = str(state.get("processMode") or "").lower()
    return mode == "rolling" and str(vod.get("platform") or "").lower() == "twitch"


def _allow_twitch_growing_vod(vod: dict) -> bool:
    """In-progress Twitch archive VOD: rolling mode, or a bounded trim range (latest N minutes)."""
    if _rolling_import_mode(vod):
        return True
    if str(vod.get("platform") or "").lower() != "twitch":
        return False
    start = int(vod.get("rangeStartMs") or 0)
    end = vod.get("rangeEndMs")
    if end is None:
        return False
    return int(end) > start


def _has_pending_stream_import(conn, project_id: str, vod_id: str, *, exclude_job_id: str | None = None) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM clip_jobs
            WHERE "projectId"=%s AND type='STREAM_IMPORT' AND status IN ('QUEUED','RUNNING')
              AND payload->>'vodId'=%s
              AND (%s::text IS NULL OR id <> %s)
            LIMIT 1
            """,
            (project_id, vod_id, exclude_job_id, exclude_job_id),
        )
        return cur.fetchone() is not None


def _has_pending_stream_analyze(conn, project_id: str, vod_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM clip_jobs
            WHERE "projectId"=%s AND type='STREAM_ANALYZE' AND status IN ('QUEUED','RUNNING')
              AND payload->>'vodId'=%s
            LIMIT 1
            """,
            (project_id, vod_id),
        )
        return cur.fetchone() is not None


def _rolling_import_idle_done(
    conn,
    *,
    job: dict,
    vod: dict,
    project_id: str,
    vod_id: str,
    post_progress,
    reason: str,
) -> None:
    from clips_worker.streamer.rolling_ingest import rolling_chunk_min

    state = _vod_state_dict(vod)
    rolling = state.get("rolling") if isinstance(state.get("rolling"), dict) else {}
    if rolling.get("live") and not rolling.get("finalize"):
        chunk_min = rolling_chunk_min(state)
        _schedule_rolling_import_tick(conn, project_id=project_id, vod_id=vod_id, chunk_min=chunk_min)
    print(
        f"[clipper:autopull] rolling_import_deferred vodId={vod_id} projectId={project_id} "
        f"jobId={job['id']} reason={reason}",
        flush=True,
    )
    post_progress(
        job["id"],
        {"projectStatus": "PREPARING", "stage": "live_ingest", "progress": 18, "jobStatus": "DONE"},
    )


def _rolling_preflight_after_meta(
    conn,
    *,
    job: dict,
    vod: dict,
    project_id: str,
    vod_id: str,
    payload: dict,
    post_progress,
    meta_dur_s: float,
) -> bool:
    """Plan rolling window or defer. Returns True when this import job should exit."""
    if not _rolling_import_mode(vod):
        return False
    from clips_worker.streamer.rolling_ingest import (
        apply_rolling_pull_plan,
        rolling_chunk_min,
        stop_rolling_session,
    )

    if _has_pending_stream_analyze(conn, project_id, vod_id):
        _rolling_import_idle_done(
            conn,
            job=job,
            vod=vod,
            project_id=project_id,
            vod_id=vod_id,
            post_progress=post_progress,
            reason="analyze_pending",
        )
        return True
    if _has_pending_stream_import(conn, project_id, vod_id, exclude_job_id=str(job["id"])):
        _rolling_import_idle_done(
            conn,
            job=job,
            vod=vod,
            project_id=project_id,
            vod_id=vod_id,
            post_progress=post_progress,
            reason="import_pending",
        )
        return True

    rolling_finalize = bool(payload.get("rollingFinalize"))
    state = _vod_state_dict(vod)
    rolling = state.get("rolling") if isinstance(state.get("rolling"), dict) else {}
    finalize = rolling_finalize or bool(rolling.get("finalize"))
    total_ms = int(max(0.0, meta_dur_s) * 1000)
    plan_out = apply_rolling_pull_plan(
        conn,
        vod,
        total_vod_ms=total_ms,
        finalize=finalize,
        job_id=str(job["id"]),
    )
    if plan_out == "stop_session":
        stop_rolling_session(conn, vod_id, reason="max_session_hours")
        post_progress(
            job["id"],
            {"projectStatus": "PREPARING", "stage": "live_ingest", "progress": 18, "jobStatus": "DONE"},
        )
        return True
    if plan_out is None:
        if finalize:
            stop_rolling_session(conn, vod_id, reason="stream_offline")
        else:
            _rolling_import_idle_done(
                conn,
                job=job,
                vod=vod,
                project_id=project_id,
                vod_id=vod_id,
                post_progress=post_progress,
                reason="no_new_vod_ms",
            )
        return True
    return False


def _complete_rolling_window_import(
    conn,
    *,
    job: dict,
    vod: dict,
    project_id: str,
    vod_id: str,
    payload: dict,
    state: dict,
    meta: dict,
    duration_ms: int,
    post_progress,
    hb,
) -> None:
    from clips_worker.streamer.rolling_ingest import (
        mark_rolling_pull_complete,
        rolling_chunk_min,
        stop_rolling_session,
    )

    end_ms = int(vod.get("rangeEndMs") or 0)
    mark_rolling_pull_complete(conn, vod_id, end_ms)
    prior = _vod_state_dict(vod)
    merged_state = {**prior, **state, "processMode": "rolling"}
    pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "auto")
    analyze_id = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_projects
            SET title=COALESCE(%s, title), stage='live_ingest', progress=20, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (meta.get("title"), project_id),
        )
        cur.execute(
            """
            UPDATE stream_vods
            SET title=%s, category=%s, "durationMs"=%s, chapters=%s::jsonb, state=%s::jsonb, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (
                meta.get("title"),
                meta.get("category"),
                duration_ms,
                json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                json.dumps(merged_state),
                vod_id,
            ),
        )
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
            VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
            """,
            (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
        )
    conn.commit()
    rolling_finalize = bool(payload.get("rollingFinalize"))
    rolling = prior.get("rolling") if isinstance(prior.get("rolling"), dict) else {}
    live = bool(rolling.get("live")) and not rolling_finalize
    finalize = rolling_finalize or bool(rolling.get("finalize"))
    chunk_min = rolling_chunk_min(prior)
    if live and not finalize:
        _schedule_rolling_import_tick(
            conn,
            project_id=project_id,
            vod_id=vod_id,
            chunk_min=chunk_min,
        )
    elif finalize:
        stop_rolling_session(conn, vod_id, reason="stream_offline")
    cleanup_vod_import_dir(vod_id)
    hb.update(stage="live_ingest", progress=22)
    post_progress(
        job["id"],
        {
            "projectStatus": "QUEUED",
            "stage": "live_ingest",
            "progress": 22,
            "jobStatus": "DONE",
        },
    )


def _schedule_rolling_import_tick(
    conn,
    *,
    project_id: str,
    vod_id: str,
    chunk_min: int,
) -> None:
    if _has_pending_stream_import(conn, project_id, vod_id):
        print(
            f"[clipper:stream] rolling_import_deduped vodId={vod_id} projectId={project_id}",
            flush=True,
        )
        return
    new_id = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "runAfter", "createdAt")
            VALUES (%s,%s,'STREAM_IMPORT','QUEUED',%s::jsonb,15,NOW() + (%s || ' minutes')::interval,NOW())
            """,
            (new_id, project_id, json.dumps({"vodId": vod_id, "rollingTick": True}), str(chunk_min)),
        )
    conn.commit()
    print(
        f"[clipper:stream] rolling_import_scheduled vodId={vod_id} projectId={project_id} delayMin={chunk_min}",
        flush=True,
    )


def _section_from_range(start_ms: int, end_ms: int | None) -> str | None:
    if not start_ms and not end_ms:
        return None
    start_s = max(0, start_ms) / 1000.0
    end_s = (end_ms or 0) / 1000.0
    if end_s <= start_s:
        return None
    return f"*{start_s}-{end_s}"


def _maybe_complete_import_from_state(conn, vod: dict, job: dict, project_id: str, vod_id: str, post_progress) -> bool:
    """Idempotent: skip re-download when audio is already in storage."""
    if _rolling_import_mode(vod):
        return False
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    if not state.get("audioKey"):
        return False
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT status FROM clip_jobs
            WHERE "projectId"=%s AND type='STREAM_ANALYZE'
            ORDER BY "createdAt" DESC LIMIT 1
            """,
            (project_id,),
        )
        row = cur.fetchone()
    if row and row[0] in ("QUEUED", "RUNNING", "DONE"):
        post_progress(
            job["id"],
            {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
        )
        return True
    pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "paste")
    analyze_id = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
            VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
            """,
            (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
        )
    conn.commit()
    post_progress(
        job["id"],
        {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
    )
    return True


def _effective_duration_ms(vod: dict, meta_dur_s: float) -> int:
    start = int(vod.get("rangeStartMs") or 0)
    end = vod.get("rangeEndMs")
    if end:
        return max(0, int(end) - start)
    return int(meta_dur_s * 1000)


def run_stream_import_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    if not vod_id:
        raise RuntimeError("missing vodId")

    from clips_worker.gpu.render_warmup import schedule_modal_warmup_background

    schedule_modal_warmup_background()

    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v.*, p."workspaceId", p.settings, p.id AS project_id
            FROM stream_vods v
            JOIN clip_projects p ON p.id = v."projectId"
            WHERE v.id = %s
            """,
            (vod_id,),
        )
        vod = dict(cur.fetchone())

    if _maybe_complete_import_from_state(conn, vod, job, vod["project_id"], vod_id, post_progress):
        return

    url = vod.get("url")
    workspace_id = vod["workspaceId"]
    project_id = vod["project_id"]
    SCRATCH.mkdir(parents=True, exist_ok=True)

    if not url and (vod.get("platform") == "upload" or vod.get("sourceType") == "upload"):
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                'SELECT "uploadId", "rangeStartMs", "rangeEndMs" FROM clip_projects WHERE id=%s',
                (project_id,),
            )
            prow = cur.fetchone()
            cur.execute('SELECT key FROM clip_uploads WHERE id=%s', (prow["uploadId"],))
            urow = cur.fetchone()
        if not prow or not urow:
            raise RuntimeError("missing upload for stream import")
        range_start_ms = int(prow.get("rangeStartMs") or vod.get("rangeStartMs") or 0)
        range_end_ms = int(prow.get("rangeEndMs") or vod.get("rangeEndMs") or 0)
        effective_ms = (
            max(0, range_end_ms - range_start_ms)
            if range_end_ms > range_start_ms
            else int(prow["rangeEndMs"] or vod.get("durationMs") or 0)
        )
        if effective_ms <= 0:
            raise RuntimeError("missing duration on upload")
        cap_err = check_cap(conn, workspace_id, effective_ms // 1000)
        if cap_err:
            raise RuntimeError(cap_err)
        use_long = effective_ms > FULL_DOWNLOAD_MAX_MIN * 60 * 1000
        with Heartbeat(job["id"], post_progress, every_s=45) as hb:
            with tempfile.TemporaryDirectory(dir=SCRATCH) as td:
                src = Path(td) / "upload.mp4"
                download_object(urow["key"], src)
                dur_s = probe_duration(src)
                upload_dur_ms = int(dur_s * 1000)
                if range_end_ms <= range_start_ms and upload_dur_ms > 0:
                    range_end_ms = upload_dur_ms
                duration_ms = effective_ms or upload_dur_ms
                audio_out = Path(td) / "audio.opus"
                _extract_upload_audio(
                    src,
                    audio_out,
                    long_form=use_long,
                    range_start_ms=range_start_ms,
                    range_end_ms=range_end_ms if range_end_ms > range_start_ms else 0,
                )
                audio_key = stream_audio_key(workspace_id, vod_id)
                upload_file(audio_key, audio_out, "audio/opus")
                state = _state_for_upload(workspace_id, vod_id, urow["key"], src, td)
                state["audioKey"] = audio_key
                pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "upload")
                analyze_id = f"job_{uuid.uuid4().hex}"
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE stream_vods SET "durationMs"=%s, state=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
                        (duration_ms, json.dumps(state), vod_id),
                    )
                    cur.execute(
                        """
                        INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                        VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
                        """,
                        (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
                    )
                conn.commit()
        post_progress(
            job["id"],
            {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
        )
        return

    if not url:
        raise RuntimeError("missing stream url")

    with Heartbeat(job["id"], post_progress, every_s=45) as hb:
        hb.update(stage="Downloading", progress=5)
        post_progress(
            job["id"],
            {"projectStatus": "PREPARING", "stage": "Downloading", "progress": 5, "jobStatus": "RUNNING"},
        )
        allow_growing = _allow_twitch_growing_vod(vod)
        rolling_finalize = bool(payload.get("rollingFinalize"))
        meta_raw = metadata(url, allow_twitch_growing_vod=allow_growing)
        meta = parse_metadata(meta_raw)
        dur_s = meta["duration_s"] or 0
        if _rolling_preflight_after_meta(
            conn,
            job=job,
            vod=vod,
            project_id=project_id,
            vod_id=vod_id,
            payload=payload,
            post_progress=post_progress,
            meta_dur_s=float(dur_s),
        ):
            cleanup_vod_import_dir(vod_id)
            return
        effective_ms = _effective_duration_ms(vod, dur_s)
        _enforce_paste_vod_duration_cap(vod, effective_ms)
        cap_err = check_cap(conn, workspace_id, effective_ms // 1000)
        if cap_err:
            raise RuntimeError(cap_err)

        kind = vod.get("sourceType") or "vod"
        section = _section_from_range(int(vod.get("rangeStartMs") or 0), vod.get("rangeEndMs"))

        # Paste Twitch/Kick vod/highlight: never download full MP4 to worker disk (Rick storage contract).
        if kind != "clip":
            print(
                f"[clipper:stream] import_audio_only vodId={vod_id} projectId={project_id} "
                f"kind={kind} effectiveMs={effective_ms}",
                flush=True,
            )
            post_progress(
                job["id"],
                {
                    "projectStatus": "PREPARING",
                    "stage": "Downloading audio",
                    "progress": 8,
                    "jobStatus": "RUNNING",
                },
            )

            from clips_worker.progress_throttle import ThrottledProgressPoster

            throttled = ThrottledProgressPoster(post_progress, job["id"])

            def on_pct(pct: float) -> None:
                prog = 8 + int(min(12, pct * 0.12))
                hb.update(stage="Downloading audio", progress=prog)
                throttled.post(
                    {
                        "projectStatus": "PREPARING",
                        "stage": "Downloading audio",
                        "progress": prog,
                        "jobStatus": "RUNNING",
                    },
                )

            from clips_worker.streamer.audio_first_ingest import (
                delete_local_ingest_file,
                ingest_vod_audio,
                stream_audio_first_ingest_enabled,
            )

            staged_audio: Path | None = None
            if stream_audio_first_ingest_enabled():
                staged_audio, _ingest_metrics = ingest_vod_audio(
                    url,
                    job_id=str(job["id"]),
                    vod_id=vod_id,
                    section=section,
                    progress_cb=on_pct,
                )
                audio_path = staged_audio
            else:
                cache_dir = vod_import_dir(vod_id)
                audio_out = str(cache_dir / "audio.%(ext)s")
                download_audio(url, audio_out, section=section, progress_cb=on_pct, workdir=str(cache_dir))
                audio_path = pick_completed_audio(cache_dir)
            if audio_path is None:
                raise RuntimeError("audio download incomplete (no finished audio file)")
            duration_ms = effective_ms or int(dur_s * 1000)
            audio_key = stream_audio_key(workspace_id, vod_id)
            upload_file(audio_key, audio_path, "audio/opus")
            if staged_audio is not None:
                delete_local_ingest_file(staged_audio)
            prior_state = _vod_state_dict(vod)
            state = {
                **prior_state,
                "audioKey": audio_key,
                "importMeta": {"tags": meta.get("tags") or []},
            }
            from clips_worker.streamer.channel_resolve import resolve_vod_channel_fields

            ch_fields = resolve_vod_channel_fields(vod, meta, url)
            if ch_fields.get("login"):
                state["channelLogin"] = ch_fields["login"]
            if ch_fields.get("display"):
                state["channelDisplayName"] = ch_fields["display"]
            growing = bool(meta_raw.get("growing_vod"))
            rolling = prior_state.get("rolling") if isinstance(prior_state.get("rolling"), dict) else {}
            chunk_min = int(rolling.get("chunkMin") or 12)
            if _rolling_import_mode(vod):
                _complete_rolling_window_import(
                    conn,
                    job=job,
                    vod=vod,
                    project_id=project_id,
                    vod_id=vod_id,
                    payload=payload,
                    state=state,
                    meta=meta,
                    duration_ms=duration_ms,
                    post_progress=post_progress,
                    hb=hb,
                )
                return
            if allow_growing and growing and not rolling_finalize:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE clip_projects
                        SET title=COALESCE(%s, title), stage='live_ingest', progress=15, "updatedAt"=NOW()
                        WHERE id=%s
                        """,
                        (meta.get("title"), project_id),
                    )
                    cur.execute(
                        """
                        UPDATE stream_vods
                        SET title=%s, category=%s, "durationMs"=%s, chapters=%s::jsonb, state=%s::jsonb, "updatedAt"=NOW()
                        WHERE id=%s
                        """,
                        (
                            meta.get("title"),
                            meta.get("category"),
                            duration_ms,
                            json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                            json.dumps(state),
                            vod_id,
                        ),
                    )
                conn.commit()
                if growing:
                    _schedule_rolling_import_tick(
                        conn,
                        project_id=project_id,
                        vod_id=vod_id,
                        chunk_min=chunk_min,
                    )
                cleanup_vod_import_dir(vod_id)
                post_progress(
                    job["id"],
                    {
                        "projectStatus": "PREPARING",
                        "stage": "live_ingest",
                        "progress": 18,
                        "jobStatus": "DONE",
                    },
                )
                return
            pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "paste")
            analyze_id = f"job_{uuid.uuid4().hex}"
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE clip_projects
                    SET title=COALESCE(%s, title), stage='Downloading audio', progress=20, "updatedAt"=NOW()
                    WHERE id=%s
                    """,
                    (meta.get("title"), project_id),
                )
                cur.execute(
                    """
                    UPDATE stream_vods
                    SET title=%s, category=%s, "durationMs"=%s, chapters=%s::jsonb, state=%s::jsonb, "updatedAt"=NOW()
                    WHERE id=%s
                    """,
                    (
                        meta.get("title"),
                        meta.get("category"),
                        duration_ms,
                        json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                        json.dumps(state),
                        vod_id,
                    ),
                )
                cur.execute(
                    """
                    INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                    VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
                    """,
                    (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
                )
            conn.commit()
            cleanup_vod_import_dir(vod_id)
            sweep_stale_failed_import_dirs(conn=conn)
            post_progress(
                job["id"],
                {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
            )
            return

        print(
            f"[clipper:stream] import_clip_section vodId={vod_id} projectId={project_id} kind=clip",
            flush=True,
        )
        usage = shutil.disk_usage(SCRATCH)
        est = int(dur_s * 2_000_000)
        if usage.free < est * 2:
            raise RuntimeError("Not enough scratch disk for this download")

        def on_pct(pct: float) -> None:
            prog = 5 + int(min(20, pct * 0.2))
            hb.update(stage="Downloading", progress=prog)
            post_progress(
                job["id"],
                {"projectStatus": "PREPARING", "stage": "Downloading", "progress": prog, "jobStatus": "RUNNING"},
            )

        cache_dir = vod_import_dir(vod_id)
        dest = str(cache_dir / "source.mp4")

        download_video(url, dest, section=section, progress_cb=on_pct, workdir=str(cache_dir))
        path = Path(dest)
        dur_s, width, height = probe_video(path)
        duration_ms = int(round(dur_s * 1000))
        size = path.stat().st_size

        upload_id = f"upl_{uuid.uuid4().hex}"
        key = upload_source_key(workspace_id, upload_id, "mp4")
        upload_file(key, path, "video/mp4")

        audio_out = cache_dir / "audio.opus"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(path),
                "-vn",
                "-c:a",
                "libopus",
                str(audio_out),
            ]
        )
        audio_key = stream_audio_key(workspace_id, vod_id)
        upload_file(audio_key, audio_out, "audio/opus")
        state = {
            "audioKey": audio_key,
            "localUploadKey": key,
            "importMeta": {"tags": meta.get("tags") or []},
        }
        pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "paste")
        analyze_id = f"job_{uuid.uuid4().hex}"

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO clip_uploads (id, "workspaceId", key, filename, bytes, mime, "durationMs", width, height, status, "createdAt")
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'COMPLETE',NOW())
                """,
                (upload_id, workspace_id, key, "stream.mp4", size, "video/mp4", duration_ms, width, height),
            )
            cur.execute(
                """
                UPDATE clip_projects
                SET "uploadId"=%s, title=COALESCE(%s, title), "rangeEndMs"=GREATEST("rangeEndMs", %s),
                    stage='Downloading audio', progress=20, "updatedAt"=NOW()
                WHERE id=%s
                """,
                (upload_id, meta.get("title"), duration_ms, project_id),
            )
            cur.execute(
                """
                UPDATE stream_vods SET title=%s, category=%s, "durationMs"=%s, chapters=%s::jsonb, state=%s::jsonb, "updatedAt"=NOW()
                WHERE id=%s
                """,
                (
                    meta.get("title"),
                    meta.get("category"),
                    duration_ms,
                    json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                    json.dumps(state),
                    vod_id,
                ),
            )
            cur.execute(
                """
                INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
                """,
                (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
            )
        conn.commit()
        cleanup_vod_import_dir(vod_id)

    sweep_stale_failed_import_dirs(conn=conn)

    post_progress(
        job["id"],
        {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
    )
