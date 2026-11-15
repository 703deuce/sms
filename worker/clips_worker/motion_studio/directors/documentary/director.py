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



_STOP = {"the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "from",
         "that", "this", "it", "is", "was", "were", "be", "as", "by", "at", "its",
         "their", "they", "you", "we", "but", "not", "are", "had", "has", "have"}


def _asset_blob(asset: dict) -> str:
    an = asset.get("analysis") or {}
    tags = an.get("tags") or []
    text = an.get("onScreenText") or []
    if isinstance(tags, str):
        tags = [tags]
    if isinstance(text, str):
        text = [text]
    return " ".join([
        str(asset.get("filename") or ""),
        str(an.get("summary") or an.get("description") or ""),
        " ".join(str(x) for x in tags),
        " ".join(str(x) for x in text),
    ]).lower()


def is_mark_asset(asset: dict) -> bool:
    """True for a logo, wordmark, brand mark, or lockup — generic, not title-specific."""
    return bool(re.search(r"\b(logo|wordmark|word-mark|brand[\s-]?mark|lockup|logotype)\b", _asset_blob(asset)))


def _token_overlap(asset: dict, text: str) -> float:
    blob = _asset_blob(asset)
    words = [w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(w) > 3 and w not in _STOP]
    if not words:
        return 0.0
    return float(sum(1 for w in words if w in blob))


def _scene_text(scene: dict, lines_by_id: dict) -> str:
    parts = [scene.get("description") or "", scene.get("reason") or ""]
    for lid in scene.get("lineIds") or []:
        ln = lines_by_id.get(lid) or {}
        parts.append(ln.get("text") or "")
        parts.append(ln.get("hero") or "")
    return " ".join(parts)


def _world_from_story(story: dict) -> dict:
    """Invent a brief from the story — a starting point, not a type the director must pick."""
    title = (story.get("title") or "this story").strip() or "this story"
    blob = " ".join(l.get("text") or "" for l in story.get("lines") or [])
    if story.get("data") or re.search(r"\b(price|stock|market|percent|squeeze|share|trade)\b", blob, re.I):
        brief = (f"A data-driven environment for {title}: the figures and counts in the script "
                 "are the landscape the camera travels.")
        reason = "deterministic: the story is told through figures"
    elif re.search(r"\b(city|country|border|route|island|river|map|borough|street)\b", blob, re.I):
        brief = (f"A place-rooted environment for {title}: the locations named in the script "
                 "are clusters the camera travels between.")
        reason = "deterministic: the story is rooted in a place"
    elif re.search(r"\b(trial|hearing|evidence|investigation|court|exhibit)\b", blob, re.I):
        brief = (f"An investigative environment for {title}: documents, exhibits and connections "
                 "are laid out as a field the camera can inspect.")
        reason = "deterministic: the story is an investigation"
    elif re.search(r"\b(19\d{2}|20\d{2}|decade|timeline|years later|in the spring)\b", blob, re.I):
        brief = (f"A chronological environment for {title}: eras and dates in the script are "
                 "stations along one continuous path.")
        reason = "deterministic: the story is a chronology"
    elif re.search(r"\b(letter|contract|memo|document|filing)\b", blob, re.I):
        brief = (f"A document-led environment for {title}: papers and filings named in the script "
                 "are the surfaces the camera studies.")
        reason = "deterministic: the story lives in documents"
    else:
        brief = (f"A purpose-built environment for {title}, invented from the story — not a stock "
                 "grid, map, or chart template.")
        reason = "deterministic: invent a field the camera can travel from the story itself"
    return {"name": title, "brief": brief, "reason": reason}


def _assign_stills(scenes: list[dict], catalog: list[dict], story: dict) -> list[dict]:
    """Give every still a unique official scene. Prefer marks for the title or end card."""
    photos = [a for a in catalog if a.get("kind") == "image"]
    if not photos:
        return []
    lines_by_id = {l["id"]: l for l in story.get("lines") or []}
    # Honour existing official assignments so a second pass (Production Designer) does not re-place stills.
    used: set[str] = {s["assetId"] for s in scenes if s.get("assetId")}
    placements: list[dict] = [
        {"sceneIndex": s.get("index"), "assetId": s["assetId"],
         "reason": s.get("reason") or "already assigned", "reuseReason": s.get("reuseReason")}
        for s in scenes if s.get("assetId")
    ]

    def bind(scene: dict, asset: dict, why: str) -> None:
        if scene.get("assetId") and scene.get("assetId") != asset["id"]:
            return
        if asset["id"] in used and scene.get("assetId") != asset["id"]:
            return
        scene["assetId"] = asset["id"]
        if scene.get("visualType") not in ("title", "photo", "handoff"):
            scene["visualType"] = "photo"
            scene["kind"] = scene.get("kind") or "graphics"
        scene["reason"] = f"{scene.get('reason') or 'assigned still'}; {why}"
        used.add(asset["id"])
        placements.append({"sceneIndex": scene.get("index"), "assetId": asset["id"], "reason": why})

    def reindex() -> None:
        for k, s in enumerate(scenes):
            s["index"] = k
        by_asset = {s.get("assetId"): s.get("index") for s in scenes if s.get("assetId")}
        for pl in placements:
            if pl.get("assetId") in by_asset:
                pl["sceneIndex"] = by_asset[pl["assetId"]]

    graphics = [s for s in scenes if s.get("kind") not in ("handoff", "hardcut")]
    title = next((s for s in graphics if s.get("visualType") == "title"), graphics[0] if graphics else None)
    end = graphics[-1] if graphics else None
    for asset in photos:
        if not is_mark_asset(asset):
            continue
        slot = title if title and not title.get("assetId") else None
        if slot is None:
            slot = end if end and not end.get("assetId") else None
        if slot is None:
            slot = next((s for s in reversed(graphics) if not s.get("assetId")), None)
        if slot:
            bind(slot, asset, "mark or wordmark reserved for the title or end card")

    leftover = [a for a in photos if a["id"] not in used]
    open_scenes = [s for s in graphics if not s.get("assetId")]
    scored = []
    for asset in leftover:
        for scene in open_scenes:
            scored.append((_token_overlap(asset, _scene_text(scene, lines_by_id)), asset["id"], scene.get("index")))
    scored.sort(key=lambda x: (-x[0], x[1], x[2] if x[2] is not None else 0))
    taken_scenes, taken_assets = set(), set()
    by_id = {a["id"]: a for a in leftover}
    by_idx = {s.get("index"): s for s in open_scenes}
    for score, aid, idx in scored:
        if score <= 0 or aid in taken_assets or idx in taken_scenes:
            continue
        bind(by_idx[idx], by_id[aid], "best keyword overlap with the scene's narration")
        taken_scenes.add(idx)
        taken_assets.add(aid)

    still_open = [s for s in graphics if not s.get("assetId")]
    still_left = [a for a in leftover if a["id"] not in used]
    for asset, scene in zip(still_left, still_open):
        bind(scene, asset, "unused still given the next open graphics scene so every upload appears")

    still_left = [a for a in leftover if a["id"] not in used]
    if still_left:
        extras = []
        for asset in still_left:
            extras.append({
                "kind": "graphics", "visualType": "photo", "lineIds": [],
                "description": f"uploaded still {asset.get('filename') or asset['id']}",
                "emphasis": [], "transitionOut": "camera_move",
                "reason": "every upload must appear; this still had no open scene",
                "assetId": asset["id"],
            })
            used.add(asset["id"])
            placements.append({"assetId": asset["id"], "reason": "every upload must appear; this still had no open scene"})
        # Keep a mark on a trailing end card; insert extras just before it.
        last = scenes[-1] if scenes else None
        last_asset = next((a for a in photos if last and a["id"] == last.get("assetId")), None)
        if last and last.get("kind") not in ("handoff", "hardcut") and last_asset and is_mark_asset(last_asset) and len(scenes) > 1:
            scenes[len(scenes) - 1:len(scenes) - 1] = extras
        else:
            scenes.extend(extras)
    reindex()
    return placements


def fallback_plan(project: dict, story: dict, catalog: list[dict]) -> dict:
    r = random.Random(_seed(project, story))
    pal = dict(r.choice(PALETTES))
    lines = story["lines"]
    videos = [a for a in catalog if a.get("kind") == "video" and (a.get("durationMs") or 0) > 2000]
    photos = [a for a in catalog if a.get("kind") == "image"]
    scenes, cur = [], []
    vi = 0
    for i, l in enumerate(lines):
        cur.append(l)
        chapter_end = i + 1 >= len(lines) or lines[i + 1]["chapter"] != l["chapter"]
        if len(cur) >= 3 or chapter_end:
            vt = "data" if any(re.search(r"\d", x["text"]) for x in cur) else (
                "photo" if photos and r.random() < 0.4 else "abstract")
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
                dur = max(2.0, (v.get("durationMs") or 2000) / 1000.0)
                scenes.append({"kind": "handoff", "visualType": "handoff", "lineIds": [],
                               "description": f"uploaded clip {v.get('filename')}",
                               "handoff": {"assetId": v["id"], "inS": 0.0, "outS": round(dur, 3),
                                           "surface": SURFACES[vi % 3], "exitStyle": "mirror" if vi % 2 else "asymmetric",
                                           "audioMode": "clip", "exitReason": "alternate exits for variety"},
                               "reason": "chapter break: play the uploaded footage in full, narration paused",
                               "transitionOut": "handoff"})
    # Any remaining clips still get a full-length handoff at the end (before a trailing end card).
    while vi < len(videos):
        v = videos[vi]
        vi += 1
        dur = max(2.0, (v.get("durationMs") or 2000) / 1000.0)
        scenes.append({"kind": "handoff", "visualType": "handoff", "lineIds": [],
                       "description": f"uploaded clip {v.get('filename')}",
                       "handoff": {"assetId": v["id"], "inS": 0.0, "outS": round(dur, 3),
                                   "surface": SURFACES[vi % 3], "exitStyle": "mirror" if vi % 2 else "asymmetric",
                                   "audioMode": "clip", "exitReason": "remaining clip plays in full"},
                       "reason": "every uploaded clip must appear, played in full with narration paused",
                       "transitionOut": "handoff"})
    for k, s in enumerate(scenes):
        s["index"] = k
    # Do not overwrite visualType to fit a world menu — keep title/data/photo/abstract as grouped.
    placements = _assign_stills(scenes, catalog, story)
    world = _world_from_story(story)
    blueprint = {
        "assetPlacements": placements,
        "handoffs": [
            {"sceneIndex": s.get("index"), "assetId": (s.get("handoff") or {}).get("assetId"),
             "inS": (s.get("handoff") or {}).get("inS"), "outS": (s.get("handoff") or {}).get("outS")}
            for s in scenes if s.get("kind") in ("handoff", "hardcut")
        ],
        "sceneBindings": [{"sceneIndex": s.get("index"), "visualType": s.get("visualType"),
                           "assetId": s.get("assetId") or (s.get("handoff") or {}).get("assetId")}
                          for s in scenes],
    }
    return {"world": world,
            "style": {"palette": pal, "mood": story.get("tone") or "curious", "grain": 0.06, "glow": 0.35, "vignette": 0.35,
                      "fonts": {"display": "cond", "label": "label", "body": "serif"}, "reason": "seeded from project + script"},
            "scenes": scenes, "blueprint": blueprint, "musicAnchors": _default_anchors(lines),
            "deliberateMinimal": [], "source": "fallback"}


def _default_anchors(lines: list[dict]) -> dict:
    n = len(lines)
    pick = lambda f: {"lineId": lines[min(n - 1, int(n * f))]["id"], "word": None} if n else None  # noqa: E731
    return {"pulse": pick(0.15), "build": pick(0.4), "peak": pick(0.7), "resolve": pick(0.9)}



def _normalize_emphasis(scene: dict) -> None:
    """Coerce emphasis to [{lineId, word}]. The model often returns a list of bare words."""
    raw = scene.get("emphasis") or []
    lids = [str(x) for x in (scene.get("lineIds") or [])]
    out = []
    for e in raw:
        if isinstance(e, str) and e.strip():
            out.append({"lineId": lids[0] if lids else None, "word": e.strip()})
        elif isinstance(e, dict):
            word = e.get("word") or e.get("text") or e.get("w") or ""
            if not str(word).strip():
                continue
            lid = e.get("lineId") or e.get("line") or (lids[0] if lids else None)
            out.append({"lineId": str(lid) if lid else None, "word": str(word).strip()})
    scene["emphasis"] = out


def _move_clip_handoff_lines(plan: dict) -> None:
    """Clip-mode handoffs pause narration; move any attached lines to the previous graphics scene."""
    scenes = plan.get("scenes") or []
    for i, s in enumerate(scenes):
        if s.get("kind") not in ("handoff", "hardcut"):
            continue
        h = s.get("handoff") or {}
        mode = h.get("audioMode") or "clip"
        lids = list(s.get("lineIds") or [])
        if mode == "bed" or not lids:
            continue
        prev = next((scenes[j] for j in range(i - 1, -1, -1) if scenes[j].get("kind") not in ("handoff", "hardcut")), None)
        if prev is None:
            continue
        prev["lineIds"] = list(prev.get("lineIds") or []) + lids
        s["lineIds"] = []


def validate_plan(plan: dict, story: dict, catalog: list[dict]) -> list[str]:
    errs = []
    _move_clip_handoff_lines(plan)
    ids = [l["id"] for l in story["lines"]]
    covered = [lid for s in plan.get("scenes", []) for lid in s.get("lineIds", [])]
    if covered != ids:
        errs.append("scenes must cover every line exactly once, in order")
    pal = (plan.get("style") or {}).get("palette") or {}
    if not all(_hex(pal.get(k)) for k in ("bg", "ink", "accent", "accent2", "muted")):
        errs.append("style.palette needs bg/ink/accent/accent2/muted hex colours")
    assets = {a["id"]: a for a in catalog}
    still_counts: dict[str, int] = {}
    assigned: set[str] = set()
    for s in plan.get("scenes", []):
        _normalize_emphasis(s)
        if not s.get("reason"):
            errs.append(f"scene {s.get('index')} has no reason")
        if s.get("kind") in ("handoff", "hardcut"):
            h = s.setdefault("handoff", {})
            a = assets.get(h.get("assetId"))
            if not a or a.get("kind") != "video":
                errs.append(f"scene {s.get('index')} handoff references a missing video asset")
            else:
                assigned.add(a["id"])
                dur = max(0.0, (a.get("durationMs") or 0) / 1000.0)
                if h.get("inS") is None:
                    h["inS"] = 0.0
                if h.get("outS") is None or float(h.get("outS") or 0) <= float(h.get("inS") or 0):
                    h["outS"] = round(dur or 2.0, 3)
                if float(h["outS"]) - float(h["inS"]) < 1.0:
                    errs.append(f"scene {s.get('index')} clip stretch is shorter than one second")
            if (h.get("audioMode") or "clip") not in ("clip", "bed", "mute"):
                h["audioMode"] = "clip"
            h.setdefault("audioMode", "clip")
            if s["kind"] == "hardcut" and not h.get("cutJustification"):
                errs.append(f"scene {s.get('index')} hard cut needs a justification")
            if h.get("surface") not in SURFACES:
                h["surface"] = "photo"
        else:
            if s.get("visualType") not in VISUAL_TYPES:
                s["visualType"] = "abstract"
            aid = s.get("assetId")
            if aid:
                a = assets.get(aid)
                if not a or a.get("kind") not in ("image", "photo", "still"):
                    errs.append(f"scene {s.get('index')} references a missing still")
                else:
                    assigned.add(aid)
                    still_counts[aid] = still_counts.get(aid, 0) + (0 if s.get("reuseReason") else 1)
                    if still_counts[aid] > 1:
                        errs.append(f"asset {aid} is assigned to more than one scene without a reuseReason")
    for a in catalog:
        if a.get("kind") not in ("image", "video"):
            continue
        if a.get("status") not in (None, "ready", "ok", "complete"):
            continue
        if a.get("kind") == "video" and (a.get("durationMs") or 0) <= 2000:
            continue
        if a["id"] not in assigned:
            errs.append(f"upload {a.get('filename') or a['id']} is not assigned to any scene")
        if a.get("kind") == "image" and is_mark_asset(a):
            holders = [s for s in plan.get("scenes") or [] if s.get("assetId") == a["id"]]
            if holders and not any(
                s.get("visualType") == "title" or s is (plan.get("scenes") or [None])[-1]
                or s.get("index") == 0
                for s in holders
            ):
                # Prefer title or end, but an explicit assignment anywhere still counts as used.
                pass
    world = plan.get("world") or {}
    if not (world.get("brief") or world.get("reason") or world.get("name") or world.get("type")):
        errs.append("plan is missing a world brief")
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
            "midground context, foreground hero), emphasis as [{lineId, word}] with words that are literally in that line, a reason, and transitionOut. "
            "Every ready upload must appear at least once: assign each still a unique official scene via assetId (add reuseReason only if a repeat is truly necessary). A logo, wordmark, brand mark or lockup belongs on the title or the end card. Uploaded videos are handoff scenes (kind 'handoff'); play the planned stretch in full (inS/outS, default the whole clip) with audioMode 'clip' and narration paused. Put any spoken setup in the previous graphics scene — lineIds on a clip-audio handoff should be empty: "
            "handoff {assetId, inS, outS, surface: photo|tv|newspaper, exitStyle: mirror|asymmetric, exitReason, "
            "audioMode: clip (footage sound, narration pauses) | bed (narration continues over it)}. Hard cuts (kind 'hardcut') need "
            "cutJustification. musicAnchors: {pulse, build, peak, crash (optional), resolve} each {lineId, word}. Palette must be "
            "distinct and fit the subject. Return JSON {world:{type,reason}, style:{palette:{bg,ink,accent,accent2,muted}, mood, "
            "grain, glow, vignette, reason}, scenes:[{kind,visualType,lineIds,description,emphasis:[{lineId,word}],reason,transitionOut,assetId,handoff}], musicAnchors:{...}, deliberateMinimal:[{index, reason}]}.")
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
                _normalize_emphasis(s)
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
    w = plan.get("world") or {}
    log("plan_world", f"world: {w.get('name') or w.get('type') or 'custom'} — {w.get('brief') or w.get('reason') or ''}", w)
    log("plan_style", f"style: {plan['style'].get('mood')} — {plan['style'].get('reason', '')}", {"palette": plan["style"]["palette"]})
    for s in plan["scenes"]:
        log("plan_scene", f"scene {s['index'] + 1}: {s.get('visualType')} — {s.get('reason', '')}",
            {"index": s["index"], "kind": s["kind"], "visualType": s.get("visualType"), "lineIds": s.get("lineIds")})
    return plan
