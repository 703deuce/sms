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
from clips_worker.pipeline import clip_keys, mark_project_ready
from clips_worker.edits_render import normalize_edits
from clips_worker.deepgram_transcribe import DeepgramTranscribeError, deepgram_api_key
from clips_worker.gpu.base import TranscribeReq
from clips_worker.render_clip import ffmpeg_cut, poster_jpg, slice_words
from clips_worker.streamer.transcribe_stream import deepgram_caption_model, transcribe_clip_caption
from clips_worker.streamer.layout.detect_facecam import detect_facecam_layout
from clips_worker.streamer.layout.render_stack import render_stack_mp4
from clips_worker.storage import download_object, put_json, upload_file
from clips_worker.streamer.align import apply_segment_align_policy
from clips_worker.streamer.config import SCRATCH, SEGMENT_PAD_S, SOURCE_RETENTION_HOURS
from clips_worker.streamer.timeline import compute_cut, vod_ms_to_media_s
from clips_worker.streamer.storage_cleanup import delete_clip_source_segment, enqueue_stream_cleanup_job
from clips_worker.streamer.keys import clip_segment_key, stream_audio_key
from clips_worker.streamer.progress import eta_seconds
from clips_worker.streamer.segments import cut_local_segment, download_segment


from clips_worker.streamer.clip_timeline import clip_absolute_span_ms, clip_vod_range_start_ms
from clips_worker.streamer.segment_fetch import plan_segment_download_times, resolve_clip_window_media


def _clip_vod_range_start_ms(clip: dict, vod_default: int) -> int:
    return clip_vod_range_start_ms(clip, vod_default)


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
    local_media: Path | None,
    url: str | None,
    segment_kind: str,
    window_base_ms: int,
    rel_start_s: float,
    rel_end_s: float,
    workspace_id: str,
    project_id: str,
    job_id: str = "",
    vod_id: str = "",
) -> None:
    from clips_worker.decision_log import decision_log

    base_s, start_s, end_s = plan_segment_download_times(
        kind=segment_kind,
        window_base_ms=window_base_ms,
        rel_start_s=rel_start_s,
        rel_end_s=rel_end_s,
    )
    decision_log(
        "streamer",
        "segment_source",
        vodId=vod_id,
        clipId=str(clip.get("id") or ""),
        jobId=job_id,
        kind=segment_kind,
        base_s=round(base_s, 3),
        start_s=round(start_s, 3),
        end_s=round(end_s, 3),
        windowBaseMs=int(window_base_ms),
    )

    if clip.get("sourceSegKey"):
        download_object(str(clip["sourceSegKey"]), seg_path)
        return
    if segment_kind in ("window_capture", "proxy", "upload") and local_media and local_media.is_file():
        cut_local_segment(local_media, seg_path, rel_start_s, rel_end_s)
        return
    if not url:
        raise RuntimeError("no url or upload for segment fetch")
    from clips_worker.stage_log import stage_span

    with stage_span("segment_ytdlp", heartbeat=True, clipId=str(clip.get("id") or "")):
        download_segment(
            url,
            seg_path,
            start_s,
            end_s,
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
    clip_edits: dict
    end_ms: int
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


def _probe_file_duration_ms(path: Path) -> int:
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
    return int(round(float(out or "0") * 1000))


def _clip_timeline_anchor(clip: dict, state: dict, vod_default: int) -> tuple[int, str | None, str | None]:
    ai = clip.get("aiMeta") or {}
    if isinstance(ai, str):
        ai = json.loads(ai) if ai else {}
    sm = ai.get("streamer") or {}
    anchor = int(sm.get("vodRangeStartMs") or state.get("vodStartMs") or vod_default)
    audio_key = sm.get("windowAudioKey") or state.get("audioKey")
    video_key = sm.get("windowVideoKey") or sm.get("captureVideoKey") or state.get("windowCaptureVideoKey")
    return anchor, str(audio_key) if audio_key else None, str(video_key) if video_key else None


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
            audio_cache: dict[str, Path] = {}

            def _audio_path_for_key(key: str) -> Path:
                if key in audio_cache:
                    return audio_cache[key]
                dest = td_path / f"window_audio_{len(audio_cache)}.opus"
                with stage_span("window_audio_download", heartbeat=True, audioKey=key[:80]):
                    download_object(key, dest)
                audio_cache[key] = dest
                return dest

            with stage_span("render_prepare", heartbeat=True):
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
                    abs_fs, _, wbase = clip_absolute_span_ms(first, vod_range_start_ms)
                    fs = max(0.0, (abs_fs - wbase) / 1000.0 - 2)
                    fe = fs + 30
                    seg_src = layout_video or local_upload
                    layout_kind = "full_vod_url"
                    if seg_src:
                        if layout_video and layout_video.is_file():
                            layout_kind = "proxy" if state.get("analysisProxyKey") else "upload"
                        cut_local_segment(seg_src, sample, fs, fe)
                    elif url:
                        _, fs_dl, fe_dl = plan_segment_download_times(
                            kind="full_vod_url",
                            window_base_ms=wbase,
                            rel_start_s=fs,
                            rel_end_s=fe,
                        )
                        download_segment(url, sample, fs_dl, fe_dl)
                    if sample.exists():
                        layout_state = detect_facecam_layout(sample, td_path)
                        state["layout"] = layout_state
                        _save_state(conn, vod_id, state)

            transcript_key = vod.get("transcriptKey")
            capture_cache: dict[str, Path] = {}

            def _explicit_capture_key(clip_row: dict) -> str | None:
                ai = clip_row.get("aiMeta") or {}
                if isinstance(ai, str):
                    ai = json.loads(ai) if ai else {}
                key = (ai.get("streamer") or {}).get("captureVideoKey") or state.get("windowCaptureVideoKey")
                return str(key).strip() if key else None

            def _capture_path_for_key(key: str) -> Path:
                if key in capture_cache:
                    return capture_cache[key]
                dest = td_path / f"window_capture_{len(capture_cache)}.mp4"
                with stage_span("window_capture_download", heartbeat=True, captureKey=key[:80]):
                    download_object(key, dest)
                capture_cache[key] = dest
                return dest

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
                anchor, clip_audio_key, clip_video_key = _clip_timeline_anchor(clip, state, vod_range_start_ms)
                abs_start, abs_end, _span_base = clip_absolute_span_ms(clip, vod_range_start_ms)
                window_base = anchor
                pad = SEGMENT_PAD_S
                pad_start_s = max(0.0, vod_ms_to_media_s(abs_start, anchor) - pad)
                pad_end_s = vod_ms_to_media_s(abs_end, anchor) + pad
                video_seg_start_s = pad_start_s
                video_seg_end_s = pad_end_s
                seg_path = td_path / f"seg_{clip_id}.mp4"
                cap_key = clip_video_key or _explicit_capture_key(clip)
                media_path, segment_kind = resolve_clip_window_media(
                    clip,
                    state,
                    layout_video=layout_video,
                    local_upload=local_upload,
                )
                local_media: Path | None = media_path
                if cap_key:
                    local_media = _capture_path_for_key(cap_key)
                    segment_kind = "window_capture"
                elif segment_kind == "window_capture" and cap_key:
                    local_media = _capture_path_for_key(cap_key)

                eff_audio_key = clip_audio_key or audio_key
                audio_path = _audio_path_for_key(str(eff_audio_key))
                with stage_span("clip_render", heartbeat=True, clip_index=idx, clip_id=clip_id):
                    with stage_span("segment_download", heartbeat=True):
                        _fetch_segment_mp4(
                            clip,
                            state,
                            seg_path=seg_path,
                            local_media=local_media,
                            url=url,
                            segment_kind=segment_kind,
                            window_base_ms=window_base,
                            rel_start_s=video_seg_start_s,
                            rel_end_s=video_seg_end_s,
                            workspace_id=workspace_id,
                            project_id=project_id,
                            job_id=str(job.get("id") or ""),
                            vod_id=vod_id,
                        )

                    seg_vod_start_ms = anchor + int(round(pad_start_s * 1000))
                    clip_media_start_s = vod_ms_to_media_s(abs_start, anchor)
                    use_rel_s, _applied = apply_segment_align_policy(
                        seg_path=seg_path,
                        window_audio=audio_path,
                        expected_rel_s=pad_start_s,
                        clip_media_start_s=clip_media_start_s,
                        source_kind=segment_kind,
                        clip_id=clip_id,
                        vod_id=vod_id,
                    )
                    if _applied:
                        seg_vod_start_ms = anchor + int(round(use_rel_s * 1000))
                    true_start_abs_ms = seg_vod_start_ms
                    true_end_ms = seg_vod_start_ms + _probe_file_duration_ms(seg_path)

                    seg_key = clip_segment_key(workspace_id, project_id, clip_id)
                    upload_file(seg_key, seg_path, "video/mp4")
                    state = _checkpoint_segment_key(conn, vod_id, state, clip_id, seg_key)

                    rel_start, rel_end = compute_cut(abs_start, abs_end, seg_vod_start_ms)
                    win_start_ms = abs_start - anchor
                    win_end_ms = abs_end - anchor
                    caption_start_s = max(0.0, vod_ms_to_media_s(abs_start, anchor) - pad)
                    caption_end_s = vod_ms_to_media_s(abs_end, anchor) + pad
                    words_path = td_path / f"words_{clip_id}.json"
                    clip_words: list[dict]
                    caption_audio = td_path / f"caption_{clip_id}.opus"
                    with stage_span("captions", heartbeat=True, clip_index=idx):
                        subprocess.check_call(
                            [
                                "ffmpeg",
                                "-y",
                                "-ss",
                                f"{caption_start_s:.3f}",
                                "-t",
                                f"{max(0.1, caption_end_s - caption_start_s):.3f}",
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
                                        offset_ms=int(caption_start_s * 1000),
                                        language=(settings.get("streamer") or {}).get("language"),
                                    )
                                )
                                clip_words = slice_words(cap.words, win_start_ms, win_end_ms)
                                cap_min = max(0.0, (win_end_ms - win_start_ms) / 60000.0)
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
                                clip_words = slice_words(all_words, win_start_ms, win_end_ms)
                        else:
                            transcript_path = td_path / "transcript.json"
                            if not transcript_key:
                                raise RuntimeError("missing transcriptKey")
                            download_object(transcript_key, transcript_path)
                            all_words = json.loads(transcript_path.read_text())
                            clip_words = slice_words(all_words, win_start_ms, win_end_ms)
                    words_path.write_text(json.dumps(clip_words))

                    clip_file = td_path / f"clip_{clip_id}.mp4"
                    ffmpeg_cut(seg_path, clip_file, rel_start, rel_end, clip_index=idx)
                    try:
                        seg_path.unlink(missing_ok=True)
                    except OSError:
                        pass
                    out_mp4 = td_path / f"out_{clip_id}.mp4"
                    crop_track = td_path / f"crop_{clip_id}.json"
                    raw_edits = clip.get("edits") or {}
                    if isinstance(raw_edits, str):
                        raw_edits = json.loads(raw_edits) if raw_edits else {}
                    clip_edits = normalize_edits(raw_edits, abs_start, abs_end)
                    ai_meta = clip.get("aiMeta") or {}
                    if isinstance(ai_meta, str):
                        ai_meta = json.loads(ai_meta)
                    edits_layout_mode = str((clip_edits.get("layout") or {}).get("mode") or "fit_top")
                    facecam_layout = layout_state if isinstance(layout_state, dict) else {}
                    clip_layout = (ai_meta.get("streamer") or {}).get("layout") or {}
                    use_stack = edits_layout_mode == "stack" and bool(
                        isinstance(facecam_layout, dict)
                        and facecam_layout.get("layout") == "stack"
                        and facecam_layout.get("facecam")
                    )
                    if not use_stack:
                        clip_layout = {
                            "layout": edits_layout_mode,
                            "mode": edits_layout_mode,
                            "editorMode": edits_layout_mode,
                        }

                    with stage_span("reframe", heartbeat=True, clip_index=idx):
                        if use_stack:
                            render_stack_mp4(clip_file, out_mp4, clip_layout)
                            rendered = out_mp4
                        else:
                            from clips_worker.streamer.layout.stream_preview_render import (
                                render_stream_clip_preview,
                            )

                            render_stream_clip_preview(
                                clip_file,
                                out_mp4,
                                edits=clip_edits,
                                settings=settings,
                                clip_words=clip_words,
                                work_dir=td_path / f"render_{clip_id}",
                                clip_start_ms=abs_start,
                                clip_end_ms=abs_end,
                                conn=conn,
                                project_id=project_id,
                                clip_id=clip_id,
                                vod_id=vod_id,
                            )
                            rendered = out_mp4
                    ai_streamer = dict((ai_meta.get("streamer") or {}))
                    edits_mode = str((clip_edits.get("layout") or {}).get("mode") or "fit_top")
                    ai_streamer["layout"] = {
                        "layout": edits_mode,
                        "mode": edits_mode,
                        "editorMode": edits_mode,
                    }
                    poster = td_path / f"poster_{clip_id}.jpg"
                    poster_jpg(rendered, poster)
                    keys = clip_keys(workspace_id, project_id, clip_id)
                    upload_file(keys["preview"], rendered, "video/mp4")
                    upload_file(keys["poster"], poster, "image/jpeg")
                    put_json(keys["words"], clip_words)
                    crop_key = None
                    if crop_track.exists():
                        upload_file(keys["crop_track"], crop_track, "application/json")
                        crop_key = keys["crop_track"]

                    if ai_streamer:
                        ai_meta = {**ai_meta, "streamer": ai_streamer}
                    with stage_span("db_write_clip", clip_id=clip_id):
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
                                    seg_key,
                                    true_start_abs_ms,
                                    true_end_ms,
                                    json.dumps(ai_meta),
                                    json.dumps(clip_edits),
                                    clip_id,
                                ),
                            )
                        conn.commit()

                    delete_clip_source_segment(
                        workspace_id,
                        project_id,
                        clip_id,
                        seg_key,
                        vod_id=vod_id,
                    )

                    clips_ready += 1
                    _render_progress(clips_ready)

            # end clip loop

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
