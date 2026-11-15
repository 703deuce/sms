"""Production Designer: film identity, 1..N environments, and the visual blueprint.

Sits between the Film Director (story/structure) and the Motion Engineer.
Creative-only: outputs a versioned visual blueprint and asset usage manifest. Writes no Python, rendering, or DB mutation.
The engine supplies HOW (camera, render, timing, primitives). This step
decides WHAT / WHERE / WHEN / WHY for the whole film before any scene code.
"""
from __future__ import annotations

import copy
import json
import re

from clips_worker.motion_studio.directors.documentary.director import (
    _STOP,
    _assign_stills,
    _token_overlap,
    _world_from_story,
    is_mark_asset,
    validate_plan,
)
from clips_worker.motion_studio.core import preproduction as pre
from clips_worker.motion_studio.core import style_memory
from clips_worker.motion_studio.directors.documentary.contracts import (
    CONTRACT_VERSION,
    FORBIDDEN_BLUEPRINT_KEYS,
    validate_blueprint,
)
from clips_worker.motion_studio.core.designer_capabilities import asset_evidence, assets_in_hand, format_designer_capabilities, validate_visuals_against_assets
from clips_worker.motion_studio.core.output_contracts import (
    StageContractError,
    format_contract,
    schema_for,
    schema_name,
)
from clips_worker.motion_studio.pipeline import config
from clips_worker.motion_studio.pipeline.llm import LLMError, chat_json


def _blob(asset: dict) -> str:
    an = asset.get("analysis") or {}
    tags = an.get("tags") or []
    text = an.get("onScreenText") or []
    if isinstance(tags, str):
        tags = [tags]
    if isinstance(text, str):
        text = [text]
    return " ".join([
        str(asset.get("filename") or ""),
        str(an.get("summary") or an.get("description") or an.get("subject") or ""),
        " ".join(str(x) for x in tags),
        " ".join(str(x) for x in text),
        str(an.get("era") or ""),
        str(an.get("role") or ""),
    ]).lower()


def _story_blob(story: dict) -> str:
    parts = [story.get("title") or "", story.get("logline") or ""]
    for l in story.get("lines") or []:
        parts.append(l.get("text") or "")
        parts.append(l.get("hero") or "")
    return " ".join(parts).lower()


def inventory_from_catalog(catalog: list[dict], story: dict) -> list[dict]:
    """Tag each upload with subject, era, relevance, quality, role, and usable moments."""
    blob = _story_blob(story)
    rows = []
    for a in assets_in_hand(catalog):
        if a.get("kind") not in ("image", "video", "photo", "still"):
            continue
        an = a.get("analysis") or {}
        text = _blob(a)
        subject = (an.get("subject") or an.get("summary") or an.get("description") or a.get("filename") or a["id"])
        subject = " ".join(str(subject).split())[:160]
        era = str(an.get("era") or "").strip()
        score = _token_overlap(a, blob)
        if score >= 2 or (a.get("kind") == "video" and (a.get("durationMs") or 0) > 2000):
            relevance = "high"
        elif score >= 1 or is_mark_asset(a):
            relevance = "medium"
        else:
            relevance = "low"
        w, h = int(a.get("width") or 0), int(a.get("height") or 0)
        quality = an.get("quality") or ("weak" if (w and h and w * h < 400 * 400) or an.get("error") else "usable")
        if is_mark_asset(a):
            role = "mark"
        elif a.get("kind") == "video":
            role = "footage"
        elif re.search(r"\b(document|letter|memo|receipt|filing|contract)\b", text):
            role = "document"
        else:
            role = str(an.get("role") or "photograph")
        moments = list(an.get("moments") or [])
        if a.get("kind") == "video" and not moments:
            dur = max(0.0, (a.get("durationMs") or 0) / 1000.0)
            if dur >= 1.0:
                moments = [{"inS": 0.0, "outS": round(dur, 3), "reason": "full clip is the usable stretch"}]
        ev = asset_evidence(a)
        rows.append({
            "assetId": a["id"], "kind": a.get("kind"), "filename": a.get("filename"),
            "subject": subject, "era": era or ev.get("era") or "", "relevance": relevance, "quality": quality,
            "role": role, "moments": moments[:16] or ev.get("moments") or [],
            "evidence": ev,
        })
    return rows


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    u = a | b
    return len(a & b) / len(u) if u else 0.0


def environments_from_story(story: dict, seed_world: dict | None = None) -> list[dict]:
    """1..N custom environments, split only when the story itself shifts — never on a fixed cadence."""
    seed = seed_world or _world_from_story(story)
    lines = story.get("lines") or []
    chapters = story.get("chapters") or []
    by_ch: dict[int, list] = {}
    for l in lines:
        by_ch.setdefault(int(l.get("chapter") or 1), []).append(l)
    ch_ids = sorted(by_ch)
    def toks(ch: int) -> set[str]:
        blob = " ".join((l.get("text") or "") + " " + (l.get("hero") or "") for l in by_ch[ch]).lower()
        return {w for w in re.findall(r"[a-z]{4,}", blob) if w not in _STOP}

    # A single environment unless adjacent chapters are lexically distinct.
    split = False
    if len(ch_ids) >= 2:
        shifts = 0
        for a, b in zip(ch_ids, ch_ids[1:]):
            if _jaccard(toks(a), toks(b)) < 0.35:
                shifts += 1
        split = shifts > 0
    if not split:
        return [{"id": "w1", "name": seed.get("name") or (story.get("title") or "the film"),
                 "brief": seed.get("brief") or "", "reason": seed.get("reason") or "",
                 "clusters": [], "chapters": ch_ids}]

    worlds = []
    for i, c in enumerate(ch_ids, 1):
        title = next((str(ch.get("title") or "") for ch in chapters
                      if int(ch.get("n") or ch.get("index") or 0) == c), "") or f"Sequence {i}"
        sample = " ".join((l.get("hero") or l.get("text") or "")[:80] for l in by_ch[c][:3])
        worlds.append({
            "id": f"w{i}",
            "name": title,
            "brief": (f"A custom environment for this sequence ({title}), invented from the narration "
                      f"({sample}) — not a stock map, grid, or chart template."),
            "reason": "story-driven sequence: the chapter is visually distinct from its neighbour",
            "clusters": [],
            "chapters": [c],
        })
    return worlds


def _bind_scenes_to_worlds(scenes: list[dict], worlds: list[dict], story: dict) -> None:
    chapter_of = {l["id"]: int(l.get("chapter") or 1) for l in story.get("lines") or []}
    ch_to_world = {}
    for w in worlds:
        for c in w.get("chapters") or []:
            ch_to_world[int(c)] = w["id"]
    default = worlds[0]["id"] if worlds else None
    for s in scenes:
        lids = s.get("lineIds") or []
        ch = chapter_of.get(lids[0]) if lids else None
        s["worldId"] = ch_to_world.get(ch, default)


def _identity_from_plan(plan: dict, story: dict, worlds: list[dict]) -> dict:
    style = plan.get("style") or {}
    title = story.get("title") or (worlds[0].get("name") if worlds else "this film")
    return {
        "concept": (worlds[0].get("brief") if len(worlds) == 1 else
                    f"One art direction for {title}, carried across {len(worlds)} custom environments."),
        "typography": style.get("fonts") or None,
        "materials": "Invented from the surfaces and objects this story actually names.",
        "palette": (style.get("palette") or {}),
        "cameraPersonality": style.get("cameraPersonality") or None,
        "transitionLanguage": style.get("transitionLanguage") or None,
        "motifs": [],
        "throughLine": story.get("logline") or title,
    }


def _custom_objects(plan: dict, story: dict) -> list[dict]:
    """Subject-specific machinery the scene designer should invent — tools, not stock compositions."""
    objects = []
    for s in plan.get("scenes") or []:
        vt = s.get("visualType") or ""
        if vt in ("data", "diagram", "timeline", "map", "document"):
            desc = (s.get("description") or "").strip() or "this beat"
            objects.append({
                "id": f"obj-s{s.get('index')}",
                "name": f"custom {vt} for scene {s.get('index')}",
                "purpose": f"Original {vt} machinery for: {desc}. Build it with engine primitives; do not reuse a finished composition from another film.",
                "sceneIndex": s.get("index"),
            })
    return objects


def _missing_needs(plan: dict, inventory: list[dict], story: dict) -> list[dict]:
    assigned = set()
    for s in plan.get("scenes") or []:
        if s.get("assetId"):
            assigned.add(s["assetId"])
        if (s.get("handoff") or {}).get("assetId"):
            assigned.add(s["handoff"]["assetId"])
    used = {r["assetId"] for r in inventory if r["assetId"] in assigned}
    needs = []
    for s in plan.get("scenes") or []:
        if s.get("kind") in ("handoff", "hardcut"):
            continue
        if s.get("assetId") or s.get("visualType") == "title":
            continue
        # Graphics beat with no still: name an original illustration instead of unrelated filler.
        needs.append({
            "sceneIndex": s.get("index"),
            "need": (s.get("description") or s.get("reason") or "this beat"),
            "treatment": "original relevant illustration — not unrelated filler, not a stock city or generic grid",
        })
    unused = [r for r in inventory if r["assetId"] not in used and r.get("relevance") in ("high", "medium")]
    for r in unused:
        needs.append({"assetId": r["assetId"], "need": f"place {r.get('subject') or r.get('filename')} in a scene",
                      "treatment": "allocation missed a relevant upload"})
    return needs



def asset_usage_manifest(plan: dict, inventory: list[dict]) -> dict:
    """Authoritative record of how every inventoried upload is used (or not)."""
    used: dict[str, list[dict]] = {}
    for s in plan.get("scenes") or []:
        idx = s.get("index")
        still = s.get("assetId")
        clip = (s.get("handoff") or {}).get("assetId") if isinstance(s.get("handoff"), dict) else None
        for aid, role in ((still, "still"), (clip, "footage")):
            if not aid:
                continue
            recs = used.setdefault(aid, [])
            recs.append({
                "sceneIndex": idx,
                "role": role,
                "reuseReason": s.get("reuseReason") if recs else None,
            })
    entries = []
    for rec in inventory or []:
        aid = rec["assetId"]
        uses = used.get(aid) or []
        # First placement is the official use; later ones must carry a reuseReason when the scene has one.
        if len(uses) > 1:
            for u in uses[1:]:
                u["reuseReason"] = u.get("reuseReason") or next(
                    (s.get("reuseReason") for s in plan.get("scenes") or []
                     if s.get("index") == u.get("sceneIndex") and s.get("reuseReason")),
                    None,
                )
        entries.append({
            "assetId": aid,
            "kind": rec.get("kind"),
            "filename": rec.get("filename"),
            "subject": rec.get("subject"),
            "era": rec.get("era"),
            "relevance": rec.get("relevance"),
            "quality": rec.get("quality"),
            "role": rec.get("role"),
            "moments": rec.get("moments") or [],
            "usedIn": uses,
            "provenance": rec.get("provenance") or "user_upload",
        })
    return {
        "version": CONTRACT_VERSION,
        "entries": entries,
        "unused": [e["assetId"] for e in entries if not e["usedIn"]],
        "repeats": [e["assetId"] for e in entries if len(e["usedIn"]) > 1],
    }


def finalize_production(plan: dict, story: dict, catalog: list[dict], inventory: list[dict]) -> dict:
    """Attach versioned blueprint fields + the asset usage manifest; reject code in the blueprint."""
    bp = dict(plan.get("blueprint") or {})
    for key in FORBIDDEN_BLUEPRINT_KEYS:
        bp.pop(key, None)
    identity = plan.get("identity") or bp.get("identity") or {}
    manifest = asset_usage_manifest(plan, inventory)
    bp.update({
        "version": CONTRACT_VERSION,
        "identity": identity,
        "worlds": plan.get("worlds") or bp.get("worlds") or [],
        "inventory": inventory,
        "assetUsageManifest": manifest,
        "cameraPlan": bp.get("cameraPlan") or {
            "route": bp.get("cameraRoute") or None,
            "reason": bp.get("cameraRouteReason") or None,
            "personality": identity.get("cameraPersonality"),
        },
        "composition": bp.get("composition"),
        "animationIntent": bp.get("animationIntent") or identity.get("cameraPersonality"),
        "transitions": bp.get("transitions") or {
            "language": identity.get("transitionLanguage") or None,
        },
        "provenance": bp.get("provenance") or {
            "default": "user_upload",
            "types": ["user_upload", "original_illustration", "generated_graphic"],
        },
    })
    problems = validate_blueprint(bp)
    if problems:
        raise ValueError("blueprint invalid: " + "; ".join(problems))
    plan["blueprint"] = bp
    plan["assetUsageManifest"] = manifest
    plan["identity"] = identity
    plan["identityPackage"] = pre.identity_package(plan, story)
    storyboard = pre.build_storyboard(plan, story)
    review = pre.review_storyboard(storyboard, plan)
    storyboard["status"] = review["status"]
    plan["storyboard"] = storyboard
    plan["storyboardReview"] = review
    plan["acquisitionPlan"] = pre.acquisition_plan(plan, story)
    settings = plan.get("settings") or {}
    plan["costEstimate"] = pre.estimate_credits(plan, settings, story)
    plan["styleMemory"] = style_memory.record(plan, plan.get("styleMemory") or [])
    plan = pre.annotate_provenance(plan)
    plan["cameraPlan"] = pre.camera_continuity_plan(plan, story)
    if isinstance(plan.get("blueprint"), dict):
        plan["blueprint"]["cameraPlan"] = plan["cameraPlan"]
    pre.record_checkpoint(plan, "production_design", {
        "identityPackageVersion": plan["identityPackage"].get("packageVersion"),
        "storyboard": review.get("status"),
        "assetUsageManifest": True,
        "acquisitionPlan": True,
        "costEstimateCredits": plan["costEstimate"].get("total"),
        "unit": "credits",
    })
    return plan


def fallback_production(project: dict, story: dict, catalog: list[dict], plan: dict) -> dict:
    """Deterministic Production Designer when the model is unavailable or invalid."""
    inventory = inventory_from_catalog(catalog, story)
    # Honour existing official assignments; fill any leftover stills.
    _assign_stills(plan.setdefault("scenes", []), catalog, story)
    for k, s in enumerate(plan.get("scenes") or []):
        s["index"] = k
    seed = plan.get("world") if isinstance(plan.get("world"), dict) and plan["world"].get("brief") else _world_from_story(story)
    worlds = environments_from_story(story, seed)
    _bind_scenes_to_worlds(plan["scenes"], worlds, story)
    identity = _identity_from_plan(plan, story, worlds)
    identity["typography"] = identity.get("typography") or (plan.get("style") or {}).get("fonts") or {
        "display": "cond", "label": "label", "body": "serif",
    }
    identity["cameraPersonality"] = identity.get("cameraPersonality") or (
        "Mock-only camera: motivated holds and moves; not used on the live path."
    )
    identity["concept"] = identity.get("concept") or (worlds[0].get("brief") if worlds else "mock production design")
    identity["throughLine"] = identity.get("throughLine") or story.get("logline") or story.get("title") or "this film"
    objects = _custom_objects(plan, story)
    needs = _missing_needs(plan, inventory, story)
    placements = []
    handoffs = []
    bindings = []
    for s in plan["scenes"]:
        if s.get("assetId"):
            placements.append({"sceneIndex": s.get("index"), "assetId": s["assetId"],
                               "reason": s.get("reason") or "official assignment",
                               "reuseReason": s.get("reuseReason")})
        h = s.get("handoff") or {}
        if h.get("assetId"):
            handoffs.append({"sceneIndex": s.get("index"), "assetId": h["assetId"],
                             "inS": h.get("inS"), "outS": h.get("outS"), "audioMode": h.get("audioMode") or "clip"})
        bindings.append({
            "sceneIndex": s.get("index"), "worldId": s.get("worldId"),
            "visualType": s.get("visualType"),
            "assetId": s.get("assetId") or h.get("assetId"),
            "objective": s.get("description") or s.get("reason") or "",
            "heldStillOk": s.get("visualType") == "photo",
            "evidenceBasis": "mock-only: uses the official upload as analyzed (not used on the live path)",
            "toolBasis": "mock-only: PhotoFrame or footage handoff (not used on the live path)",
        })
    plan["identity"] = identity
    plan["worlds"] = worlds
    # Keep a primary world brief for older readers / music, pointing at the through-line.
    plan["world"] = {
        "name": identity.get("throughLine") or (worlds[0]["name"] if worlds else story.get("title") or "the film"),
        "brief": identity.get("concept") or (worlds[0].get("brief") if worlds else ""),
        "reason": identity.get("concept") or (worlds[0].get("reason") if worlds else "") or "production design for this film",
        "worlds": [w["id"] for w in worlds],
    }
    plan["blueprint"] = {
        "identity": identity,
        "worlds": worlds,
        "inventory": inventory,
        "assetPlacements": placements,
        "handoffs": handoffs,
        "customObjects": objects,
        "missingNeeds": needs,
        "sceneBindings": bindings,
        "cameraRoute": "Mock-only route following the bound environments (not used on the live path).",
        "cameraRouteReason": "mock/deterministic fallback — live films require a Production Designer decision",
        "audioDirection": "Mock-only: narration pauses during clip-mode footage.",
        "audioDirectionReason": "mock/deterministic fallback — live films require a Production Designer decision",
    }
    plan["productionSource"] = "fallback"
    inventory = inventory or inventory_from_catalog(catalog, story)
    if project.get("settings"):
        plan.setdefault("settings", {k: v for k, v in project["settings"].items() if k in ("lengthMin", "voiceover", "music", "renderSize", "resolution", "format", "finalRenderSize")})
    return finalize_production(plan, story, catalog, inventory)


def design_production(project: dict, story: dict, catalog: list[dict], plan: dict, log) -> dict:
    """Run the Production Designer and attach identity + blueprint to the director plan."""
    plan = plan or {}
    if project.get("settings"):
        plan.setdefault("settings", {k: v for k, v in project["settings"].items() if k in ("lengthMin", "voiceover", "music", "renderSize", "resolution", "format", "finalRenderSize")})
    if config.mock():
        out = fallback_production(project, story, catalog, plan)
        log("production_design", "deterministic production design (mock)", {"worlds": len(out.get("worlds") or [])})
        validate_plan(out, story, catalog)
        return out

    editorial = copy.deepcopy(plan)
    inventory = inventory_from_catalog(catalog, story)
    sys_ = (
        "You are the Production Designer for a cinematic motion-graphics documentary. "
        "You are a creative-only role: wildly inventive about visual identity, environments, objects, "
        "composition, animation intent and transitions. You write NO Python, no rendering instructions, "
        "and no database or storage mutations. The Motion Engineer and the deterministic engine implement HOW. "
        "You decide WHAT exists, WHERE it lives, WHEN it moves, and WHY it belongs. "
        "Design the film before any scene is drawn.\n"
        "Return JSON with three levels:\n"
        "1. identity: {concept, typography, materials, palette (keep the plan's palette unless it is wrong), "
        "cameraPersonality, transitionLanguage, motifs, throughLine}. "
        "A held photograph can beat chaotic motion; do not prescribe movement for its own sake.\n"
        "2. worlds: 1..N custom environments. The count is story-driven — a short film may need one; a longer "
        "film may need several acts (for example, distinct historical eras). Never schedule an environment "
        "change on a fixed cadence, and never pick from a menu of stock world types "
        "(map, price_chart, timeline, evidence_board, network, document_desk, abstract_field, city_grid are "
        "examples of capabilities, not the only options).\n"
        "Each world: {id, name, brief, reason, chapters, clusters}. All worlds share the film identity.\n"
        "3. blueprint additions: customObjects [{id, name, purpose, sceneIndex}], "
        "assetPlacements [{sceneIndex, assetId, reason, reuseReason}], "
        "sceneBindings [{sceneIndex, worldId, objective, heldStillOk, evidenceBasis, toolBasis}], "
        "missingNeeds [{sceneIndex, need, treatment}] — when an upload cannot cover a beat, name an original "
        "relevant illustration, never unrelated filler.\n"
        "Every ready upload in the inventory should appear at least once. Repeats require a narrative reuseReason. "
        "Do not drop an official Director assignment: if you move a still, place it on another scene in the same output. "
        "A logo/wordmark/brand mark/lockup belongs on the title or end card. "
        "Uploaded clips play their planned stretch in full with audioMode 'clip' and narration paused. "
        "No subject-specific special cases. "
        "Art direction is more than a palette; invent typography, materials, camera personality and motifs. "
        "Do not spend the most expensive treatment on every beat — prefer held photographs, registered tools "
        "and the generated score unless a paid or custom-code pass is genuinely required. "
        "Every visual objective must be supported by the assigned asset's evidence (inventory.evidence: "
        "what the analysis says the image or clip actually shows, including on-screen text) and by the "
        "engine/tool capabilities you are given, or a declared customObject. Do not require an upload to "
        "show wording or a state the evidence does not record. Record evidenceBasis and toolBasis on each sceneBinding. "
        + style_memory.prompt_excerpt(project.get("styleMemory") or plan.get("styleMemory"))
    )
    user = json.dumps({
        "title": story.get("title"), "tone": story.get("tone"), "logline": story.get("logline"),
        "lines": [{"id": l["id"], "chapter": l.get("chapter"), "text": l.get("text"), "hero": l.get("hero")}
                  for l in story.get("lines") or []],
        "chapters": story.get("chapters") or [],
        "existingPlan": {"style": plan.get("style"), "world": plan.get("world"),
                         "scenes": [{"index": s.get("index"), "kind": s.get("kind"), "visualType": s.get("visualType"),
                                     "lineIds": s.get("lineIds"), "description": s.get("description"),
                                     "assetId": s.get("assetId"), "handoff": s.get("handoff"), "reason": s.get("reason")}
                                    for s in plan.get("scenes") or []]},
        "inventory": inventory,
        "capabilities": format_designer_capabilities(),
        "visualApproachesNote": (
            "Invent the visual approach for THIS film and record it on identity. "
            "Do not pick from a fixed menu of looks."
        ),
        "styleMemory": project.get("styleMemory") or plan.get("styleMemory") or [],
    })
    try:
        sys_ = sys_ + "\n\n" + format_contract("production_designer")
        raw, m = chat_json(
            "production_designer", sys_, user, max_tokens=32000, timeout_s=360,
            schema=schema_for("production_designer"), schema_name=schema_name("production_designer"),
        )
        log("model_call", "production design", m)
        out = _merge_model_design(copy.deepcopy(editorial), story, catalog, inventory, raw)
        errs = validate_plan(out, story, catalog)
        berrs = validate_blueprint(out.get("blueprint")) + validate_scene_objectives(out, catalog)
        if errs or berrs:
            log("production_invalid", "production design failed validation; requesting a targeted repair",
                {"errors": (errs or berrs)[:12], "output": raw})
            repair_user = json.dumps({
                "previous": raw,
                "errors": (errs or []) + (berrs or []),
                "instruction": "Fix ONLY these validation errors. Keep the rest of the design. Return the full corrected JSON.",
            })
            raw, m = chat_json(
                "production_designer", sys_, repair_user, max_tokens=32000, timeout_s=360,
                schema=schema_for("production_designer"), schema_name=schema_name("production_designer"),
            )
            log("model_call", "production design repair", m)
            out = _merge_model_design(copy.deepcopy(editorial), story, catalog, inventory, raw)
            errs = validate_plan(out, story, catalog)
            berrs = validate_blueprint(out.get("blueprint")) + validate_scene_objectives(out, catalog)
        if errs or berrs:
            problems = (errs or []) + (berrs or [])
            log("production_invalid", "production design still invalid after targeted repair; stopping",
                {"errors": problems[:12], "repaired": True, "output": raw})
            raise StageContractError("production_designer", problems, repaired=True, output=raw)
        out["productionSource"] = "model"
        return out
    except StageContractError:
        raise
    except LLMError as exc:
        log("model_call_failed", f"production designer failed: {exc}", {"step": "production_designer"})
        raise StageContractError("production_designer", [f"model call failed: {exc}"]) from exc




def _normalize_bindings(raw_bindings, scenes: list[dict]) -> list[dict]:
    by_idx = {}
    if isinstance(raw_bindings, list):
        for b in raw_bindings:
            if isinstance(b, dict) and b.get("sceneIndex") is not None:
                by_idx[int(b["sceneIndex"])] = b
    out = []
    for s in scenes:
        b = by_idx.get(s.get("index")) or {}
        hid = (s.get("handoff") or {}).get("assetId")
        held = b.get("heldStillOk")
        if held is None:
            held = s.get("visualType") == "photo"
        out.append({
            "sceneIndex": s.get("index"),
            "worldId": b.get("worldId") or s.get("worldId"),
            "visualType": b.get("visualType") or s.get("visualType"),
            "assetId": b.get("assetId") or s.get("assetId") or hid,
            "objective": b.get("objective") or s.get("description") or "",
            "heldStillOk": held,
            "evidenceBasis": b.get("evidenceBasis") or None,
            "toolBasis": b.get("toolBasis") or None,
        })
    return out


def validate_scene_objectives(plan: dict, catalog: list[dict] | None = None) -> list[str]:
    """Live-path check: each graphics beat records how the asset and tools support it."""
    errs: list[str] = []
    bindings = (plan.get("blueprint") or {}).get("sceneBindings") or []
    scenes = {s.get("index"): s for s in plan.get("scenes") or []}
    for b in bindings:
        if not isinstance(b, dict):
            continue
        idx = b.get("sceneIndex")
        scene = scenes.get(idx) or {}
        if scene.get("kind") in ("handoff", "hardcut"):
            continue
        if not scene and not (b.get("objective") or b.get("assetId")):
            continue
        if not (b.get("evidenceBasis") and b.get("toolBasis")):
            errs.append(
                f"scene {idx} visual objective is not supported by the assigned asset's evidence or by registered tools"
            )
    if catalog:
        items = []
        for b in bindings:
            if not isinstance(b, dict):
                continue
            items.append({
                "label": f"scene {b.get('sceneIndex')} objective",
                "text": b.get("objective") or "",
                "assetId": b.get("assetId") or (scenes.get(b.get("sceneIndex")) or {}).get("assetId"),
                "illustrative": bool(b.get("illustrative") or (b.get("toolBasis") or "").startswith("illustrative")),
            })
        errs.extend(validate_visuals_against_assets(items, catalog))
    return errs


def revise_limited_scenes(project: dict, story: dict, catalog: list[dict], plan: dict,
                          limitations: list[dict], log) -> dict:
    """One targeted Production Designer revision of only the limited scenes.

    Fed the engineer's limitation, the assigned asset's analysis, and the real
    capability list. Official assetIds are kept. Mock mode returns the plan unchanged.
    """
    if not limitations:
        return plan
    if config.mock():
        log("production_revision", "mock: skipping limitation revision", {"scenes": [x.get("sceneIndex") for x in limitations]})
        return plan
    inventory = inventory_from_catalog(catalog, story)
    inv_by_id = {r["assetId"]: r for r in inventory}
    scenes = {s.get("index"): s for s in plan.get("scenes") or []}
    bindings = {b.get("sceneIndex"): b for b in ((plan.get("blueprint") or {}).get("sceneBindings") or []) if isinstance(b, dict)}
    limited = []
    for item in limitations:
        idx = item.get("sceneIndex")
        if idx is None:
            continue
        scene = scenes.get(idx) or {}
        aid = item.get("assetId") or scene.get("assetId") or (scene.get("handoff") or {}).get("assetId")
        limited.append({
            "sceneIndex": idx,
            "kind": scene.get("kind"),
            "visualType": scene.get("visualType"),
            "description": scene.get("description"),
            "reason": scene.get("reason"),
            "objective": (bindings.get(idx) or {}).get("objective") or scene.get("description"),
            "assetId": aid,
            "evidence": (inv_by_id.get(aid) or {}).get("evidence") or asset_evidence(next((a for a in catalog if a.get("id") == aid), {})),
            "limitation": {
                "reason": item.get("reason") or ((item.get("limitation") or {}).get("reason") if isinstance(item.get("limitation"), dict) else ""),
                "missingTools": item.get("missingTools") or [],
                "missingAssets": item.get("missingAssets") or [],
                "unblock": item.get("unblock") or "",
            },
        })
    if not limited:
        return plan
    sys_ = (
        "You are the Production Designer revising ONLY the scenes the Motion Engineer could not build. "
        "You write NO Python. Keep every official assetId. Rewrite each limited scene's objective, description, "
        "and treatment so it is supported by that asset's evidence and by registered tools or a declared "
        "customObject. Do not invent wording, objects, or a state the analysis does not record. "
        "If a requested effect needs per-element pixel edits that the engine does not have, switch to a "
        "whole-image treatment or typography on top. Record evidenceBasis and toolBasis. "
        "Return JSON with a sceneRevisions array for the limited scenes only.\n\n"
        + format_contract("production_revision")
        + "\n\n" + format_designer_capabilities()
    )
    user = json.dumps({
        "instruction": "Revise ONLY these limited scenes. Keep official asset assignments. Return the full sceneRevisions array.",
        "limitedScenes": limited,
        "identity": plan.get("identity") or (plan.get("blueprint") or {}).get("identity"),
    })
    try:
        raw, m = chat_json(
            "production_designer", sys_, user, max_tokens=16000, timeout_s=360,
            schema=schema_for("production_revision"), schema_name=schema_name("production_revision"),
        )
        log("model_call", "production limitation revision", m)
    except LLMError as exc:
        log("model_call_failed", f"production revision failed: {exc}", {"step": "production_revision"})
        raise StageContractError("production_designer", [f"limitation revision failed: {exc}"]) from exc
    revisions = (raw or {}).get("sceneRevisions") if isinstance(raw, dict) else None
    if not isinstance(revisions, list) or not revisions:
        raise StageContractError("production_designer", ["limitation revision returned no sceneRevisions"], output=raw)
    _apply_scene_revisions(plan, revisions)
    log("production_revision", f"revised {len(revisions)} limited scene(s) for a second engineer pass",
        {"scenes": [r.get("sceneIndex") for r in revisions if isinstance(r, dict)]})
    return plan


def _apply_scene_revisions(plan: dict, revisions: list) -> None:
    scenes = {s.get("index"): s for s in plan.get("scenes") or []}
    bp = plan.setdefault("blueprint", {})
    bindings = list(bp.get("sceneBindings") or [])
    by_idx = {b.get("sceneIndex"): dict(b) for b in bindings if isinstance(b, dict)}
    objects = list(bp.get("customObjects") or plan.get("customObjects") or [])
    for rev in revisions:
        if not isinstance(rev, dict):
            continue
        try:
            idx = int(rev.get("sceneIndex"))
        except (TypeError, ValueError):
            continue
        scene = scenes.get(idx)
        if scene is None or scene.get("kind") in ("handoff", "hardcut"):
            continue
        if rev.get("description"):
            scene["description"] = rev["description"]
        if rev.get("reason"):
            scene["reason"] = rev["reason"]
        if rev.get("visualType"):
            scene["visualType"] = rev["visualType"]
        # Official assetId is not moved by a limitation revision.
        b = by_idx.get(idx) or {"sceneIndex": idx, "assetId": scene.get("assetId"), "worldId": scene.get("worldId")}
        b["objective"] = rev.get("objective") or rev.get("description") or b.get("objective") or scene.get("description") or ""
        b["evidenceBasis"] = rev.get("evidenceBasis") or b.get("evidenceBasis")
        b["toolBasis"] = rev.get("toolBasis") or b.get("toolBasis")
        if rev.get("heldStillOk") is not None:
            b["heldStillOk"] = rev.get("heldStillOk")
        if rev.get("visualType"):
            b["visualType"] = rev["visualType"]
        b["assetId"] = scene.get("assetId") or b.get("assetId")
        by_idx[idx] = b
        for obj in rev.get("customObjects") or []:
            if isinstance(obj, dict):
                obj.setdefault("sceneIndex", idx)
                objects.append(obj)
    bp["sceneBindings"] = [by_idx[k] for k in sorted(by_idx, key=lambda x: (x is None, x))]
    bp["customObjects"] = objects
    plan["customObjects"] = objects


def _still_ids(catalog: list[dict]) -> set[str]:
    return {a["id"] for a in catalog if a.get("kind") in ("image", "photo", "still")}


def _official_still_sites(scenes: list[dict], catalog: list[dict]) -> dict[str, list[dict]]:
    """Map each Director-assigned still to the graphics scenes that officially hold it."""
    stills = _still_ids(catalog)
    sites: dict[str, list[dict]] = {}
    for s in scenes or []:
        if s.get("kind") in ("handoff", "hardcut"):
            continue
        aid = s.get("assetId")
        if aid in stills:
            sites.setdefault(aid, []).append({
                "index": s.get("index"),
                "reuseReason": s.get("reuseReason"),
            })
    return sites


def _assigned_graphics_ids(scenes: list[dict]) -> set[str]:
    return {
        s.get("assetId") for s in scenes
        if s.get("assetId") and s.get("kind") not in ("handoff", "hardcut")
    }


def _restore_official_stills(sites: dict[str, list[dict]], scenes: list[dict]) -> None:
    """Restore official Director stills that production placements dropped.

    This is not a new creative pick and does not fill stills the Director left
    unassigned. A dropped still returns to its original scene when that scene
    is empty or currently holds a repeat that remains assigned elsewhere;
    otherwise it takes the first empty graphics scene.
    """
    if not sites:
        return
    kept = "kept the Director's official assignment; production design omitted this still"
    by_idx = {
        s.get("index"): s for s in scenes
        if s.get("kind") not in ("handoff", "hardcut")
    }

    def assigned() -> set[str]:
        return _assigned_graphics_ids(scenes)

    def counts() -> dict[str, int]:
        c: dict[str, int] = {}
        for s in scenes:
            if s.get("kind") in ("handoff", "hardcut"):
                continue
            aid = s.get("assetId")
            if aid:
                c[aid] = c.get(aid, 0) + 1
        return c

    for aid, locs in sites.items():
        if aid in assigned():
            continue
        restored = False
        for loc in locs:
            s = by_idx.get(loc["index"])
            if s is not None and not s.get("assetId"):
                s["assetId"] = aid
                if loc.get("reuseReason"):
                    s["reuseReason"] = loc["reuseReason"]
                s["assignmentKept"] = kept
                restored = True
                break
        if restored:
            continue
        # Safe evict: original scene now holds a still that remains elsewhere.
        for loc in locs:
            s = by_idx.get(loc["index"])
            if s is None:
                continue
            current = s.get("assetId")
            if current and counts().get(current, 0) > 1:
                s["assetId"] = aid
                if loc.get("reuseReason"):
                    s["reuseReason"] = loc["reuseReason"]
                else:
                    s.pop("reuseReason", None)
                s["assignmentKept"] = kept
                restored = True
                break
        if restored:
            continue
        for s in scenes:
            if s.get("kind") in ("handoff", "hardcut"):
                continue
            if not s.get("assetId"):
                s["assetId"] = aid
                s["assignmentKept"] = kept
                break


def _merge_model_design(plan: dict, story: dict, catalog: list[dict], inventory: list[dict], raw: dict) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    identity = raw.get("identity") if isinstance(raw.get("identity"), dict) else {}
    worlds = raw.get("worlds") if isinstance(raw.get("worlds"), list) else []
    worlds = [w for w in worlds if isinstance(w, dict)]
    for i, w in enumerate(worlds, 1):
        if not w.get("id"):
            w["id"] = f"w{i}"
    _bind_scenes_to_worlds(plan.setdefault("scenes", []), worlds, story)

    official = _official_still_sites(plan.get("scenes") or [], catalog)
    placements = raw.get("assetPlacements") or (raw.get("blueprint") or {}).get("assetPlacements") or []
    assets = {a["id"]: a for a in catalog}
    if isinstance(placements, list):
        for pl in placements:
            if not isinstance(pl, dict):
                continue
            idx, aid = pl.get("sceneIndex"), pl.get("assetId")
            asset = assets.get(aid)
            if not isinstance(idx, int) or not asset:
                continue
            # Graphics scenes may only receive stills. Videos belong on handoff.assetId.
            if asset.get("kind") not in ("image", "photo", "still"):
                continue
            for s in plan["scenes"]:
                if s.get("index") == idx and s.get("kind") not in ("handoff", "hardcut"):
                    s["assetId"] = aid
                    if pl.get("reuseReason"):
                        s["reuseReason"] = pl["reuseReason"]
                    break
    # Restore official Director stills dropped by incomplete placements.
    # Do not deterministically fill leftover stills the Director left unassigned.
    _restore_official_stills(official, plan["scenes"])
    for k, s in enumerate(plan["scenes"]):
        s["index"] = k

    objects = raw.get("customObjects") if isinstance(raw.get("customObjects"), list) else []
    needs = raw.get("missingNeeds") if isinstance(raw.get("missingNeeds"), list) else _missing_needs(plan, inventory, story)
    bindings = _normalize_bindings(raw.get("sceneBindings"), plan["scenes"])

    plan["identity"] = identity
    plan["worlds"] = worlds
    plan["world"] = {
        "name": identity.get("throughLine") or (worlds[0]["name"] if worlds else story.get("title") or "the film"),
        "brief": identity.get("concept") or (worlds[0].get("brief") if worlds else ""),
        "reason": identity.get("concept") or (worlds[0].get("reason") if worlds else "") or "production design for this film",
        "worlds": [w["id"] for w in worlds],
    }
    plan["blueprint"] = {
        "identity": identity,
        "worlds": worlds,
        "inventory": inventory,
        "assetPlacements": [
            {"sceneIndex": s.get("index"), "assetId": s["assetId"], "reason": s.get("reason") or "official assignment",
             "reuseReason": s.get("reuseReason")}
            for s in plan["scenes"] if s.get("assetId")
        ],
        "handoffs": [
            {"sceneIndex": s.get("index"), "assetId": (s.get("handoff") or {}).get("assetId"),
             "inS": (s.get("handoff") or {}).get("inS"), "outS": (s.get("handoff") or {}).get("outS"),
             "audioMode": (s.get("handoff") or {}).get("audioMode") or "clip"}
            for s in plan["scenes"] if s.get("kind") in ("handoff", "hardcut")
        ],
        "customObjects": objects,
        "missingNeeds": needs,
        "sceneBindings": bindings,
        "cameraRoute": raw.get("cameraRoute") or None,
        "cameraRouteReason": raw.get("cameraRouteReason") or None,
        "audioDirection": raw.get("audioDirection") or None,
        "audioDirectionReason": raw.get("audioDirectionReason") or None,
    }
    return finalize_production(plan, story, catalog, inventory)
