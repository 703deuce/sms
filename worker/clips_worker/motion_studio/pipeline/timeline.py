"""#1218 BE-9 master timeline model + #1222 BE-13 handoff segment records.

The program layout is computed from the plan + narration word timings: graphics scenes span their
lines' VO; clip-audio handoffs pause the narration; bed-mode handoffs play under it. All program times
are seconds here; the editor extension uses ms. Validator: hard cuts need a justification; an export is
refused if any handoff lacks seam scores or decodeVerified.
"""
from __future__ import annotations

from clips_worker.motion_studio.core.world import HOUSE

LEAD_S = 0.5
TAIL_S = 2.5
ENTER_S = 1.4
EXIT_S = 1.2
LINE_PRE = 0.12
LINE_POST = 0.3


class TimelineError(ValueError):
    pass


def _line_spans(narration: dict) -> dict[str, tuple[int, float, float]]:
    spans: dict[str, tuple[int, float, float]] = {}
    for ch in narration["chapters"]:
        for w in ch["words"]:
            lid = str(w.get("line"))
            s, e = float(w["s"]), float(w["e"])
            if lid in spans:
                c, a, b = spans[lid]
                spans[lid] = (c, min(a, s), max(b, e))
            else:
                spans[lid] = (ch["index"], s, e)
    return spans


def layout(plan: dict, narration: dict, story: dict, fps: int = HOUSE["fps"]) -> dict:
    spans = _line_spans(narration)
    ch_dur = {c["index"]: float(c["durationS"]) for c in narration["chapters"]}
    pause = float((narration.get("chapterPauseS") or 0.9))
    t = LEAD_S
    scenes, vo_segments, words = [], [], []
    last_ch = None
    for s in plan["scenes"]:
        start = t
        segs = []
        groups: list[list[str]] = []
        for lid in s.get("lineIds") or []:
            if lid not in spans:
                continue
            if groups and spans[groups[-1][-1]][0] == spans[lid][0]:
                groups[-1].append(lid)
            else:
                groups.append([lid])
        for g in groups:
            ch = spans[g[0]][0]
            if last_ch is not None and ch != last_ch:
                t += pause
            last_ch = ch
            a = max(0.0, spans[g[0]][1] - LINE_PRE)
            b = min(ch_dur.get(ch, spans[g[-1]][2] + 1), spans[g[-1]][2] + LINE_POST)
            segs.append({"chapter": ch, "srcStart": round(a, 3), "srcEnd": round(b, 3), "progStart": round(t, 3), "lineIds": g})
            t += b - a
        vo_dur = t - start
        rec = {"index": s["index"], "kind": s.get("kind", "graphics"), "visualType": s.get("visualType", "abstract"),
               "lineIds": s.get("lineIds") or [], "voSegments": segs}
        if s.get("kind") in ("handoff", "hardcut"):
            h = dict(s.get("handoff") or {})
            hard = s["kind"] == "hardcut"
            enter = 0.0 if hard else ENTER_S
            exit_ = 0.0 if hard else EXIT_S
            in_s = float(h.get("inS") or 0.0)
            # Honour the planned stretch in full. Never shrink outS to fit the VO.
            clip_len = max(1.0, float(h.get("outS") or 0) - in_s)
            mode = h.get("audioMode")
            if mode == "bed":
                h["audioMode"] = "bed"
                total = max(vo_dur, enter + clip_len + exit_)
            else:
                # Default (and Keef-style RETURN): narration pauses, the clip plays in full.
                h["audioMode"] = mode if mode in ("clip", "mute") else "clip"
                total = enter + clip_len + exit_
                segs = []  # do not lay VO over the footage
            h["enterS"], h["exitS"] = enter, exit_
            rec["handoff"] = h
            rec["voSegments"] = segs
            t = start + total
        else:
            t = start + max(vo_dur, 2.0)
        rec["startS"], rec["endS"] = round(start, 3), round(t, 3)
        scenes.append(rec)
        vo_segments.extend(segs)
    if scenes:
        scenes[-1]["endS"] = round(scenes[-1]["endS"] + TAIL_S, 3)
        t = scenes[-1]["endS"]
    # snap to frames: each scene's frame count is exact; program = sum of frames
    f = 0
    for sc in scenes:
        n = max(1, int(round((sc["endS"] - sc["startS"]) * fps)))
        sc["startFrame"], sc["frames"] = f, n
        sc["startS"], sc["endS"] = round(f / fps, 4), round((f + n) / fps, 4)
        f += n
    for seg in vo_segments:
        chw = next(c for c in narration["chapters"] if c["index"] == seg["chapter"])["words"]
        for w in chw:
            if seg["srcStart"] <= float(w["s"]) and float(w["e"]) <= seg["srcEnd"] + 1e-3:
                words.append({"w": w["w"], "s": round(float(w["s"]) - seg["srcStart"] + seg["progStart"], 3),
                              "e": round(float(w["e"]) - seg["srcStart"] + seg["progStart"], 3), "line": str(w.get("line"))})
    words.sort(key=lambda w: w["s"])
    return {"scenes": scenes, "voSegments": vo_segments, "words": words, "frames": f, "durationS": round(f / fps, 4), "fps": fps}




def _scene_environment(plan: dict, planned: dict) -> dict:
    """The bound custom environment for this scene — not a WORLD_TYPES menu entry."""
    worlds = list((plan or {}).get("worlds") or ((plan or {}).get("blueprint") or {}).get("worlds") or [])
    wid = planned.get("worldId") if isinstance(planned, dict) else None
    env = next((w for w in worlds if isinstance(w, dict) and w.get("id") == wid), None)
    if env is None and worlds:
        env = worlds[0] if isinstance(worlds[0], dict) else None
    if isinstance(env, dict):
        return {"id": env.get("id"), "name": env.get("name"), "brief": env.get("brief"), "reason": env.get("reason")}
    world = (plan or {}).get("world") if isinstance((plan or {}).get("world"), dict) else {}
    return {"id": None, "name": world.get("name"), "brief": world.get("brief"), "reason": world.get("reason")}


def _world_type(plan: dict) -> str | None:
    world = (plan or {}).get("world")
    if isinstance(world, str) and world.strip():
        return world.strip()
    if isinstance(world, dict):
        typ = world.get("type")
        return typ if isinstance(typ, str) and typ else None
    return None


def _emphasis_items(raw, line_ids: list) -> list[dict]:
    """The director schema is [{lineId, word}], but the model often returns a list of bare words."""
    items = []
    ids = [str(x) for x in (line_ids or [])]
    for e in raw or []:
        if isinstance(e, str) and e.strip():
            items.append({"lineId": None, "word": e.strip()})
        elif isinstance(e, dict):
            word = e.get("word") or e.get("text") or e.get("w") or ""
            if not str(word).strip():
                continue
            lid = e.get("lineId") or e.get("line")
            lid = str(lid) if lid else None
            if lid and ids and lid not in ids:
                lid = None
            items.append({"lineId": lid, "word": str(word).strip()})
    return items


def _match_emphasis(items: list[dict], words: list[dict]) -> list[dict]:
    emph = []
    used = set()
    for e in items:
        word = e.get("word") or ""
        needles = [word.lower()] + [p for p in word.lower().replace(",", "").split() if p]
        for w in words:
            key = (w["line"], w["s"], w["w"])
            if key in used:
                continue
            if e.get("lineId") and w["line"] != e["lineId"]:
                continue
            token = w["w"].strip(".,!?;:\"'").lower()
            if any(token.startswith(n[:6]) or n.startswith(token) or token in n for n in needles if n):
                emph.append({"lineId": w["line"], "word": word, "t": w["s"]})
                used.add(key)
                break
    return emph



def assigned_asset_ids(planned: dict | None, plan: dict | None = None, index: int | None = None) -> list[str]:
    """Asset ids officially bound to this scene (plan assetId / handoff / blueprint placement)."""
    ids: list[str] = []
    planned = planned or {}
    if not isinstance(planned, dict):
        return ids

    def add(v):
        if isinstance(v, str) and v and v not in ids:
            ids.append(v)

    add(planned.get("assetId"))
    for extra in planned.get("assetIds") or []:
        add(extra)
    h = planned.get("handoff")
    if isinstance(h, dict):
        add(h.get("assetId"))
    bp = (plan or {}).get("blueprint") or {}
    for row in bp.get("assetPlacements") or []:
        if not isinstance(row, dict):
            continue
        if index is not None and row.get("sceneIndex") == index:
            add(row.get("assetId"))
    return ids


def assets_for_scene(planned: dict | None, assets_meta: dict | None, plan: dict | None = None,
                     index: int | None = None) -> dict:
    """Only the stills assigned to this scene, so a designer cannot reuse the whole bag."""
    meta = assets_meta or {}
    ids = assigned_asset_ids(planned, plan, index)
    if ids:
        return {k: meta[k] for k in ids if k in meta}
    return {}

def scene_context(sc: dict, lay: dict, story: dict, plan: dict, assets_meta: dict, seed: int) -> dict:
    t0, t1 = sc["startS"], sc["endS"]
    by_id = {l["id"]: l for l in story["lines"]}
    words = [{"w": w["w"], "s": round(w["s"] - t0, 3), "e": round(w["e"] - t0, 3), "line": w["line"]}
             for w in lay["words"] if t0 <= w["s"] < t1]
    lines = []
    for lid in sc["lineIds"]:
        ws = [w for w in words if w["line"] == lid]
        if not ws or lid not in by_id:
            continue
        l = by_id[lid]
        lines.append({"id": lid, "text": l["text"], "spoken": l["spoken"], "hero": l.get("hero") or "",
                      "typed": l.get("typed") or "", "start": ws[0]["s"], "end": ws[-1]["e"]})
    planned = next((p for p in plan["scenes"] if p["index"] == sc["index"]), {})
    data = [d for d in story.get("data") or [] if d.get("lineId") in sc["lineIds"]]
    emph = _match_emphasis(_emphasis_items(planned.get("emphasis"), sc.get("lineIds") or []), words)
    env = _scene_environment(plan, planned if isinstance(planned, dict) else {})
    asset_id = (planned.get("assetId") or ((planned.get("handoff") or {}).get("assetId") if isinstance(planned.get("handoff"), dict) else None)) if isinstance(planned, dict) else None
    if not isinstance(asset_id, str):
        asset_id = None
    assets = assets_for_scene(planned if isinstance(planned, dict) else {}, assets_meta, plan, sc.get("index"))
    blueprint = (plan or {}).get("blueprint") or {}
    binding = next((b for b in (blueprint.get("sceneBindings") or []) if b.get("sceneIndex") == sc.get("index")), None)
    return {"duration": round(t1 - t0, 4), "fps": lay["fps"], "seed": seed + sc["index"] * 7919,
            "style": plan["style"], "palette": plan["style"]["palette"], "lines": lines, "words": words, "emphasis": emph,
            "assets": assets, "data": data, "blueprint": blueprint,
            "identity": plan.get("identity") or blueprint.get("identity") or {},
            "worlds": plan.get("worlds") or blueprint.get("worlds") or [],
            "assetUsage": blueprint.get("assetUsageManifest") or plan.get("assetUsageManifest") or {},
            "cameraPlan": blueprint.get("cameraPlan") or {},
            "sceneBinding": binding,
            "scene": {"id": f"s{sc['index']}", "index": sc["index"], "kind": sc.get("kind") or planned.get("kind"),
                      "visualType": sc["visualType"], "description": planned.get("description", "") if isinstance(planned, dict) else "",
                      "blocks": (planned.get("blocks") or []) if isinstance(planned, dict) else [],
                      "world": env, "environment": env, "assetId": asset_id,
                      "worldId": (planned.get("worldId") if isinstance(planned, dict) else None) or (env or {}).get("id"),
                      "objective": (binding or {}).get("objective") or (planned.get("description") if isinstance(planned, dict) else "")}}



def validate_for_export(lay: dict, handoffs: dict[int, dict]) -> list[str]:
    errs = []
    for sc in lay["scenes"]:
        if sc["kind"] == "hardcut" and not (sc.get("handoff") or {}).get("cutJustification"):
            errs.append(f"scene {sc['index']}: hard cut without justification")
        if sc["kind"] in ("handoff", "hardcut"):
            rec = handoffs.get(sc["index"])
            if not rec or not rec.get("seamScores") or not rec.get("decodeVerified"):
                errs.append(f"scene {sc['index']}: handoff missing seam scores or decodeVerified")
    return errs


def editor_extension(project_id: str, lay: dict, story: dict, plan: dict, handoffs: dict[int, dict], music: dict,
                     version: int, render_hashes: dict[int, str]) -> dict:
    """ClipEditsV2 `motionStudio` extension (Compact Editor). Track labels VIDEO/GRAPHICS/VOICE/MUSIC (FE-6)."""
    ms = lambda s: int(round(s * 1000))  # noqa: E731
    by_id = {l["id"]: l for l in story["lines"]}
    scenes_items, handoff_items, graphics_items, vo_items = [], [], [], []
    segments = []
    for sc in lay["scenes"]:
        item = {"id": f"ms_scene_{sc['index']}", "startMs": ms(sc["startS"]), "endMs": ms(sc["endS"]),
                "sceneIndex": sc["index"], "label": sc["visualType"]}
        (handoff_items if sc["kind"] in ("handoff", "hardcut") else scenes_items).append(item)
        if sc["kind"] == "graphics":
            heroes = [by_id[l]["hero"] for l in sc["lineIds"] if l in by_id and by_id[l].get("hero")]
            graphics_items.append({**item, "id": f"ms_gfx_{sc['index']}", "label": " · ".join(heroes)[:80] or sc["visualType"]})
        seg = {"segmentId": f"seg_{sc['index']}", "sceneId": f"s{sc['index']}", "kind": sc["kind"], "visualType": sc["visualType"],
               "startMs": ms(sc["startS"]), "endMs": ms(sc["endS"]), "frames": sc["frames"], "renderHash": render_hashes.get(sc["index"])}
        if sc["kind"] in ("handoff", "hardcut"):
            seg["handoff"] = handoffs.get(sc["index"])
        segments.append(seg)
    for v in lay["voSegments"]:
        vo_items.append({"id": f"ms_vo_{v['chapter']}_{ms(v['progStart'])}", "startMs": ms(v["progStart"]),
                         "endMs": ms(v["progStart"] + v["srcEnd"] - v["srcStart"]), "chapter": v["chapter"], "inMs": ms(v["srcStart"])})
    tracks = [
        {"id": "ms_scenes", "kind": "scenes", "label": "VIDEO", "items": scenes_items + handoff_items},
        {"id": "ms_handoff", "kind": "handoff", "label": "VIDEO · footage", "items": handoff_items},
        {"id": "ms_graphics", "kind": "graphics", "label": "GRAPHICS", "items": graphics_items},
        {"id": "ms_vo", "kind": "vo", "label": "VOICE", "items": vo_items},
        {"id": "ms_music", "kind": "music", "label": "MUSIC",
         "items": [] if not music or music.get("source") == "none" else [{"id": "ms_music_bed", "startMs": 0, "endMs": ms(lay["durationS"]),
                                                                          "source": music.get("source")}]},
        {"id": "ms_sfx", "kind": "sfx", "label": "SFX", "items": [{"id": "ms_sfx_bed", "startMs": 0, "endMs": ms(lay["durationS"])}]},
    ]
    return {"v": 1, "projectId": project_id, "timelineVersion": version, "durationMs": ms(lay["durationS"]), "fps": lay["fps"],
            "tracks": tracks, "segments": segments}


def chapter_markers(lay: dict, story: dict) -> list[dict]:
    first_line_ch = {}
    for l in story["lines"]:
        first_line_ch.setdefault(l["chapter"], l["id"])
    titles = {int(c.get("n", 0)): c.get("title") for c in story.get("chapters") or [] if isinstance(c, dict)}
    out = []
    for ch, lid in first_line_ch.items():
        w = next((w for w in lay["words"] if w["line"] == lid), None)
        if w:
            out.append({"id": f"ms_ch_{ch}", "ms": int(w["s"] * 1000), "color": "purple",
                        "label": str(titles.get(ch) or f"Chapter {ch}")[:80], "chapter": True})
    return out
