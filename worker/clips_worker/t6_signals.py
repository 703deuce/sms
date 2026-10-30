"""T6 per-clip layout signals (P1)."""
from __future__ import annotations

from typing import Any

SIGNALS_VERSION = 1


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def _norm_box(raw: Any) -> dict | None:
    if not isinstance(raw, dict):
        return None
    try:
        x = _clamp01(float(raw.get("x", 0)))
        y = _clamp01(float(raw.get("y", 0)))
        w = _clamp01(float(raw.get("w", 0)))
        h = _clamp01(float(raw.get("h", 0)))
    except (TypeError, ValueError):
        return None
    if w <= 0 or h <= 0:
        return None
    if x + w > 1.001:
        w = max(0.01, 1.0 - x)
    if y + h > 1.001:
        h = max(0.01, 1.0 - y)
    return {"x": round(x, 4), "y": round(y, 4), "w": round(w, 4), "h": round(h, 4)}


def validate_ai(raw: dict | None) -> dict:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, Any] = {}
    ct = str(raw.get("clip_type") or raw.get("clipType") or "").strip().lower()
    if ct in ("gaming", "irl", "just_chatting", "podcast"):
        out["clip_type"] = ct
    try:
        out["type_conf"] = _clamp01(float(raw.get("type_conf", raw.get("typeConf", 0))))
    except (TypeError, ValueError):
        out["type_conf"] = 0.0
    for key in ("game_ui_visible", "real_camera_footage", "background_action", "hud_at_edges"):
        if key in raw:
            out[key] = bool(raw.get(key))
    for box_key in ("action_box", "content_box", "facecam_box"):
        if box_key in raw:
            box = _norm_box(raw.get(box_key))
            if box:
                out[box_key] = box
    mk = str(raw.get("moment_kind") or "").strip().lower()
    if mk in ("play", "reaction", "story", "hot_take", "event"):
        out["moment_kind"] = mk
    en = str(raw.get("energy") or "").strip().lower()
    if en in ("low", "mid", "high"):
        out["energy"] = en
    reason = raw.get("background_action_reason")
    if isinstance(reason, str):
        out["background_action_reason"] = reason[:240]
    return out


def signals_or_defaults(ai_meta: dict | None) -> dict:
    meta = ai_meta if isinstance(ai_meta, dict) else {}
    stored = meta.get("signals")
    if isinstance(stored, dict) and stored.get("v") == SIGNALS_VERSION:
        base = dict(stored)
    else:
        base = {"v": SIGNALS_VERSION}
    clip_type = str(meta.get("clipType") or base.get("clip_type") or "irl")
    base.setdefault("clip_type", clip_type)
    base.setdefault("type_conf", float(base.get("type_conf") or 0.0))
    base.setdefault("game_ui_visible", bool(base.get("game_ui_visible", False)))
    base.setdefault("real_camera_footage", bool(base.get("real_camera_footage", False)))
    fc = None
    layout = (meta.get("facecamLayout") or {}) if isinstance(meta.get("facecamLayout"), dict) else {}
    if isinstance(layout.get("facecam"), dict):
        fc = _norm_box(layout.get("facecam"))
    base.setdefault("facecam_box", fc)
    base.setdefault("facecam_conf", float(meta.get("facecamConfidence") or base.get("facecam_conf") or 0.0))
    base.setdefault("person_count", int(base.get("person_count") or 1))
    base.setdefault("background_action", bool(base.get("background_action", True)))
    base.setdefault("moment_kind", str(base.get("moment_kind") or "story"))
    base.setdefault("energy", str(base.get("energy") or "mid"))
    base.setdefault("hud_at_edges", bool(base.get("hud_at_edges", False)))
    bands = base.get("bands")
    if not isinstance(bands, dict):
        bands = {}
    for band in ("top", "bottom", "caption"):
        row = bands.get(band) if isinstance(bands.get(band), dict) else {}
        base.setdefault("bands", {})
        base["bands"].setdefault(
            band,
            {
                "luma": float(row.get("luma", 0.3)),
                "busy": float(row.get("busy", 0.5)),
            },
        )
    base.setdefault("sources", {"ai": "none", "cv": "local"})
    base.setdefault("cost_usd", float(base.get("cost_usd") or 0.0))
    return base


def merge_dense_layout_signals(candidate: dict | None) -> dict | None:
    if not isinstance(candidate, dict):
        return None
    raw = candidate.get("layout_signals")
    if not isinstance(raw, dict):
        return None
    validated = validate_ai(raw)
    if not validated:
        return None
    validated["v"] = SIGNALS_VERSION
    validated["sources"] = {"ai": "dense", "cv": "local"}
    return validated


SIGNALS_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "clip_type": {"type": "string", "enum": ["gaming", "irl", "just_chatting", "podcast"]},
        "type_conf": {"type": "number"},
        "game_ui_visible": {"type": "boolean"},
        "real_camera_footage": {"type": "boolean"},
        "action_box": {"type": ["object", "null"]},
        "content_box": {"type": ["object", "null"]},
        "background_action": {"type": "boolean"},
        "background_action_reason": {"type": "string"},
        "moment_kind": {"type": "string", "enum": ["play", "reaction", "story", "hot_take", "event"]},
        "energy": {"type": "string", "enum": ["low", "mid", "high"]},
    },
    "required": [
        "clip_type",
        "type_conf",
        "game_ui_visible",
        "real_camera_footage",
        "background_action",
        "moment_kind",
        "energy",
    ],
}


def _transcript_snippet(words: list[dict], max_lines: int = 40) -> str:
    lines: list[str] = []
    for w in words[: max_lines * 6]:
        try:
            lines.append(f"[{float(w['s']):.1f}] {w.get('w') or w.get('word') or ''}")
        except (KeyError, TypeError, ValueError):
            continue
    return "\n".join(lines[:max_lines]) or "(no transcript)"


def signals_call(clip_file, words: list[dict], work, model: str | None = None) -> tuple[dict | None, float]:
    """Flash-Lite layout signals for one clip file."""
    from pathlib import Path

    from clips_worker.gemini_vision import discover_video_picker_model
    from clips_worker.video_picker import (
        _gemini_post_watch,
        _labeled_frame_user_parts,
        estimate_gemini_usd,
        make_watch_proxy,
        video_picker_media_resolution,
    )

    path = Path(clip_file) if clip_file is not None else None
    if path is None or not path.is_file():
        return None, 0.0
    work = Path(work)
    work.mkdir(parents=True, exist_ok=True)
    model = (model or discover_video_picker_model()).strip()
    proxy = work / "signals_watch.mp4"
    try:
        import json
        import subprocess

        dur = float(
            json.loads(
                subprocess.check_output(
                    [
                        "ffprobe",
                        "-v",
                        "error",
                        "-show_entries",
                        "format=duration",
                        "-of",
                        "json",
                        str(path),
                    ],
                    stderr=subprocess.DEVNULL,
                )
            )["format"]["duration"]
        )
    except Exception:
        dur = 30.0
    dur = max(3.0, min(120.0, dur))
    make_watch_proxy(path, proxy, 0.0, dur)
    prompt = (
        "Return layout_signals JSON only. clip_type gaming|irl|just_chatting|podcast. "
        "game_ui_visible=true only if persistent game HUD/menus dominate the frame. "
        "real_camera_footage=true when the clip is mostly real camera (sports, IRL, podcast), not pure game capture. "
        "background_action=true when the scene has meaningful motion/activity beyond a static talking head. "
        "Normalized boxes 0-1 on 16:9 or null.\n\n"
        f"TRANSCRIPT:\n{_transcript_snippet(words)}"
    )
    parts = _labeled_frame_user_parts(
        proxy,
        work,
        duration_s=int(dur),
        user_text=prompt,
        fps=0.5,
        part_order="frames_first",
    )
    gen: dict = {
        "responseMimeType": "application/json",
        "responseSchema": SIGNALS_SCHEMA,
        "mediaResolution": video_picker_media_resolution(),
        "maxOutputTokens": 600,
    }
    payload = {
        "systemInstruction": {"parts": [{"text": "You label short vertical clip layout signals. JSON only."}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": gen,
    }
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            res, err, status = _gemini_post_watch(model, payload, chunk_label="t6_signals")
            if res is None or not res.ok:
                raise RuntimeError(f"signals_gemini_failed status={status} {str(err)[:120]}")
            data = res.json()
            u = data.get("usageMetadata") or {}
            usd = estimate_gemini_usd(int(u.get("promptTokenCount") or 0), int(u.get("candidatesTokenCount") or 0), model)
            import json as json_mod

            raw = json_mod.loads(data["candidates"][0]["content"]["parts"][0]["text"])
            validated = validate_ai(raw)
            if not validated.get("clip_type"):
                return None, usd
            validated["sources"] = {"ai": "call", "cv": "local"}
            validated["cost_usd"] = usd
            return validated, usd
        except Exception as exc:
            last_exc = exc
            continue
    if last_exc:
        print(f"[t6:signals] call_failed err={type(last_exc).__name__}", flush=True)
    return None, 0.0


def build_signals_for_clip(
    *,
    ai_meta: dict,
    fc_layout: dict | None,
    words: list[dict] | None,
    crop_track: dict | None,
    clip_file,
    work,
    dense_candidate: dict | None = None,
) -> dict:
    from clips_worker.t6_cv import enrich_signals_cv

    base = signals_or_defaults(ai_meta)
    dense = merge_dense_layout_signals(dense_candidate)
    if dense:
        base.update({k: v for k, v in dense.items() if k != "v"})
        base["sources"] = {"ai": "dense", "cv": "local"}
    elif isinstance(ai_meta.get("videoMoment"), dict):
        vm = ai_meta["videoMoment"]
        if vm.get("game_ui_visible") is not None or vm.get("real_camera_footage") is not None:
            base["game_ui_visible"] = bool(vm.get("game_ui_visible"))
            base["real_camera_footage"] = bool(vm.get("real_camera_footage"))
            base["sources"] = {"ai": "picker", "cv": "local"}
    if isinstance(fc_layout, dict):
        if isinstance(fc_layout.get("facecam"), dict):
            box = _norm_box(fc_layout.get("facecam"))
            if box:
                base["facecam_box"] = box
        base["facecam_conf"] = float(fc_layout.get("confidence") or base.get("facecam_conf") or 0.0)
    if base.get("sources", {}).get("ai") == "none" and clip_file is not None and work is not None:
        ai_sig, cost = signals_call(clip_file, words or [], work)
        if ai_sig:
            base.update({k: v for k, v in ai_sig.items() if k not in ("v",)})
            base["sources"] = {"ai": "call", "cv": "local"}
            base["cost_usd"] = float(cost)
    try:
        base = enrich_signals_cv(base, clip_file, words or [], crop_track)
    except Exception:
        pass
    base["v"] = SIGNALS_VERSION
    return base
