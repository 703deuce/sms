"""#1214 BE-5 Documentary Director: derives the world type, style spec, scene list, emphasis words,
transitions, handoffs (footage modes a/b) and music anchors from the story; every entry has a reason.
Validated; on an invalid/missing LLM plan a deterministic plan is used (no automatic paid retry)."""
from __future__ import annotations

import hashlib
import json
import random
import re

from clips_worker.motion_studio.pipeline import config
from clips_worker.motion_studio.pipeline.llm import LLMError, chat_json

VISUAL_TYPES = ("title", "data", "map", "timeline", "photo", "document", "diagram", "quote", "abstract", "handoff")
WORLD_TYPES = ("map", "price_chart", "timeline", "evidence_board", "network", "document_desk", "abstract_field", "city_grid")
SURFACES = ("photo", "tv", "newspaper")
PALETTES = [
    {"bg": "#0d1018", "ink": "#f2f0ea", "accent": "#ffc400", "accent2": "#5ac8ff", "muted": "#7a8296"},
    {"bg": "#120c0a", "ink": "#f5ece0", "accent": "#e8452c", "accent2": "#f2b84b", "muted": "#8a7a6c"},
    {"bg": "#071412", "ink": "#e8f5ef", "accent": "#3ee6a1", "accent2": "#f5d76e", "muted": "#6d8a80"},
    {"bg": "#0e0b16", "ink": "#efeaff", "accent": "#b48cff", "accent2": "#ff7ab6", "muted": "#7d7596"},
    {"bg": "#f1ece2", "ink": "#1d1b19", "accent": "#c4302b", "accent2": "#2b5cc4", "muted": "#8d867a"},
    {"bg": "#0a1220", "ink": "#eaf2ff", "accent": "#ff8a3d", "accent2": "#4dd2ff", "muted": "#6f7f99"},
]


def _hex(s: str) -> bool:
    return bool(re.fullmatch(r"#[0-9a-fA-F]{6}", str(s or "")))


def style_distance(a: dict, b: dict) -> float:
    """ST-STY distance check: palette distance in RGB (0..1)."""
    def rgb(h):
        return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
    ks = ("bg", "accent", "accent2")
    d = 0.0
    for k in ks:
        x, y = rgb(a["palette"][k]), rgb(b["palette"][k])
        d += sum(abs(p - q) for p, q in zip(x, y)) / (3 * 255)
    return round(d / len(ks), 3)


def _seed(project: dict, story: dict) -> int:
    return int(hashlib.sha256((project["id"] + json.dumps([l["text"] for l in story["lines"]])).encode()).hexdigest()[:8], 16)


def fallback_plan(project: dict, story: dict, catalog: list[dict]) -> dict:
    r = random.Random(_seed(project, story))
    pal = dict(r.choice(PALETTES))
    lines = story["lines"]
    videos = [a for a in catalog if a["kind"] == "video" and (a.get("durationMs") or 0) > 2000]
    photos = [a for a in catalog if a["kind"] == "image"]
    scenes, cur = [], []
    vi = 0
    for i, l in enumerate(lines):
        cur.append(l)
        chapter_end = i + 1 >= len(lines) or lines[i + 1]["chapter"] != l["chapter"]
        if len(cur) >= 3 or chapter_end:
            vt = "data" if any(re.search(r"\d", x["text"]) for x in cur) else ("photo" if photos and r.random() < 0.4 else "abstract")
            if not scenes:
                vt = "title"
            scenes.append({"kind": "graphics", "visualType": vt, "lineIds": [x["id"] for x in cur],
                           "description": " / ".join(x["hero"] or x["text"][:40] for x in cur),
                           "emphasis": [{"lineId": x["id"], "word": (x["hero"] or "").split()[0]} for x in cur if x.get("hero")],
                           "reason": "deterministic plan: groups of up to 3 lines within a chapter", "transitionOut": "camera_move"})
            cur = []
            if chapter_end and vi < len(videos) and i + 1 < len(lines):
                v = videos[vi]
                vi += 1
                dur = min(8.0, (v.get("durationMs") or 6000) / 1000 - 0.5)
                scenes.append({"kind": "handoff", "visualType": "handoff", "lineIds": [],
                               "description": f"uploaded clip {v.get('filename')}",
                               "handoff": {"assetId": v["id"], "inS": 0.0, "outS": round(max(2.0, dur), 2),
                                           "surface": SURFACES[vi % 3], "exitStyle": "mirror" if vi % 2 else "asymmetric",
                                           "audioMode": "clip", "exitReason": "alternate exits for variety"},
                               "reason": "chapter break: let the uploaded footage breathe", "transitionOut": "handoff"})
    for k, s in enumerate(scenes):
        s["index"] = k
    blob = " ".join(l["text"] for l in lines)
    if story.get("data") or re.search(r"\b(price|stock|market|percent|squeeze|share|trade)\b", blob, re.I):
        world, why = "price_chart", "deterministic: the story is told through figures and a market or count"
    elif re.search(r"\b(city|country|border|route|island|river|map|chicago|borough|street)\b", blob, re.I):
        world, why = "map", "deterministic: the story is rooted in a place"
    elif re.search(r"\b(trial|hearing|evidence|investigation|court|exhibit)\b", blob, re.I):
        world, why = "evidence_board", "deterministic: the story is an investigation"
    elif re.search(r"\b(19\d{2}|20\d{2}|decade|timeline|years later|in the spring)\b", blob, re.I):
        world, why = "timeline", "deterministic: the story is a chronology"
    elif re.search(r"\b(letter|contract|memo|document|filing)\b", blob, re.I):
        world, why = "document_desk", "deterministic: the story lives in documents"
    else:
        world, why = "abstract_field", "deterministic: no stronger world cue; invent a field the camera can travel"
    world_vt = {"map": "map", "price_chart": "data", "timeline": "timeline", "evidence_board": "document",
                "network": "diagram", "document_desk": "document", "city_grid": "map"}.get(world, "abstract")
    for s in scenes:
        if s.get("visualType") == "title" or s.get("kind") != "graphics":
            continue
        if s.get("visualType") in ("photo",) and photos:
            continue
        if world_vt == "data" and s.get("visualType") == "data":
            continue
        s["visualType"] = world_vt
        s["reason"] = f"{s['reason']}; world is {world}, so this scene is a {world_vt}"
    return {"world": {"type": world, "reason": why},
            "style": {"palette": pal, "mood": story.get("tone") or "curious", "grain": 0.06, "glow": 0.35, "vignette": 0.35,
                      "fonts": {"display": "cond", "label": "label", "body": "serif"}, "reason": "seeded from project + script"},
            "scenes": scenes, "musicAnchors": _default_anchors(lines), "deliberateMinimal": [], "source": "fallback"}


def _default_anchors(lines: list[dict]) -> dict:
    n = len(lines)
    pick = lambda f: {"lineId": lines[min(n - 1, int(n * f))]["id"], "word": None} if n else None  # noqa: E731
    return {"pulse": pick(0.15), "build": pick(0.4), "peak": pick(0.7), "resolve": pick(0.9)}


def validate_plan(plan: dict, story: dict, catalog: list[dict]) -> list[str]:
    errs = []
    ids = [l["id"] for l in story["lines"]]
    covered = [lid for s in plan.get("scenes", []) for lid in s.get("lineIds", [])]
    if covered != ids:
        errs.append("scenes must cover every line exactly once, in order")
    pal = (plan.get("style") or {}).get("palette") or {}
    if not all(_hex(pal.get(k)) for k in ("bg", "ink", "accent", "accent2", "muted")):
        errs.append("style.palette needs bg/ink/accent/accent2/muted hex colours")
    assets = {a["id"]: a for a in catalog}
    for s in plan.get("scenes", []):
        if not s.get("reason"):
            errs.append(f"scene {s.get('index')} has no reason")
        if s.get("kind") in ("handoff", "hardcut"):
            h = s.get("handoff") or {}
            a = assets.get(h.get("assetId"))
            if not a or a["kind"] != "video":
                errs.append(f"scene {s.get('index')} handoff references a missing video asset")
            if s["kind"] == "hardcut" and not h.get("cutJustification"):
                errs.append(f"scene {s.get('index')} hard cut needs a justification")
            if h.get("surface") not in SURFACES:
                h["surface"] = "photo"
        elif s.get("visualType") not in VISUAL_TYPES:
            s["visualType"] = "abstract"
    return errs


def direct(project: dict, story: dict, catalog: list[dict], log) -> dict:
    settings = project.get("settings") or {}
    cat = [{"assetId": a["id"], "kind": a["kind"], "filename": a.get("filename"), "durationMs": a.get("durationMs"),
            "summary": (a.get("analysis") or {}).get("summary"), "moments": ((a.get("analysis") or {}).get("moments") or [])[:12]}
           for a in catalog]
    plan = None
    if not config.mock():
        sys_ = (
            "You are the Documentary Director for a cinematic motion-graphics documentary (Cinematic Skill engine: a 4K world "
            "canvas, a moving camera, word-synced graphics). Invent ONE world for this topic — the camera travels through it "
            "for the whole film. A map for a place-rooted story or a price chart for a market story are examples of the idea, "
            "not templates to reuse: invent the world this subject needs. Type and numbers must land on the spoken word. "
            "Graphics scenes live inside that world (visualType should match it: map→map, price_chart→data, timeline→timeline). "
            "Footage uses a RETURN handoff by default; hard cuts need a justification. From the story's SUBJECT and STRUCTURE derive: the world type "
            f"(one of {list(WORLD_TYPES)}), a per-video style spec, and the scene list. Rules: scenes cover every line id exactly "
            "once in order (group 1-4 lines, ~6-15 s each); each scene has visualType "
            f"{list(VISUAL_TYPES)}, a one-sentence description of what the frame shows (3 layers: procedural background, "
            "midground context, foreground hero), emphasis words that are literally in the line, a reason, and transitionOut. "
            "Uploaded videos may be used as handoff scenes (kind 'handoff', lineIds may be empty for clip-audio moments): "
            "handoff {assetId, inS, outS, surface: photo|tv|newspaper, exitStyle: mirror|asymmetric, exitReason, "
            "audioMode: clip (footage sound, narration pauses) | bed (narration continues over it)}. Hard cuts (kind 'hardcut') need "
            "cutJustification. musicAnchors: {pulse, build, peak, crash (optional), resolve} each {lineId, word}. Palette must be "
            "distinct and fit the subject. Return JSON {world:{type,reason}, style:{palette:{bg,ink,accent,accent2,muted}, mood, "
            "grain, glow, vignette, reason}, scenes:[...], musicAnchors:{...}, deliberateMinimal:[{index, reason}]}.")
        user = json.dumps({"title": story.get("title"), "tone": story.get("tone"), "aspect": settings.get("aspect", "16:9"),
                           "visualDirection": settings.get("visualDirection"), "lines": [{k: l[k] for k in ("id", "chapter", "text", "hero")} for l in story["lines"]],
                           "data": story.get("data"), "uploads": cat})
        try:
            plan, m = chat_json("director", sys_, user, max_tokens=12000)
            log("model_call", "director plan", m)
            for k, s in enumerate(plan.get("scenes") or []):
                s["index"] = k
                s.setdefault("kind", "graphics")
                s["lineIds"] = [str(x) for x in s.get("lineIds") or []]
            errs = validate_plan(plan, story, catalog)
            if errs:
                log("plan_invalid", "director plan failed validation; using the deterministic plan", {"errors": errs[:8]})
                plan = None
            else:
                plan["source"] = "model"
        except LLMError as exc:
            log("model_call_failed", f"director fell back to the deterministic plan: {exc}", {"step": "director"})
            plan = None
    if plan is None:
        plan = fallback_plan(project, story, catalog)
        validate_plan(plan, story, catalog)
    m = settings.get("musicSource") or settings.get("music") or "generated"
    plan["musicSource"] = {"upload": "user", "user": "user", "none": "none", "elevenlabs": "elevenlabs"}.get(m, "generated")
    log("plan_world", f"world: {plan['world'].get('type')} — {plan['world'].get('reason', '')}", plan["world"])
    log("plan_style", f"style: {plan['style'].get('mood')} — {plan['style'].get('reason', '')}", {"palette": plan["style"]["palette"]})
    for s in plan["scenes"]:
        log("plan_scene", f"scene {s['index'] + 1}: {s.get('visualType')} — {s.get('reason', '')}",
            {"index": s["index"], "kind": s["kind"], "visualType": s.get("visualType"), "lineIds": s.get("lineIds")})
    return plan
