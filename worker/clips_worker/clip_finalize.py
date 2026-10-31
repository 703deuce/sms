"""T6.7: ONE post-ingest per-clip pipeline for regular uploads and stream (Twitch/Kick) clips.

John's rule: uploads and streams are one system; the only difference is how the video
arrives. Before T6.7 the per-clip stage existed twice (``pipeline._regular_clip_type_and_layout``
+ ``_finalize_regular_clip_edits`` for uploads, an inline block in
``streamer/analyze_job.py`` for streams) and had drifted apart (see specs/T6_7_fixes.md,
"Divergences removed"). Both entry points now build a :class:`ClipInputs` from what their
ingest knows and call :func:`finalize_clip_edits`.

Steps (identical for both): facecam layout -> classify -> clip type -> T6 signals ->
template/layout pick (seeded by the clip id) -> silence trim -> caption preset -> auto
full-frame fallback.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

FACECAM_CONFIRMED = 0.85


@dataclass
class ClipInputs:
    edits: dict
    clip_file: Path | None
    clip_words: list[dict]
    settings: dict
    work_dir: Path | None
    clip_id: str
    #: clip start on the source timeline (clips.startMs); scene-segment times are relative to it.
    clip_start_ms: int = 0
    #: picker moment for this clip (``aiMeta.videoMoment``), section activity, IoU of the match.
    moment: dict | None = None
    section_activity: str | None = None
    moment_iou: float = 0.0
    #: majority clip type of the project (upload) or stream (stream) for picker fallback.
    majority: str | None = None
    #: facecam layout already known for the source (stream: VOD/channel layout). Optional.
    known_facecam_layout: dict | None = None
    fallback_archetype: str = ""
    channel_clip_type_layouts: dict | None = None
    #: dense clip-finder layout signals for this clip (``aiMeta.clipfind.layout_signals``).
    dense_candidate: dict | None = None
    #: extra aiMeta passed to signals (videoMoment, archetype ...).
    extra_meta: dict = field(default_factory=dict)
    #: per-ingest kill switch for classify (CLIP_CLASSIFY_STREAM) — not a behaviour fork.
    classify_allowed: bool = True


def dense_candidate_from_meta(meta: dict | None) -> dict | None:
    cf = (meta or {}).get("clipfind") if isinstance((meta or {}).get("clipfind"), dict) else {}
    ls = cf.get("layout_signals") if isinstance(cf, dict) else None
    return {"layout_signals": ls} if isinstance(ls, dict) else None


def resolve_facecam_layout(inp: ClipInputs) -> dict | None:
    """A confirmed known layout wins; otherwise detect on this clip; else the known one."""
    known = inp.known_facecam_layout if isinstance(inp.known_facecam_layout, dict) else None
    if known and isinstance(known.get("facecam"), dict) and float(known.get("confidence") or 0) >= FACECAM_CONFIRMED:
        return known
    fc = None
    if inp.clip_file is not None and Path(inp.clip_file).is_file():
        from clips_worker.streamer.layout.detect_facecam import detect_facecam_layout

        try:
            fc = detect_facecam_layout(Path(inp.clip_file), Path(inp.work_dir or Path(inp.clip_file).parent), n_samples=24)
        except Exception:
            fc = None
    return fc if isinstance(fc, dict) else known


def resolve_type_and_signals(inp: ClipInputs) -> tuple[dict, dict | None]:
    from clips_worker.clip_classify import classify_clip, clip_classify_enabled, resolve_type_from_classification
    from clips_worker.clip_type import resolve_upload_clip_type
    from clips_worker.t6_flags import t6_log_fallback, t6_signals_enabled

    majority = str(inp.majority or "irl")
    if majority == "other":
        majority = "irl"
    fc_layout = resolve_facecam_layout(inp)
    has_fc = bool(isinstance(fc_layout, dict) and isinstance(fc_layout.get("facecam"), dict))
    fc_conf = float((fc_layout or {}).get("confidence") or 0.0) if has_fc else 0.0
    vm = inp.moment if isinstance(inp.moment, dict) else None

    cls = None
    cls_type, cls_conf, type_source = None, 0.4, "picker"
    if inp.classify_allowed and clip_classify_enabled() and inp.clip_file is not None and Path(inp.clip_file).is_file():
        try:
            cls = classify_clip(Path(inp.clip_file), inp.clip_words or [], Path(inp.work_dir or Path(inp.clip_file).parent))
        except Exception:
            cls = None
        cls_type, cls_conf, type_source = resolve_type_from_classification(
            cls, facecam_conf=fc_conf, picker_moment=vm, fallback=majority
        )
    type_info = resolve_upload_clip_type(
        moment=vm,
        section_activity=inp.section_activity,
        upload_project_majority=majority,
        stream_majority=majority,
        moment_match_iou=float(inp.moment_iou or 0.0),
        has_facecam=has_fc,
        facecam_confidence=fc_conf,
    )
    if type_source == "classify" and cls_type:
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
    if t6_signals_enabled(inp.settings):
        try:
            from clips_worker.t6_signals import build_signals_for_clip

            sig = build_signals_for_clip(
                ai_meta={**(inp.extra_meta or {}), "videoMoment": vm, **type_info},
                fc_layout=fc_layout,
                words=inp.clip_words or [],
                crop_track=None,
                clip_file=inp.clip_file,
                work=inp.work_dir,
                dense_candidate=inp.dense_candidate,
            )
            type_info["signals"] = sig
            if type_info.get("typeSource") != "classify":
                if float(sig.get("type_conf") or 0) >= 0.6 and sig.get("clip_type"):
                    type_info["clipType"] = str(sig["clip_type"])
        except Exception as exc:
            t6_log_fallback("signals", exc)
    gui = vm.get("game_ui_visible") if isinstance(vm, dict) else None
    cam = vm.get("real_camera_footage") if isinstance(vm, dict) else None
    print(
        "[clipper:clip_type] "
        f"clip={inp.clip_id!r} majority={majority!r} moment_iou={float(inp.moment_iou or 0):.3f} "
        f"facecam={has_fc} facecam_conf={fc_conf:.3f} gui={gui} cam={cam} "
        f"conf={type_info.get('typeConf')} src={type_info.get('typeSource')!r} final={type_info.get('clipType')!r}",
        flush=True,
    )
    return type_info, fc_layout


def _pick_caption_preset(edits: dict, inp: ClipInputs, type_info: dict) -> dict:
    from clips_worker.t6_flags import t6_caption_presets_enabled, t6_log_fallback

    if not t6_caption_presets_enabled(inp.settings):
        return edits
    try:
        from clips_worker.t6_captions import pick_caption_preset

        signals = type_info.get("signals") if isinstance(type_info.get("signals"), dict) else {}
        cap_settings = inp.settings.get("captions") if isinstance(inp.settings.get("captions"), dict) else {}
        user_default = cap_settings.get("presetId")
        if user_default == "bold_pop" and not cap_settings.get("userChosen"):
            # T6.2: every project is created with settings.captions.presetId="bold_pop" (the
            # legacy default), which made the CP auto-pick dead code. Only an explicit choice wins.
            user_default = None
        cap = dict(edits.get("captions") or {})
        if user_default:
            cap["presetId"] = user_default
        else:
            from clips_worker.t6_render import probe_duration_s

            cf = Path(inp.clip_file) if inp.clip_file is not None else None
            dur = probe_duration_s(cf) if cf is not None and cf.is_file() else 30.0
            pid, reason = pick_caption_preset(
                signals, {"duration_s": dur, "id": inp.clip_id}, [], seed=inp.clip_id or "clip"
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
        return {**edits, "captions": cap}
    except Exception as exc:
        t6_log_fallback("captions", exc)
        return edits


def finalize_clip_edits(inp: ClipInputs) -> tuple[dict, dict, dict | None]:
    """The shared per-clip stage. Returns (edits, type_info, facecam_layout)."""
    from clips_worker.clip_layout_policy import apply_clip_type_layout_to_edits

    type_info, fc_layout = resolve_type_and_signals(inp)
    edits = inp.edits
    has_fc = bool(type_info.get("hasFacecam"))
    fc_conf = float(type_info.get("facecamConfidence") or 0.0)
    headline_on = bool(((edits.get("exportTemplate") or {}).get("headlineBar") or {}).get("enabled"))
    sig = type_info.get("signals") if isinstance(type_info.get("signals"), dict) else None
    edits = apply_clip_type_layout_to_edits(
        edits,
        clip_type=str(type_info["clipType"]),
        has_facecam=has_fc and fc_conf >= FACECAM_CONFIRMED,
        facecam_confidence=fc_conf,
        stream_facecam_layout=fc_layout,
        headline_on=headline_on,
        fallback_archetype=inp.fallback_archetype or "",
        channel_clip_type_layouts=inp.channel_clip_type_layouts,
        settings=inp.settings,
        signals=sig,
        # T6.7: was "" for uploads -> every upload clip used the same tie-break seed "clip".
        clip_id=inp.clip_id,
        clip_start_ms=int(inp.clip_start_ms or 0),
    )
    ct = str(type_info.get("clipType") or "irl")
    st = dict(edits.get("silenceTrim") or {})
    st["enabled"] = ct in ("just_chatting", "podcast")
    edits = {**edits, "silenceTrim": st}
    edits = _pick_caption_preset(edits, inp, type_info)
    if ct in ("just_chatting", "podcast") and inp.clip_file is not None and Path(inp.clip_file).is_file():
        from clips_worker.regular_auto_layout import apply_regular_auto_layout

        edits = apply_regular_auto_layout(edits, Path(inp.clip_file), inp.clip_words or [], streamer=False)
    from clips_worker.clip_layout_policy import apply_headline_layout_default

    edits = apply_headline_layout_default(edits, ct)
    return edits, type_info, fc_layout
