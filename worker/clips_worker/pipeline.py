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
from clips_worker.overlap_policy import PICK_OVERLAP_RATIO

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
    layout_mode = str(
        settings.get("layoutMode") or layout_cfg.get("mode") or settings.get("layout") or "speaker_follow"
    ).lower()
    if isinstance(settings.get("layout"), str):
        layout_mode = str(settings.get("layoutMode") or settings.get("layout") or "speaker_follow").lower()
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


def _regular_initial_edits(settings: dict, pick: dict, clip_words: list[dict]) -> dict:
    from clips_worker.picker.public_copy import headline_text_from_pick

    edits = initial_clip_edits(settings)
    edits["v"] = 2
    headline = headline_text_from_pick(pick)
    if headline:
        edits["exportTemplate"] = {
            "headlineBar": {"enabled": False, "text": headline},
            "suggestedHeadline": headline,
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
    from clips_worker.clip_layout_policy import apply_content_layout_to_edits
    from clips_worker.streamer.content_archetype import resolve_streamer_layout_archetype

    layout_archetype, archetype_source = resolve_streamer_layout_archetype(vod=vod, state=vod_state)
    edits = apply_content_layout_to_edits(
        edits,
        archetype=layout_archetype,
        headline_on=headline_on,
        archetype_source=archetype_source,
    )
    layout = dict(edits.get("layout") or {})
    layout.setdefault("shotOverrides", [])
    edits["layout"] = layout

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


def _regular_clip_type_and_layout(
    edits: dict,
    clip_file: Path,
    pick: dict | None,
    settings: dict,
    work_dir: Path,
    clip_words: list[dict] | None = None,
) -> tuple[dict, dict, dict | None]:
    from clips_worker.clip_layout_policy import apply_clip_type_layout_to_edits
    from clips_worker.clip_type import (
        content_type_from_picker_moment,
        resolve_upload_clip_type,
        upload_should_run_facecam_detect,
    )

    meta = (pick or {}).get("aiMeta") or {}
    vm = meta.get("videoMoment")
    section_activity = meta.get("sectionActivity")
    stream_majority = meta.get("streamMajorityType")
    project_majority = str(meta.get("uploadProjectMajorityType") or stream_majority or "irl")
    if project_majority == "other":
        project_majority = "irl"
    picker_ct = content_type_from_picker_moment(vm, section_activity)
    moment_iou = float(meta.get("videoMomentMatchIou") or 0.0)

    fc_layout = None
    if upload_should_run_facecam_detect(
        picker_ct=picker_ct,
        project_majority=project_majority,
        stream_majority=stream_majority,
        moment=vm,
    ):
        from clips_worker.streamer.layout.detect_facecam import detect_facecam_layout

        try:
            fc_layout = detect_facecam_layout(clip_file, work_dir, n_samples=24)
        except Exception:
            fc_layout = None

    has_fc = bool(isinstance(fc_layout, dict) and isinstance(fc_layout.get("facecam"), dict))
    fc_conf = float((fc_layout or {}).get("confidence") or 0.0)
    has_fc_layout = has_fc and fc_conf >= 0.85

    from clips_worker.clip_classify import (
        classify_clip,
        clip_classify_enabled,
        resolve_type_from_classification,
    )

    cls = None
    cls_type = picker_ct
    cls_conf = 0.4
    type_source = "picker"
    if clip_classify_enabled():
        cls = classify_clip(clip_file, clip_words or [], work_dir)
        cls_type, cls_conf, type_source = resolve_type_from_classification(
            cls,
            facecam_conf=fc_conf,
            picker_moment=vm if isinstance(vm, dict) else None,
            fallback=project_majority,
        )

    type_info = resolve_upload_clip_type(
        moment=vm,
        section_activity=section_activity,
        upload_project_majority=project_majority,
        stream_majority=stream_majority,
        moment_match_iou=moment_iou,
        has_facecam=has_fc,
        facecam_confidence=fc_conf,
    )
    if type_source == "classify":
        type_info["clipType"] = cls_type
    type_info["typeSource"] = type_source
    type_info["typeConf"] = round(float(cls_conf), 3)
    if cls:
        type_info["classify"] = cls
    if has_fc and isinstance(fc_layout, dict):
        type_info["facecamLayout"] = {
            k: fc_layout.get(k)
            for k in ("layout", "facecam", "gameplay", "split", "facecamPosition", "confidence", "method")
            if fc_layout.get(k) is not None
        }
    from clips_worker.t6_flags import t6_log_fallback, t6_signals_enabled

    if t6_signals_enabled(settings):
        try:
            from clips_worker.t6_signals import build_signals_for_clip

            sig = build_signals_for_clip(
                ai_meta={**meta, **type_info},
                fc_layout=fc_layout,
                words=clip_words or [],
                crop_track=None,
                clip_file=clip_file,
                work=work_dir,
            )
            type_info["signals"] = sig
            if type_info.get("typeSource") != "classify":
                if float(sig.get("type_conf") or 0) >= 0.6 and sig.get("clip_type"):
                    type_info["clipType"] = str(sig["clip_type"])
            print(
                "[t6:signals] "
                f"type={type_info.get('clipType')!r} conf={float(sig.get('type_conf') or 0):.2f} "
                f"facecam={float(sig.get('facecam_conf') or 0):.2f} "
                f"bg_action={bool(sig.get('background_action'))} "
                f"src_ai={(sig.get('sources') or {}).get('ai')!r}",
                flush=True,
            )
        except Exception as exc:
            t6_log_fallback("signals", exc)
    gui = vm.get("game_ui_visible") if isinstance(vm, dict) else None
    cam = vm.get("real_camera_footage") if isinstance(vm, dict) else None
    print(
        "[clipper:upload_type] "
        f"picker_ct={picker_ct!r} stream_majority={stream_majority!r} "
        f"project_majority={project_majority!r} moment_iou={moment_iou:.3f} "
        f"facecam={has_fc} facecam_conf={fc_conf:.3f} "
        f"gui={gui} cam={cam} "
        f"cls={type_info.get('clipType')!r} cls_conf={type_info.get('typeConf')} src={type_info.get('typeSource')!r} "
        f"final={type_info.get('clipType')!r}",
        flush=True,
    )
    headline_on = bool(((edits.get("exportTemplate") or {}).get("headlineBar") or {}).get("enabled"))
    sig = type_info.get("signals") if isinstance(type_info.get("signals"), dict) else None
    edits = apply_clip_type_layout_to_edits(
        edits,
        clip_type=type_info["clipType"],
        has_facecam=has_fc_layout,
        facecam_confidence=fc_conf,
        stream_facecam_layout=fc_layout,
        headline_on=headline_on,
        fallback_archetype=str(meta.get("archetype") or ""),
        channel_clip_type_layouts=None,
        settings=settings,
        signals=sig,
        clip_id=str(meta.get("clipId") or pick.get("id") or ""),
    )
    return edits, type_info, fc_layout


def _finalize_regular_clip_edits(
    edits: dict,
    clip_file: Path,
    clip_words: list[dict],
    settings: dict,
    mode: str,
    *,
    pick: dict | None = None,
    work_dir: Path | None = None,
) -> tuple[dict, dict, dict | None]:
    if mode == "anything" or settings.get("streamer"):
        return edits, {}, None
    wd = work_dir or clip_file.parent
    edits, type_info, _fc = _regular_clip_type_and_layout(
        edits, clip_file, pick, settings, wd, clip_words=clip_words
    )
    ct = str(type_info.get("clipType") or "irl")
    st = dict(edits.get("silenceTrim") or {})
    st["enabled"] = ct in ("just_chatting", "podcast")
    edits = {**edits, "silenceTrim": st}
    from clips_worker.t6_flags import t6_caption_presets_enabled

    if t6_caption_presets_enabled(settings):
        try:
            from clips_worker.t6_captions import pick_caption_preset

            signals = type_info.get("signals") if isinstance(type_info.get("signals"), dict) else {}
            meta = (pick or {}).get("aiMeta") or {}
            user_default = (settings.get("captions") or {}).get("presetId")
            cap = dict(edits.get("captions") or {})
            if user_default:
                cap["presetId"] = user_default
            else:
                from clips_worker.t6_render import probe_duration_s

                dur = probe_duration_s(clip_file) if clip_file.is_file() else 30.0
                clip_id = str(meta.get("clipId") or (pick or {}).get("id") or "")
                history: list[str] = []
                pid, reason = pick_caption_preset(
                    signals,
                    {"duration_s": dur, "id": clip_id},
                    history,
                    seed=clip_id or "clip",
                )
                strip_keys = (
                    "presetConfig",
                    "animation",
                    "case",
                    "colors",
                    "wordsPerLine",
                    "keywordHighlight",
                    "activeStyle",
                    "highlightColor",
                )
                cap = {k: v for k, v in cap.items() if k not in strip_keys}
                cap.update({"presetId": pid, "t6": {"auto": True, "reason": reason}})
            edits = {**edits, "captions": cap}
        except Exception as exc:
            from clips_worker.t6_flags import t6_log_fallback

            t6_log_fallback("captions", exc)
    if ct in ("just_chatting", "podcast"):
        from clips_worker.regular_auto_layout import apply_regular_auto_layout

        edits = apply_regular_auto_layout(
            edits,
            clip_file,
            clip_words,
            streamer=bool(settings.get("streamer")),
        )
    return edits, type_info, _fc


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
    from clips_worker.clipfind.context import bind_clipfind, unbind_clipfind
    from clips_worker.clipfind.flags import log_resolved_flags

    project_id = project["id"]
    range_start = int(project.get("rangeStartMs") or 0)
    range_end = int(project.get("rangeEndMs") or 0)

    from clips_worker.content_detection import normalize_content_mode

    mode = normalize_content_mode(settings.get("mode"))
    bind_clipfind(
        workspace_id=str(workspace_id),
        job_type="PROCESS_PROJECT",
        job_id=str(job_id),
        project_id=str(project_id),
    )
    log_resolved_flags()
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
    from clips_worker.decision_log import bind_decision_log, decision_log, flush_decision_log, unbind_decision_log

    bind_decision_log(conn, job_id)
    decision_log("pipeline", "start", mode=mode, project_id=project_id)
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
                    from clips_worker.overlap_policy import spans_match_planned_render

                    sk = _span_key(int(pick["start_ms"]), int(pick["end_ms"]))
                    by_span = head_render_state.get("by_span") or {}
                    row = by_span.get(sk)
                    if row is not None:
                        decision_log(
                            "headstart",
                            "reuse_exact",
                            planned_start_ms=int(pick["start_ms"]),
                            planned_end_ms=int(pick["end_ms"]),
                        )
                        return row
                    s0, e0 = int(pick["start_ms"]), int(pick["end_ms"])
                    for cached in by_span.values():
                        rs, re = int(cached["startMs"]), int(cached["endMs"])
                        if spans_match_planned_render(s0, e0, rs, re):
                            decision_log(
                                "headstart",
                                "reuse_exact",
                                planned_start_ms=s0,
                                planned_end_ms=e0,
                                cached_start_ms=rs,
                                cached_end_ms=re,
                            )
                            return cached
                    return None

                def _overlap_existing_locked(start_ms: int, end_ms: int) -> bool:
                    """Caller must hold span_lock (non-reentrant threading.Lock)."""
                    for a0, a1 in rendered_spans:
                        if spans_same_segment(a0, a1, start_ms, end_ms):
                            continue
                        overlap = max(0, min(a1, end_ms) - max(a0, start_ms))
                        span = max(1, min(a1 - a0, end_ms - start_ms))
                        if overlap / span >= PICK_OVERLAP_RATIO:
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
                    polish_edits = apply_clip_polish_initial(
                        _regular_initial_edits(settings, pick, clip_words),
                        pick,
                        clip_words,
                        settings,
                    )
                    edits_final, type_info, _fc = _finalize_regular_clip_edits(
                        polish_edits,
                        clip_file,
                        clip_words,
                        settings,
                        mode,
                        pick=pick,
                        work_dir=td_path / f"reframe_work_{idx}",
                    )
                    layout_ed = edits_final.get("layout") if isinstance(edits_final.get("layout"), dict) else {}
                    final_mode = str(layout_ed.get("mode") or resolved_layout)
                    clip_settings = {**settings, "layout": resolved_layout, "layoutMode": final_mode}
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
                    ai_meta_out = {
                        **ai_meta_out,
                        **type_info,
                        "layoutMode": final_mode,
                        "layoutResolved": final_mode,
                    }
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
                        "edits": edits_final,
                        "aiMeta": ai_meta_out,
                    }

                def _render_pick_async(pick: dict, clip_index: int, clips_total_hint: int) -> None:
                    if not _mark_span(pick["start_ms"], pick["end_ms"]):
                        return
                    sk = _span_key(pick["start_ms"], pick["end_ms"])
                    try:
                        cid = head_render_state.get("clip_id_by_span", {}).get(sk)
                        row = build_clip_row_from_pick(pick, clip_index, clip_id=cid)
                        head_render_state["by_span"][sk] = row
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
                    decision_log(
                        "headstart",
                        "render_early",
                        start_ms=int(top.get("start_ms") or 0),
                        end_ms=int(top.get("end_ms") or 0),
                        title=str(top.get("title") or "")[:80],
                    )
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
                from clips_worker.pipeline_plan import plan_or_finish_empty

                planned = plan_or_finish_empty(
                    conn,
                    project_id,
                    job_id,
                    post_progress,
                    picks,
                    picker_message,
                    mark_project_ready=mark_project_ready,
                )
                if planned is None:
                    return
                picks = planned
                try:
                    from clips_worker.clipfind.c2_seams import validate_frozen_upload_picks
                    from clips_worker.target_clip_len import resolve_clip_length_policy

                    _max_ms = resolve_clip_length_policy(settings).max_ms
                    picks = validate_frozen_upload_picks(picks, max_ms=_max_ms)
                except Exception as exc:
                    from clips_worker.clipfind.flags import clipfind_fallback

                    clipfind_fallback("upload_validate", type(exc).__name__, exc=exc)

                from clips_worker.headstart_render import (
                    await_headstart_render,
                    prune_headstart_to_planned,
                )

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
                prune_headstart_to_planned(
                    head_render_state,
                    picks,
                    span_key=_span_key,
                    rendered_spans=rendered_spans,
                    persisted_spans=persisted_spans,
                    span_lock=span_lock,
                    project_id=project_id,
                    conn=conn,
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
                            cmeta = cached.get("aiMeta") or {}
                            if cmeta.get("typeSource") == "classify":
                                return cached
                            from clips_worker.clip_type import resolve_upload_clip_type

                            pmeta = pick.get("aiMeta") or {}
                            cached_type = cmeta.get("clipType")
                            expected_type = resolve_upload_clip_type(
                                moment=pmeta.get("videoMoment"),
                                section_activity=pmeta.get("sectionActivity"),
                                upload_project_majority=pmeta.get("uploadProjectMajorityType"),
                                stream_majority=pmeta.get("streamMajorityType"),
                                moment_match_iou=float(pmeta.get("videoMomentMatchIou") or 0),
                                has_facecam=bool(cmeta.get("hasFacecam")),
                                facecam_confidence=float(cmeta.get("facecamConfidence") or 0),
                            ).get("clipType")
                            if cached_type and expected_type and str(cached_type) != str(
                                expected_type
                            ):
                                print(
                                    "[clipper:upload_type] headstart_type_mismatch "
                                    f"cached={cached_type!r} final={expected_type!r}",
                                    flush=True,
                                )
                                return build_clip_row_from_pick(
                                    pick, idx, clip_id=str(cached.get("id") or "")
                                )
                            return cached
                        if not _mark_span(pick["start_ms"], pick["end_ms"]):
                            decision_log(
                                "render",
                                "skip",
                                reason="overlap_existing_span",
                                idx=idx,
                                start_ms=int(pick.get("start_ms") or 0),
                                end_ms=int(pick.get("end_ms") or 0),
                            )
                            return None
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

            if not talking_render_done:
                from clips_worker.pipeline_plan import plan_or_finish_empty

                planned = plan_or_finish_empty(
                    conn,
                    project_id,
                    job_id,
                    post_progress,
                    picks,
                    picker_message,
                    mark_project_ready=mark_project_ready,
                )
                if planned is None:
                    return
                picks = planned
                try:
                    from clips_worker.clipfind.c2_seams import validate_frozen_upload_picks
                    from clips_worker.target_clip_len import resolve_clip_length_policy

                    _max_ms = resolve_clip_length_policy(settings).max_ms
                    picks = validate_frozen_upload_picks(picks, max_ms=_max_ms)
                except Exception as exc:
                    from clips_worker.clipfind.flags import clipfind_fallback

                    clipfind_fallback("upload_validate", type(exc).__name__, exc=exc)

            print(
                f"[clipper:picker] project={project_id} mode={mode} picks={len(picks)} "
                f"message={picker_message!r}",
                flush=True,
            )

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
                    polish_edits = apply_clip_polish_initial(
                        _regular_initial_edits(settings, pick, clip_words),
                        pick,
                        clip_words,
                        settings,
                    )
                    edits_final, type_info, _fc = _finalize_regular_clip_edits(
                        polish_edits,
                        clip_file,
                        clip_words,
                        settings,
                        mode,
                        pick=pick,
                        work_dir=td_path / f"reframe_work_{idx}",
                    )
                    layout_ed = edits_final.get("layout") if isinstance(edits_final.get("layout"), dict) else {}
                    final_mode = str(layout_ed.get("mode") or resolved_layout)
                    clip_settings = {**settings, "layout": resolved_layout, "layoutMode": final_mode}
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
                    ai_meta_out = {
                        **ai_meta_out,
                        **type_info,
                        "layoutMode": final_mode,
                        "layoutResolved": final_mode,
                    }
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
                        "edits": edits_final,
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
            shipped = [
                {
                    "id": r.get("id"),
                    "startMs": r.get("startMs"),
                    "endMs": r.get("endMs"),
                    "title": (r.get("title") or "")[:80],
                }
                for r in (clip_rows or [])
            ]
            decision_log(
                "render",
                "shipped",
                count=len(shipped),
                clips=shipped[:40],
            )
            flush_decision_log(force=True)
            post_progress(
                job_id,
                {"projectStatus": "READY", "stage": "ready", "progress": 100, "jobStatus": "DONE", "error": None},
            )
    finally:
        try:
            from clips_worker.clipfind.context import get_job_ctx, get_ledger

            led = get_ledger()
            ctx = get_job_ctx()
            if led and ctx and ctx.project_id and ctx.job_type == "PROCESS_PROJECT":
                base = f"workspaces/{ctx.workspace_id}/projects/{ctx.project_id}/clipfind"
                shadow = ctx.extra.get("clipfind_upload_shadow")
                put_json(f"{base}/clipfind_ledger.json", led.summary())
                if shadow:
                    put_json(f"{base}/clipfind_shadow.json", shadow)
        except Exception as exc:
            from clips_worker.clipfind.flags import clipfind_fallback

            clipfind_fallback("pipeline_upload_artifacts", type(exc).__name__, exc=exc)
        try:
            from clips_worker.clipfind.context import unbind_clipfind

            unbind_clipfind()
            from clips_worker.decision_log import unbind_decision_log

            unbind_decision_log()
        except Exception:
            pass
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
