"""T6.7: per-clip scene map from the close look (clip_classify) -> template + crop per scene.

John: CV face tracking alone varies too much (pumpkin faces, faces appearing/disappearing in
one clip). The model that already looks at the picked clip now also returns a scene map:

    scenes: [{start_s, end_s, layout, n_cams, real_person_boxes, facecam_box, content_box}]

and that map is authoritative for layout. CV only *refines* inside the boxes the model gave:
YuNet snaps a person box to the real face inside it (ignored outside every AI box), the
rectangle detector snaps the facecam box to the webcam's real border. Segments shorter than
``MIN_SCENE_S`` are merged into a neighbour. ``irl_world`` and ``no_person`` scenes always
render whole-frame. The static-face filter (t6_cv._is_static_face) stays as a backstop: a
"person" whose YuNet face never moves is dropped.

Pure helpers + one CV function; the renderer (edits_render) and the editor (scenes.ts) read
``layout.template.segments`` + ``aiMeta.signals.scenes``.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

SCENES_VERSION = 1
SCENE_LAYOUTS = ("webcam_game", "webcam_screen", "full_cam_person", "multi_cam", "irl_world", "no_person")
WHOLE_FRAME_LAYOUTS = ("irl_world", "no_person")
#: product rule from John ("merge segments shorter than about 2s"); not fitted on any video.
MIN_SCENE_S = 2.0
#: at most this many scenes per clip (model output is capped too).
MAX_SCENES = 6
#: a person box is grown by this fraction before YuNet faces are matched to it.
REFINE_PAD = 0.15
#: AI facecam box -> CV rectangle snap needs this IoU (backstop only).
FACECAM_SNAP_IOU = 0.5
#: an AI-confirmed facecam gets this confidence (>= FACECAM_CONFIRMED 0.85 in the picker).
AI_FACECAM_CONF = 0.9

WHOLE_FRAME_TEMPLATES = {
    "gaming": ("G4",),
    "irl": ("I1", "I2", "I3", "I4"),
    "just_chatting": ("C6",),
    "podcast": ("C6",),
}
#: templates that show the structure that DEFINES the scene layout; tried first.
SCENE_PRIMARY = {
    "webcam_game": ("G1", "G2", "G3", "G6"),
    "webcam_screen": ("C3", "C9"),
    "full_cam_person": ("C1", "C2", "C4", "I5"),
    "multi_cam": ("C5",),  # n_cams >= 3 -> ("C8",), see pick_scene_template
}
SCENE_TEMPLATES = {
    "webcam_game": ("G1", "G2", "G3", "G6", "G4", "G5"),
    "webcam_screen": ("C3", "C9", "C1", "C2", "C4", "C6"),
    "full_cam_person": ("C1", "C2", "C4", "C6", "I5"),
    "multi_cam": ("C5", "C7", "C8", "C6", "I6"),
}


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def norm_box(raw: Any) -> dict | None:
    if not isinstance(raw, dict):
        return None
    try:
        vals = [float(raw.get(k, 0) or 0) for k in ("x", "y", "w", "h")]
    except (TypeError, ValueError):
        return None
    # Gemini often answers on its native 0-1000 grid even though the prompt asks for 0-1
    # fractions, and sometimes mixes both inside ONE box (real T6.7 validation responses, e.g.
    # {"x": 482, "y": 259, "w": 0.22, "h": 0.35}). Read each value on its own scale.
    if max(vals) > 1000.5 or min(vals) < 0:
        return None
    x, y, w, h = (_clamp01(v / 1000.0 if v > 1.5 else v) for v in vals)
    if w < 0.01 or h < 0.01:
        return None
    w, h = min(w, 1.0 - x), min(h, 1.0 - y)
    if w < 0.01 or h < 0.01:
        return None
    return {"x": round(x, 4), "y": round(y, 4), "w": round(w, 4), "h": round(h, 4)}


def _center_in(b: dict, box: dict) -> bool:
    cx, cy = b["x"] + b["w"] / 2, b["y"] + b["h"] / 2
    return box["x"] <= cx <= box["x"] + box["w"] and box["y"] <= cy <= box["y"] + box["h"]


def _layout_key(sc: dict) -> tuple:
    return (sc["layout"], int(sc.get("n_cams") or 0) if sc["layout"] == "multi_cam" else 0)


def normalize_scene_map(raw: Any, duration_s: float) -> list[dict]:
    """Validate the model's scenes, cover [0, duration] without gaps/overlaps, merge short ones.

    Returns [] when nothing usable came back (callers keep the clip-level path)."""
    dur = max(0.0, float(duration_s or 0.0))
    if not isinstance(raw, list) or dur <= 0:
        return []
    rows: list[dict] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        lay = str(r.get("layout") or "").strip().lower().replace("+", "_").replace(" ", "_")
        lay = {"webcam_react": "webcam_screen", "react": "webcam_screen", "person": "full_cam_person"}.get(lay, lay)
        if lay not in SCENE_LAYOUTS:
            continue
        try:
            s = max(0.0, min(dur, float(r.get("start_s"))))
            e = max(0.0, min(dur, float(r.get("end_s"))))
        except (TypeError, ValueError):
            continue
        if e - s <= 0.05:
            continue
        people = [b for b in (norm_box(b) for b in (r.get("real_person_boxes") or [])) if b][:4]
        n = int(r.get("n_cams") or 0) if str(r.get("n_cams") or "").lstrip("-").isdigit() else 0
        if lay == "multi_cam":
            n = max(2, n or len(people) or 2)
        facecam = norm_box(r.get("facecam_box")) if lay in ("webcam_game", "webcam_screen") else None
        if lay in ("webcam_game", "webcam_screen"):
            # John's rule: a webcam slot counts only if a live person is visible in it.
            if facecam and not any(_center_in(b, facecam) for b in people):
                facecam = None
            if not people:
                lay = "no_person"  # dark/empty slot: game or screen only
        rows.append(
            {
                "start_s": s,
                "end_s": e,
                "layout": lay,
                "n_cams": n,
                "real_person_boxes": [] if lay == "no_person" else people,
                "facecam_box": facecam,
                "content_box": norm_box(r.get("content_box")) if lay in ("webcam_screen",) else None,
            }
        )
    if not rows:
        return []
    rows.sort(key=lambda x: (x["start_s"], x["end_s"]))
    # Cover the timeline: first starts at 0, each starts where the previous ends, last ends at dur.
    out: list[dict] = []
    for r in rows:
        if out and r["start_s"] < out[-1]["end_s"]:
            r = {**r, "start_s": out[-1]["end_s"]}
            if r["end_s"] - r["start_s"] <= 0.05:
                continue
        if out and r["start_s"] > out[-1]["end_s"]:
            out[-1]["end_s"] = r["start_s"]  # gap -> previous scene continues
        out.append(dict(r))
    out[0]["start_s"] = 0.0
    out[-1]["end_s"] = dur
    out = _merge_same(out)
    # Merge scenes shorter than MIN_SCENE_S into the longer neighbour (shortest first).
    while len(out) > 1:
        i = min(range(len(out)), key=lambda k: out[k]["end_s"] - out[k]["start_s"])
        if out[i]["end_s"] - out[i]["start_s"] >= MIN_SCENE_S:
            break
        if i == 0:
            j = 1
        elif i == len(out) - 1:
            j = i - 1
        else:
            lj, rj = out[i - 1], out[i + 1]
            j = i - 1 if (lj["end_s"] - lj["start_s"]) >= (rj["end_s"] - rj["start_s"]) else i + 1
        keep, drop = out[j], out[i]
        keep["start_s"], keep["end_s"] = min(keep["start_s"], drop["start_s"]), max(keep["end_s"], drop["end_s"])
        del out[i]
        out = _merge_same(out)
    while len(out) > MAX_SCENES:
        i = min(range(len(out)), key=lambda k: out[k]["end_s"] - out[k]["start_s"])
        j = i - 1 if i > 0 else 1
        out[j]["start_s"], out[j]["end_s"] = min(out[j]["start_s"], out[i]["start_s"]), max(out[j]["end_s"], out[i]["end_s"])
        del out[i]
        out = _merge_same(out)
    for r in out:
        r["start_s"], r["end_s"] = round(r["start_s"], 3), round(r["end_s"], 3)
    return out


def _merge_same(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for r in rows:
        if out and _layout_key(out[-1]) == _layout_key(r):
            prev = out[-1]
            # keep the longer scene's boxes
            if (r["end_s"] - r["start_s"]) > (prev["end_s"] - prev["start_s"]):
                keep = {**r, "start_s": prev["start_s"]}
            else:
                keep = {**prev, "end_s": r["end_s"]}
            out[-1] = keep
        else:
            out.append(r)
    return out


def dominant_scene(scenes: list[dict]) -> dict | None:
    if not scenes:
        return None
    return max(scenes, key=lambda s: (float(s["end_s"]) - float(s["start_s"]), -float(s["start_s"])))


# ----------------------------------------------------------------- CV refinement (backstop)
def _iou(a: dict, b: dict) -> float:
    ax1, ay1 = a["x"] + a["w"], a["y"] + a["h"]
    bx1, by1 = b["x"] + b["w"], b["y"] + b["h"]
    iw = max(0.0, min(ax1, bx1) - max(a["x"], b["x"]))
    ih = max(0.0, min(ay1, by1) - max(a["y"], b["y"]))
    inter = iw * ih
    u = a["w"] * a["h"] + b["w"] * b["h"] - inter
    return inter / u if u > 0 else 0.0


def _grow(b: dict, pad: float) -> dict:
    px, py = b["w"] * pad, b["h"] * pad
    x, y = max(0.0, b["x"] - px), max(0.0, b["y"] - py)
    return {"x": x, "y": y, "w": min(1.0 - x, b["w"] + 2 * px), "h": min(1.0 - y, b["h"] + 2 * py)}


def _inside(d: tuple, box: dict) -> bool:
    cx, cy = d[1] + d[3] / 2, d[2] + d[4] / 2
    return box["x"] <= cx <= box["x"] + box["w"] and box["y"] <= cy <= box["y"] + box["h"]


def sample_face_dets(clip_file, start_s: float, end_s: float, n: int = 6) -> list[tuple] | None:
    """YuNet detections (sample_idx, x, y, w, h, score) at ``n`` times in [start_s, end_s]."""
    from clips_worker import t6_cv

    cv2, np = t6_cv.cv2, t6_cv.np
    model = t6_cv._yunet_path()
    if cv2 is None or model is None or clip_file is None or not Path(clip_file).is_file():
        return None
    cap = cv2.VideoCapture(str(clip_file))
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0) or 30.0
        sw, sh = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        if sw <= 0 or sh <= 0:
            return None
        aw, ah = 640, max(2, int(round(sh * 640 / sw)))
        det = cv2.FaceDetectorYN_create(str(model), "", (aw, ah), 0.6, 0.3, 50)
        span = max(0.1, end_s - start_s)
        out: list[tuple] = []
        for si, t in enumerate(np.linspace(start_s + 0.08 * span, end_s - 0.08 * span, max(1, n))):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
            ok, fr = cap.read()
            if not ok or fr is None:
                continue
            _, found = det.detect(cv2.resize(fr, (aw, ah), interpolation=cv2.INTER_AREA))
            for r in [] if found is None else found:
                fw, fh = float(r[2]) / aw, float(r[3]) / ah
                if fw > 0.004 and fh > 0.008:
                    out.append((si, float(r[0]) / aw, float(r[1]) / ah, fw, fh, float(r[14])))
        return out
    finally:
        cap.release()


def refine_person_box(ai_box: dict, dets: list[tuple] | None, n_samples: int) -> dict | None:
    """The real face inside the AI box: median YuNet face of detections inside it.

    - no detector / no face inside -> the AI box itself is the face (persist 1.0, source ai);
    - a face inside that never moves across samples (picture, statue, thumbnail) -> None
      (static-face backstop, t6_cv._is_static_face)."""
    from clips_worker import t6_cv

    np = t6_cv.np
    g = _grow(ai_box, REFINE_PAD)
    inside = [d for d in (dets or []) if _inside(d, g)]
    if inside:
        by_s: dict[int, tuple] = {}
        for d in sorted(inside, key=lambda d: -d[5]):
            by_s.setdefault(d[0], d)
        c = list(by_s.values())
        persist = len(c) / max(1, n_samples)
        if t6_cv._is_static_face(c, persist):
            return None
        return {
            "x": round(float(np.median([e[1] for e in c])), 4),
            "y": round(float(np.median([e[2] for e in c])), 4),
            "w": round(float(np.median([e[3] for e in c])), 4),
            "h": round(float(np.median([e[4] for e in c])), 4),
            "persist": 1.0,
            "score": round(float(np.median([e[5] for e in c])), 3),
            "source": "ai+yunet",
        }
    # AI-only: the prompt asks for a head box, so it is the face.
    return {**{k: ai_box[k] for k in ("x", "y", "w", "h")}, "persist": 1.0, "score": 0.0, "source": "ai"}


def refine_scenes(scenes: list[dict], clip_file, fc_layout: dict | None) -> list[dict]:
    """Attach ``faces`` (refined, sorted by size) and snap facecam boxes. Pure on failure."""
    out = []
    rect = None
    if isinstance(fc_layout, dict) and isinstance(fc_layout.get("facecam"), dict):
        if str(fc_layout.get("method") or "rect") != "face_box":
            rect = norm_box(fc_layout.get("facecam"))
    for sc in scenes:
        sc = dict(sc)
        n = 6
        dets = None
        if sc["real_person_boxes"] and sc["layout"] not in WHOLE_FRAME_LAYOUTS:
            try:
                dets = sample_face_dets(clip_file, sc["start_s"], sc["end_s"], n=n)
            except Exception:
                dets = None
        faces = []
        dropped = 0
        for b in sc["real_person_boxes"]:
            f = refine_person_box(b, dets, n)
            if f is None:
                dropped += 1
            else:
                faces.append(f)
        faces.sort(key=lambda f: -(f["w"] * f["h"]))
        sc["faces"] = faces
        if dropped:
            sc["static_dropped"] = dropped
        fb = sc.get("facecam_box")
        if fb and rect and _iou(fb, rect) >= FACECAM_SNAP_IOU:
            sc["facecam_box"] = rect
            sc["facecam_source"] = "ai+rect"
        elif fb:
            sc["facecam_source"] = "ai"
        out.append(sc)
    return out


# ----------------------------------------------------------------- scene -> signals / template
def scene_lane(scene: dict, clip_type: str) -> str:
    lay = scene.get("layout")
    if lay == "webcam_game":
        return "gaming"
    if lay == "irl_world":
        return "irl"
    if lay == "multi_cam":
        return "podcast"
    if lay in ("webcam_screen", "full_cam_person"):
        return "podcast" if clip_type == "podcast" and lay == "full_cam_person" else "just_chatting"
    return clip_type if clip_type in WHOLE_FRAME_TEMPLATES else "irl"


def scene_signals(base: dict, scene: dict) -> dict:
    """Clip signals with this scene's structure (what geometry/pick read)."""
    s = dict(base)
    lay = scene.get("layout")
    s["clip_type"] = scene_lane(scene, str(base.get("clip_type") or "irl"))
    s["type_conf"] = max(0.6, float(base.get("type_conf") or 0.0))
    if lay in WHOLE_FRAME_LAYOUTS:
        s["faces"] = []
        s["facecam_box"] = None
        s["facecam_conf"] = 0.0
        s["content_box"] = None
        s["person_count"] = 0 if lay == "no_person" else int(base.get("person_count") or 0)
        s.pop("gameplay_box", None)
        return s
    faces = [{k: f[k] for k in ("x", "y", "w", "h", "persist", "score") if k in f} for f in scene.get("faces") or []]
    s["faces"] = faces
    s["person_count"] = max(len(faces), int(scene.get("n_cams") or 0))
    fb = scene.get("facecam_box")
    s["facecam_box"] = fb
    s["facecam_conf"] = AI_FACECAM_CONF if fb else 0.0
    s["content_box"] = scene.get("content_box")
    if not fb:
        s.pop("gameplay_box", None)
    return s


def pick_scene_template(base: dict, scene: dict, seed: str, history: list[str]) -> tuple[str, str]:
    from clips_worker.t6_pick import pick_template

    s = scene_signals(base, scene)
    lane = s["clip_type"]
    lay = scene.get("layout")
    # John's rule: groups get the whole frame - a group seated in ONE camera (full_cam_person
    # with 2+ live people) is never cropped to one face or split into a grid.
    group_one_cam = lay == "full_cam_person" and len(scene.get("real_person_boxes") or []) >= 2
    if lay in WHOLE_FRAME_LAYOUTS or group_one_cam:
        only = WHOLE_FRAME_TEMPLATES.get(lane, ("I3",))
    else:
        primary = SCENE_PRIMARY.get(lay, ())
        if lay == "multi_cam":
            # Product rule (not fitted): one panel per LOCATED live person -> 2 = Dual Cam,
            # 3+ = Grid; fewer located faces than cams -> Stage Card (active speaker) so no
            # panel falls back to the whole frame.
            located = len(s.get("faces") or [])
            primary = ("C8",) if located >= 3 else ("C5",) if located == 2 else ("C7",)
            if located:
                s = dict(s, person_count=located)
        if primary:
            tid, why = pick_template(s, {}, history, {}, 1, seed, only=set(primary))
            if tid in primary and why == "scored":
                return tid, f"scene:{lay}:primary"
        only = SCENE_TEMPLATES.get(lay)
    tid, why = pick_template(s, {}, history, {}, 1, seed, only=set(only) if only else None)
    return tid, f"scene:{lay}:{why}"


def pick_segments(base: dict, scenes: list[dict], seed: str) -> list[dict]:
    """One template per scene; the same layout keeps the same template inside a clip."""
    segs: list[dict] = []
    by_layout: dict[tuple, str] = {}
    for i, sc in enumerate(scenes):
        key = _layout_key(sc)
        if key in by_layout:
            tid, why = by_layout[key], f"scene:{sc['layout']}:same_layout"
        else:
            sseed = f"{seed}:{i}" if i else seed
            tid, why = pick_scene_template(base, sc, sseed, [])
            by_layout[key] = tid
        lane = scene_lane(sc, str(base.get("clip_type") or "irl"))
        segs.append({"startS": sc["start_s"], "endS": sc["end_s"], "id": tid, "lane": lane, "scene": i, "reason": why})
    return segs


def segments_digest(segs: list[dict]) -> str:
    raw = "|".join(f"{s['startS']:.3f}-{s['endS']:.3f}:{s['id']}" for s in segs)
    return hashlib.sha1(raw.encode()).hexdigest()[:10]


def scene_spec_for_segment(seg: dict, signals: dict, edits: dict, *, play_w: int = 1080, play_h: int = 1920) -> dict | None:
    """Geometry of one segment: its template with its scene's signals (parity: scenes.ts)."""
    from clips_worker.t6_geometry import resolve_template_geometry
    from clips_worker.t6_registry import TEMPLATES

    scenes = signals.get("scenes") if isinstance(signals.get("scenes"), list) else []
    try:
        sc = scenes[int(seg.get("scene"))]
    except (TypeError, ValueError, IndexError):
        return None
    tdef = TEMPLATES.get(str(seg.get("id") or ""))
    if not tdef or not isinstance(sc, dict):
        return None
    layout = {k: v for k, v in dict(edits.get("layout") or {}).items() if k not in ("facecam", "cropBox")}
    layout["template"] = {"id": tdef["id"], "auto": True, "lane": seg.get("lane")}
    spec = resolve_template_geometry(tdef, scene_signals(signals, sc), {**edits, "layout": layout}, play_w=play_w, play_h=play_h)
    return {**spec, "templateId": tdef["id"]}
