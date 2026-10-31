"""Per-clip main-picture classification (T5.5 F2)."""
from __future__ import annotations

import base64
import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

from clips_worker.video_picker import (
    GEMINI_BASE,
    _gemini_omits_legacy_sampling,
    _gemini_post_watch,
    _key,
    estimate_gemini_usd,
    video_picker_media_resolution,
)

_BOX_SCHEMA: dict = {
    "type": "object",
    "properties": {"x": {"type": "number"}, "y": {"type": "number"}, "w": {"type": "number"}, "h": {"type": "number"}},
    "required": ["x", "y", "w", "h"],
}
# T6.7: per-clip scene map (authoritative for layout; t6_scenes.py). One extra field in the
# existing call, no new call.
SCENES_SCHEMA: dict = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "start_s": {"type": "number"},
            "end_s": {"type": "number"},
            "layout": {
                "type": "string",
                "enum": ["webcam_game", "webcam_screen", "full_cam_person", "multi_cam", "irl_world", "no_person"],
            },
            "n_cams": {"type": "integer"},
            "real_person_boxes": {"type": "array", "items": _BOX_SCHEMA},
            "facecam_box": {**_BOX_SCHEMA, "nullable": True},
            "content_box": {**_BOX_SCHEMA, "nullable": True},
        },
        "required": ["start_s", "end_s", "layout", "real_person_boxes"],
    },
}

CLASSIFY_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "main_picture": {
            "type": "string",
            "enum": ["video_game", "real_camera", "desktop_or_browser", "mixed"],
        },
        "game_graphics_visible": {"type": "boolean"},
        "sport_or_physical_activity": {"type": "boolean"},
        "seated_talking_to_camera": {"type": "boolean"},
        "people_on_camera": {"type": "integer"},
        "clip_type": {"type": "string", "enum": ["gaming", "irl", "just_chatting", "podcast"]},
        "confidence": {"type": "number"},
        "evidence": {"type": "string"},
        "scenes": SCENES_SCHEMA,
    },
    "required": [
        "main_picture",
        "game_graphics_visible",
        "sport_or_physical_activity",
        "seated_talking_to_camera",
        "people_on_camera",
        "clip_type",
        "confidence",
        "evidence",
        "scenes",
    ],
}

CLASSIFY_PROMPT = """You classify ONE short clip from a livestream/video. Judge the MAIN picture (the largest area), not overlays.
IGNORE streaming overlays: chat boxes, subscriber/sub-goal bars, alerts, donation pop-ups, small webcam boxes, sponsor logos, scoreboards.
- main_picture=video_game: rendered video-game graphics fill the main picture: gameplay, HUD, health/ammo bars, minimap, game menus, level/track select, loading screens.
- main_picture=real_camera: filmed by a real camera: people, rooms, streets, gyms, courts, events. REAL SPORTS (basketball, football, boxing…) are real_camera, never video_game.
- main_picture=desktop_or_browser: websites, videos being watched, documents, code.
- game_graphics_visible: true only if video-game graphics are the main picture (a small webcam overlay does not change this).
- seated_talking_to_camera: one or more people sitting and talking to the camera as the main subject (desk/mic, but also a car seat, couch or table), framed as a talking head, with nothing important happening around or behind them. false when they walk or move around, are at an event/venue/street scene, play a sport, or the action around them matters.
clip_type rules (apply in order):
1. main_picture=video_game -> gaming.
2. main_picture=real_camera and seated_talking_to_camera -> podcast if people_on_camera>=2 else just_chatting.
   podcast cues: 2+ hosts in a conversation, each on their own mic and/or their own camera/webcam box, often with show branding (show name/logo, lower thirds, guest name cards). A studio show with these cues is podcast even when it also shows a screen or clip.
3. main_picture=real_camera -> irl.
4. desktop_or_browser -> just_chatting.
scenes: split the clip into the parts where the PICTURE LAYOUT stays the same (frames are labelled with their time in seconds; a scene starts/ends between two frames where the layout changes). Usually 1 scene; only split on a real layout change (the stream switches scene, a cut to another camera, the webcam appears/disappears). For each scene:
- layout: webcam_game = game + webcam overlay of the streamer; webcam_screen = streamer's webcam over a website/video/screen they react to; full_cam_person = one camera fills the picture with the live person (or a group SEATED together at a desk/couch/table with nothing happening behind them); multi_cam = 2+ SEPARATE camera feeds / webcam boxes shown at the same time, each with its own live person (n_cams = how many feeds) - NEVER a group filmed by one camera; irl_world = filmed out and about / at a venue / anywhere the background or action matters, INCLUDING a group filmed by one camera that is not seated at a desk/couch; no_person = no live person visible (game only, screen only, video only).
- A webcam slot counts only if a live person is visible in it. A dark, empty, covered or "camera off" slot is NOT a facecam: use no_person (game/screen only) and facecam_box=null.
- real_person_boxes: a box around the HEAD of each LIVE streamer/host/guest in this scene. NEVER pictures, posters, statues, masks, carved pumpkins, figurines, thumbnails, faces inside a game, or faces in a video/stream that is being watched.
- facecam_box: the streamer's webcam rectangle (or the cut-out webcam area) when it is an overlay, else null. content_box: the website/video area being reacted to, else null.
Boxes are {x,y,w,h} as fractions 0-1 of the full frame (x,y = top-left).
Return JSON only."""


# T6.7: frames for the scene map: one per ~SCENE_FRAME_EVERY_S, 4..8 (was a fixed 4). Product
# choices (cost vs scene-boundary resolution), not fitted on the tuning videos.
SCENE_FRAME_EVERY_S = 5.0
SCENE_FRAMES_MIN = 4
SCENE_FRAMES_MAX = 8
SCENES_MAX_OUTPUT_TOKENS = 900


def classify_frame_times(dur_s: float) -> list[float]:
    n = int(round(float(dur_s) / SCENE_FRAME_EVERY_S))
    n = max(SCENE_FRAMES_MIN, min(SCENE_FRAMES_MAX, n))
    return [round(max(0.0, min(dur_s - 0.05, dur_s * (i + 0.5) / n)), 2) for i in range(n)]


def clip_classify_enabled() -> bool:
    return os.environ.get("CLIP_CLASSIFY", "1").strip() not in ("0", "false", "False")


def clip_classify_stream_enabled() -> bool:
    return os.environ.get("CLIP_CLASSIFY_STREAM", "1").strip() not in ("0", "false", "False")


def _clip_duration_s(clip_file: Path) -> float:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(clip_file),
            ],
            stderr=subprocess.DEVNULL,
        )
        return max(0.5, float(json.loads(out)["format"]["duration"]))
    except Exception:
        return 30.0


def _extract_frame_jpeg(clip_file: Path, t_s: float, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{t_s:.3f}",
                "-i",
                str(clip_file),
                "-frames:v",
                "1",
                "-vf",
                "scale=512:-2",
                "-q:v",
                "5",
                str(dest),
            ],
            check=True,
            capture_output=True,
            timeout=45,
        )
        return dest.is_file() and dest.stat().st_size > 100
    except Exception:
        return False


def _transcript_snippet(words: list[dict], max_chars: int = 400) -> str:
    parts: list[str] = []
    n = 0
    for w in words:
        text = str(w.get("w") or w.get("word") or "").strip()
        if not text:
            continue
        chunk = text + " "
        if n + len(chunk) > max_chars:
            break
        parts.append(text)
        n += len(chunk)
    return " ".join(parts)[:max_chars] or "(no speech)"


def classify_clip(
    clip_file: Path,
    words: list[dict],
    work: Path,
    *,
    timeout_s: float = 20.0,
) -> dict | None:
    from clips_worker.decision_log import decision_log
    from clips_worker.gemini_vision import discover_video_picker_model

    clip_file = Path(clip_file)
    if not clip_file.is_file():
        return None
    work = Path(work)
    work.mkdir(parents=True, exist_ok=True)
    model = discover_video_picker_model().strip()
    dur = _clip_duration_s(clip_file)
    parts: list[dict] = [{"text": CLASSIFY_PROMPT}]
    parts.append({"text": f"TRANSCRIPT:\n{_transcript_snippet(words)}"})
    parts.append({"text": f"CLIP LENGTH: {dur:.1f} s"})
    for i, t_s in enumerate(classify_frame_times(dur)):
        frame_path = work / f"classify_{i}.jpg"
        if not _extract_frame_jpeg(clip_file, t_s, frame_path):
            continue
        parts.append({"text": f"[t={t_s:.1f}s]"})
        raw = frame_path.read_bytes()
        parts.append(
            {
                "inlineData": {
                    "mimeType": "image/jpeg",
                    "data": base64.b64encode(raw).decode("ascii"),
                }
            }
        )
    gen: dict[str, Any] = {
        "responseMimeType": "application/json",
        "responseSchema": CLASSIFY_SCHEMA,
        "maxOutputTokens": SCENES_MAX_OUTPUT_TOKENS,
        "temperature": 0,
        "mediaResolution": video_picker_media_resolution(),
    }
    if _gemini_omits_legacy_sampling(model):
        gen.pop("temperature", None)
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": gen,
    }
    t0 = time.time()
    last_err = ""
    for attempt in range(2):
        res, err, status = _gemini_post_watch(model, payload, chunk_label="clip_classify")
        if res is not None and res.ok:
            try:
                data = res.json()
                raw = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
                if not isinstance(raw, dict):
                    return None
                u = data.get("usageMetadata") or {}
                usd = estimate_gemini_usd(
                    int(u.get("promptTokenCount") or 0),
                    int(u.get("candidatesTokenCount") or 0),
                    model,
                )
                ms = int((time.time() - t0) * 1000)
                decision_log(
                    "clip_classify",
                    "result",
                    main=raw.get("main_picture"),
                    gui=raw.get("game_graphics_visible"),
                    ct=raw.get("clip_type"),
                    conf=raw.get("confidence"),
                    ms=ms,
                    usd=round(usd, 6),
                )
                raw["_usd"] = usd
                raw["_tokens"] = {
                    "in": int(u.get("promptTokenCount") or 0),
                    "out": int(u.get("candidatesTokenCount") or 0),
                }
                from clips_worker.t6_scenes import normalize_scene_map

                raw["scenes"] = normalize_scene_map(raw.get("scenes"), dur)
                raw["_duration_s"] = round(dur, 3)
                return raw
            except Exception as exc:
                last_err = str(exc)[:120]
        else:
            last_err = str(err or status)[:120]
        if status not in (429, 500, 502, 503, 504, 408, None) and attempt == 0:
            break
    if last_err:
        decision_log("clip_classify", "failed", error=last_err[:180])
    return None


def _scene_map_says_show(cls: dict) -> bool:
    """T6.7: the scene map's longest scene is a studio/desk layout (hosts on cams, a webcam
    over a screen), not someone filmed out in the world."""
    from clips_worker.t6_scenes import dominant_scene

    scenes = cls.get("scenes") if isinstance(cls, dict) else None
    dom = dominant_scene(scenes) if isinstance(scenes, list) else None
    return bool(dom and dom.get("layout") in ("multi_cam", "webcam_screen", "full_cam_person"))


def resolve_type_from_classification(
    cls: dict | None,
    *,
    facecam_conf: float,
    picker_moment: dict | None,
    fallback: str,
) -> tuple[str, float, str]:
    from clips_worker.clip_type import content_type_from_picker_moment

    picker_type = content_type_from_picker_moment(picker_moment, None)
    if picker_type == "other":
        picker_type = fallback if fallback != "other" else "irl"
    if not isinstance(cls, dict):
        return picker_type, 0.4, "picker"
    try:
        conf = float(cls.get("confidence") or 0)
    except (TypeError, ValueError):
        conf = 0.0
    if conf < 0.55:
        return picker_type, 0.4, "picker"

    main = str(cls.get("main_picture") or "").strip().lower()
    gui = bool(cls.get("game_graphics_visible"))
    sport = bool(cls.get("sport_or_physical_activity"))
    seated = bool(cls.get("seated_talking_to_camera"))
    try:
        people = int(cls.get("people_on_camera") or 0)
    except (TypeError, ValueError):
        people = 0
    model_ct = str(cls.get("clip_type") or "").strip().lower()

    if main == "video_game" or (gui and main != "real_camera"):
        return "gaming", conf, "classify"
    if main == "real_camera":
        if sport:
            return "irl", conf, "classify"
        if seated and people >= 1:
            return ("podcast" if people >= 2 else "just_chatting"), conf, "classify"
        if model_ct in ("podcast", "just_chatting") and (_scene_map_says_show(cls) or float(facecam_conf or 0) >= 0.85):
            # T6.7: a studio show playing filmed footage (Dropped Frames: host webcams in a
            # broadcast overlay + an interview video). The main picture is real camera, but a
            # confirmed overlay webcam means it is a show, not someone out IRL. Trust the model.
            return model_ct, conf, "classify"
        return "irl", conf, "classify"
    if main == "desktop_or_browser":
        return "just_chatting", conf, "classify"
    if main == "mixed":
        if gui and float(facecam_conf or 0) >= 0.85:
            return "gaming", conf, "classify"
        ct = model_ct if model_ct in ("gaming", "irl", "just_chatting", "podcast") else picker_type
        if ct == "gaming" and not gui:
            ct = "irl"
        return ct, conf, "classify"
    ct = model_ct if model_ct in ("gaming", "irl", "just_chatting", "podcast") else picker_type
    return ct, conf, "classify"
