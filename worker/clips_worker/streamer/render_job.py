"""STREAM_RENDER: fetch padded segments, align, reframe each clip."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.heartbeat import Heartbeat
from clips_worker.pipeline import clip_keys, initial_clip_edits, mark_project_ready
from clips_worker.deepgram_transcribe import DeepgramTranscribeError, deepgram_api_key
from clips_worker.gpu.base import TranscribeReq
from clips_worker.render_clip import ffmpeg_cut, poster_jpg, run_speakercrop, slice_words
from clips_worker.streamer.transcribe_stream import deepgram_caption_model, transcribe_clip_caption
from clips_worker.streamer.layout.detect_facecam import detect_facecam_layout
from clips_worker.streamer.layout.render_stack import render_stack_mp4
from clips_worker.storage import download_object, put_json, upload_file
from clips_worker.streamer.align import align_segment_ms
from clips_worker.streamer.config import SCRATCH, SEGMENT_PAD_S, SOURCE_RETENTION_HOURS
from clips_worker.streamer.storage_cleanup import delete_clip_source_segment, enqueue_stream_cleanup_job
from clips_worker.streamer.keys import clip_segment_key, stream_audio_key
from clips_worker.streamer.progress import eta_seconds
from clips_worker.streamer.segments import cut_local_segment, download_segment


def _checkpoint_segment_key(conn, vod_id: str, state: dict, clip_id: str, seg_key: str) -> dict:
    merged = dict(state)
    keys = dict(merged.get("segmentKeys") or {})
    keys[str(clip_id)] = seg_key
    merged["segmentKeys"] = keys
    _save_state(conn, vod_id, merged)
    return merged


def _fetch_segment_mp4(
    clip: dict,
    state: dict,
    *,
    seg_path: Path,
    local_upload: Path | None,
    url: str | None,
    seg_start_s: float,
    seg_end_s: float,
    workspace_id: str,
    project_id: str,
    job_id: str = "",
    vod_id: str = "",
) -> None:
    if clip.get("sourceSegKey"):
        download_object(str(clip["sourceSegKey"]), seg_path)
        return
    if local_upload and local_upload.is_file():
        cut_local_segment(local_upload, seg_path, seg_start_s, seg_end_s)
        return
    if not url:
        raise RuntimeError("no url or upload for segment fetch")
    download_segment(
        url,
        seg_path,
        seg_start_s,
        seg_end_s,
        job_id=job_id,
        vod_id=vod_id,
        clip_id=str(clip.get("id") or ""),
    )


def _load_vod(conn, vod_id: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v.*, p."workspaceId", p.settings, p.id AS project_id, p."uploadId", p."transcriptKey"
            FROM stream_vods v
            JOIN clip_projects p ON p.id = v."projectId"
            WHERE v.id = %s
            """,
            (vod_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("vod missing")
    return dict(row)


def _load_channel_preset_layout(conn, channel_id: str | None) -> dict | None:
    if not channel_id:
        return None
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT "defaultPresetId" FROM stream_channels WHERE id = %s', (channel_id,))
            ch = cur.fetchone()
            if not ch or not ch.get("defaultPresetId"):
                return None
            cur.execute(
                """
                SELECT layout, facecam, gameplay, split, "facecamPosition", confidence, source
                FROM stream_layout_presets
                WHERE id = %s AND "deletedAt" IS NULL
                """,
                (ch["defaultPresetId"],),
            )
            row = cur.fetchone()
        if not row:
            return None
        out = dict(row)
        out["layout"] = out.get("layout") or "stack"
        out["source"] = "preset"
        return out
    except Exception:
        return None


def _save_state(conn, vod_id: str, state: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE stream_vods SET state = %s::jsonb, "updatedAt" = NOW() WHERE id = %s',
            (json.dumps(state), vod_id),
        )
    conn.commit()


@dataclass
class _StreamClipWork:
    clip_id: str
    idx: int
    start_ms: int
    clip_words: list
    words_path: Path
    clip_file: Path
    out_mp4: Path
    crop_track: Path
    use_stack: bool
    clip_layout: dict
    ai_meta: dict
    seg_key: str
    true_start_abs_ms: int
    true_end_ms: int
    gpu_prep: object | None = None


def _clips_for_project(conn, project_id: str) -> list[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT * FROM clips
            WHERE "projectId" = %s AND "deletedAt" IS NULL
            ORDER BY score DESC, "startMs" ASC
            """,
            (project_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def run_stream_render_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    if not vod_id:
        raise RuntimeError("missing vodId")

    from clips_worker.stage_log import bind_stage_context, stage_span

    vod = _load_vod(conn, vod_id)
    workspace_id = vod["workspaceId"]
    project_id = vod["project_id"]
    bind_stage_context(project_id=str(project_id), job_id=str(job["id"]))
    settings = vod.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    url = vod.get("url")
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    audio_key = state.get("audioKey") or stream_audio_key(workspace_id, vod_id)
    vod_range_start_ms = int(vod.get("rangeStartMs") or 0)

    clips = _clips_for_project(conn, project_id)
    if not clips:
        mark_project_ready(conn, project_id)
        post_progress(job["id"], {"projectStatus": "READY", "stage": "ready", "progress": 100, "jobStatus": "DONE"})
        return

    SCRATCH.mkdir(parents=True, exist_ok=True)
    total = len(clips)
    clips_ready = sum(1 for c in clips if c.get("previewKey"))
    local_upload: Path | None = None
    render_started = time.time()

    def _render_progress(ready_n: int) -> None:
        pct = 65 + int(30 * ready_n / max(1, total))
        eta = eta_seconds(ready_n, total, render_started)
        stage = f"Rendering {ready_n}/{total}"
        hb.update(stage=stage, progress=pct)
        post_progress(
            job["id"],
            {
                "projectStatus": "RENDERING",
                "stage": stage,
                "progress": pct,
                "chunkDone": ready_n,
                "chunkTotal": total,
                "etaSeconds": eta,
                "clipsTotal": total,
                "clipsReady": ready_n,
                "jobStatus": "RUNNING",
            },
        )

    with Heartbeat(job["id"], post_progress, every_s=45) as hb:
        post_progress(
            job["id"],
            {
                "projectStatus": "RENDERING",
                "stage": f"Rendering {clips_ready}/{total}",
                "progress": 65,
                "clipsTotal": total,
                "clipsReady": clips_ready,
                "jobStatus": "RUNNING",
            },
        )
        with tempfile.TemporaryDirectory(dir=SCRATCH) as td:
            td_path = Path(td)
            audio_path = td_path / "audio.opus"
            with stage_span("source_download", heartbeat=True):
                download_object(audio_key, audio_path)

            layout_video: Path | None = None
            if vod.get("platform") == "upload":
                up = td_path / "full.mp4"
                local_key = state.get("localUploadKey")
                if local_key:
                    download_object(str(local_key), up)
                    local_upload = up
                elif vod.get("uploadId"):
                    with conn.cursor() as cur:
                        cur.execute('SELECT key FROM clip_uploads WHERE id = %s', (vod["uploadId"],))
                        row = cur.fetchone()
                    if row:
                        download_object(row[0], up)
                        local_upload = up
                proxy_key = state.get("analysisProxyKey")
                if proxy_key:
                    proxy_path = td_path / "analysis_proxy.mp4"
                    download_object(str(proxy_key), proxy_path)
                    layout_video = proxy_path
                else:
                    layout_video = local_upload

            layout_state = state.get("layout") or _load_channel_preset_layout(conn, vod.get("channelId"))
            if layout_state and not state.get("layout"):
                state["layout"] = layout_state
                _save_state(conn, vod_id, state)
            if not layout_state and clips:
                sample = td_path / "layout_sample.mp4"
                first = clips[0]
                fs = max(0.0, (vod_range_start_ms + int(first["startMs"])) / 1000.0 - 2)
                fe = fs + 30
                seg_src = layout_video or local_upload
                if seg_src:
                    cut_local_segment(seg_src, sample, fs, fe)
                elif url:
                    download_segment(url, sample, fs, fe)
                if sample.exists():
                    layout_state = detect_facecam_layout(sample, td_path)
                    state["layout"] = layout_state
                    _save_state(conn, vod_id, state)

            transcript_key = vod.get("transcriptKey")
            pending_work: list[_StreamClipWork] = []

            for idx, clip in enumerate(clips):
                if clip.get("previewKey"):
                    continue
                ai_meta_row = clip.get("aiMeta") or {}
                if isinstance(ai_meta_row, str):
                    ai_meta_row = json.loads(ai_meta_row)
                streamer_tier = (ai_meta_row.get("streamer") or {}).get("tier")
                if streamer_tier == "more" or (ai_meta_row.get("streamer") or {}).get("render") is False:
                    continue
                clip_id = clip["id"]
                start_ms = int(clip["startMs"])
                end_ms = int(clip["endMs"])
                pad = SEGMENT_PAD_S
                # Clip times are relative to the analyzed slice; video fetch uses absolute VOD time.
                audio_seg_start_s = max(0.0, start_ms / 1000.0 - pad)
                audio_seg_end_s = end_ms / 1000.0 + pad
                video_seg_start_s = max(0.0, (vod_range_start_ms + start_ms) / 1000.0 - pad)
                video_seg_end_s = (vod_range_start_ms + end_ms) / 1000.0 + pad
                seg_path = td_path / f"seg_{clip_id}.mp4"

                with stage_span("clip_render", heartbeat=True, clip_index=idx, clip_id=clip_id):
                    with stage_span("segment_download", heartbeat=True):
                        _fetch_segment_mp4(
                            clip,
                            state,
                            seg_path=seg_path,
                            local_upload=local_upload,
                            url=url,
                            seg_start_s=video_seg_start_s,
                            seg_end_s=video_seg_end_s,
                            workspace_id=workspace_id,
                            project_id=project_id,
                            job_id=str(job.get("id") or ""),
                            vod_id=vod_id,
                        )

                    true_start_ms, corr = align_segment_ms(
                        seg_path,
                        audio_path,
                        audio_seg_start_s,
                        audio_seg_end_s,
                        log_context={"vodId": vod_id, "clipId": clip_id},
                    )
                    true_end_ms = int(
                        vod_range_start_ms + end_ms + (true_start_ms - int(audio_seg_start_s * 1000))
                    )
                    true_start_abs_ms = vod_range_start_ms + true_start_ms

                    seg_key = clip_segment_key(workspace_id, project_id, clip_id)
                    upload_file(seg_key, seg_path, "video/mp4")
                    state = _checkpoint_segment_key(conn, vod_id, state, clip_id, seg_key)

                    offset_ms = true_start_ms
                    rel_start = max(0, start_ms - offset_ms)
                    rel_end = max(rel_start + 100, end_ms - offset_ms)

                    words_path = td_path / f"words_{clip_id}.json"
                    clip_words: list[dict]
                    caption_audio = td_path / f"caption_{clip_id}.opus"
                    with stage_span("captions", heartbeat=True, clip_index=idx):
                        subprocess.check_call(
                            [
                                "ffmpeg",
                                "-y",
                                "-ss",
                                f"{audio_seg_start_s:.3f}",
                                "-t",
                                f"{audio_seg_end_s - audio_seg_start_s:.3f}",
                                "-i",
                                str(audio_path),
                                "-c:a",
                                "libopus",
                                str(caption_audio),
                            ],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                        )
                        if deepgram_api_key():
                            try:
                                cap = transcribe_clip_caption(
                                    TranscribeReq(
                                        audio_path=str(caption_audio),
                                        offset_ms=int(audio_seg_start_s * 1000),
                                        language=(settings.get("streamer") or {}).get("language"),
                                    )
                                )
                                clip_words = slice_words(cap.words, start_ms, end_ms)
                                cap_min = max(0.0, (end_ms - start_ms) / 60000.0)
                                print(
                                    f"[clipper:stream] caption_clip clipId={clip_id} vodId={vod_id} "
                                    f"model={deepgram_caption_model()} clipMinutes={cap_min:.2f}",
                                    file=sys.stderr,
                                    flush=True,
                                )
                            except DeepgramTranscribeError:
                                transcript_path = td_path / "transcript.json"
                                if not transcript_key:
                                    raise RuntimeError("missing transcriptKey")
                                download_object(transcript_key, transcript_path)
                                all_words = json.loads(transcript_path.read_text())
                                clip_words = slice_words(all_words, start_ms, end_ms)
                        else:
                            transcript_path = td_path / "transcript.json"
                            if not transcript_key:
                                raise RuntimeError("missing transcriptKey")
                            download_object(transcript_key, transcript_path)
                            all_words = json.loads(transcript_path.read_text())
                            clip_words = slice_words(all_words, start_ms, end_ms)
                    words_path.write_text(json.dumps(clip_words))

                    clip_file = td_path / f"clip_{clip_id}.mp4"
                    ffmpeg_cut(seg_path, clip_file, rel_start, rel_end, clip_index=idx)
                    try:
                        seg_path.unlink(missing_ok=True)
                    except OSError:
                        pass
                    out_mp4 = td_path / f"out_{clip_id}.mp4"
                    crop_track = td_path / f"crop_{clip_id}.json"
                    streamer_layout = (settings.get("streamer") or {}).get("layout", "stack")
                    ai_meta = clip.get("aiMeta") or {}
                    if isinstance(ai_meta, str):
                        ai_meta = json.loads(ai_meta)
                    clip_layout = (ai_meta.get("streamer") or {}).get("layout") or layout_state or {}
                    use_stack = (
                        streamer_layout == "stack"
                        and isinstance(clip_layout, dict)
                        and clip_layout.get("layout") == "stack"
                        and clip_layout.get("facecam")
                    )
                    pending_work.append(
                        _StreamClipWork(
                            clip_id=clip_id,
                            idx=idx,
                            start_ms=start_ms,
                            clip_words=clip_words,
                            words_path=words_path,
                            clip_file=clip_file,
                            out_mp4=out_mp4,
                            crop_track=crop_track,
                            use_stack=use_stack,
                            clip_layout=clip_layout if isinstance(clip_layout, dict) else {},
                            ai_meta=ai_meta,
                            seg_key=seg_key,
                            true_start_abs_ms=true_start_abs_ms,
                            true_end_ms=true_end_ms,
                        )
                    )

            from clips_worker.gpu_encode import render_batch_via_provider, render_provider_enabled
            from clips_worker.render_clip import prepare_speakercrop_gpu_render

            gpu_ok: dict[str, bool] = {}
            if pending_work and render_provider_enabled():
                gpu_preps = []
                for work in pending_work:
                    if work.use_stack:
                        continue
                    prep = prepare_speakercrop_gpu_render(
                        work.clip_file,
                        work.out_mp4,
                        work.words_path,
                        settings,
                        td_path,
                        clip_start_ms=work.start_ms,
                        crop_track_out=work.crop_track,
                        shot_overrides=None,
                        render_meta=None,
                        preserve_existing_crop_track=False,
                        clip_index=work.idx,
                        workspace_id=workspace_id,
                        project_id=project_id,
                        clip_id=work.clip_id,
                    )
                    work.gpu_prep = prep
                    if prep is not None:
                        gpu_preps.append(prep)
                if gpu_preps:
                    with stage_span("gpu_render_batch", heartbeat=True, clip_count=len(gpu_preps)):
                        gpu_ok = render_batch_via_provider(conn, gpu_preps)

            for work in pending_work:
                with stage_span("clip_render", heartbeat=True, clip_index=work.idx, clip_id=work.clip_id):
                    with stage_span("reframe", heartbeat=True, clip_index=work.idx):
                        if work.use_stack:
                            render_stack_mp4(work.clip_file, work.out_mp4, work.clip_layout)
                            rendered = work.out_mp4
                        elif work.gpu_prep and gpu_ok.get(work.clip_id):
                            rendered = work.out_mp4
                        else:
                            rendered = run_speakercrop(
                                work.clip_file,
                                work.out_mp4,
                                work.words_path,
                                settings,
                                td_path,
                                clip_start_ms=work.start_ms,
                                crop_track_out=work.crop_track,
                                conn=conn,
                                workspace_id=workspace_id,
                                project_id=project_id,
                                clip_id=work.clip_id,
                                clip_index=work.idx,
                            )
                    ai_streamer = dict((work.ai_meta.get("streamer") or {}))
                    if work.clip_layout:
                        ai_streamer["layout"] = work.clip_layout
                    poster = td_path / f"poster_{work.clip_id}.jpg"
                    poster_jpg(rendered, poster)
                    keys = clip_keys(workspace_id, project_id, work.clip_id)
                    upload_file(keys["preview"], rendered, "video/mp4")
                    upload_file(keys["poster"], poster, "image/jpeg")
                    put_json(keys["words"], work.clip_words)
                    crop_key = None
                    if work.crop_track.exists():
                        upload_file(keys["crop_track"], work.crop_track, "application/json")
                        crop_key = keys["crop_track"]

                    ai_meta = work.ai_meta
                    if ai_streamer:
                        ai_meta = {**ai_meta, "streamer": ai_streamer}
                    with stage_span("db_write_clip", clip_id=work.clip_id):
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                UPDATE clips SET
                                  "previewKey"=%s, "posterKey"=%s, "wordsKey"=%s, "cropKey"=%s,
                                  "sourceSegKey"=%s, "sourceSegStartMs"=%s, "sourceSegEndMs"=%s,
                                  "aiMeta"=%s::jsonb,
                                  edits=%s::jsonb, "updatedAt"=NOW()
                                WHERE id=%s
                                """,
                                (
                                    keys["preview"],
                                    keys["poster"],
                                    keys["words"],
                                    crop_key,
                                    work.seg_key,
                                    work.true_start_abs_ms,
                                    work.true_end_ms,
                                    json.dumps(ai_meta),
                                    json.dumps(initial_clip_edits(settings)),
                                    work.clip_id,
                                ),
                            )
                        conn.commit()

                    delete_clip_source_segment(
                        workspace_id,
                        project_id,
                        work.clip_id,
                        work.seg_key,
                        vod_id=vod_id,
                    )

                clips_ready += 1
                _render_progress(clips_ready)

    mark_project_ready(conn, project_id)
    enqueue_stream_cleanup_job(
        conn,
        project_id,
        vod_id,
        delay_hours=float(SOURCE_RETENTION_HOURS),
    )
    post_progress(
        job["id"],
        {"projectStatus": "READY", "stage": "ready", "progress": 100, "jobStatus": "DONE"},
    )
    from clips_worker.streamer.notify import notify_event

    notify_event(
        workspace_id=workspace_id,
        type="stream_ready",
        vod_id=vod_id,
        data={"projectId": project_id, "clipCount": len(clips)},
    )
