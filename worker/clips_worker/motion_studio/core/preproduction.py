"""Versioned preproduction artifacts: identity package, storyboard, acquisition
plan, credit estimates, checkpoints, and the whole-film QA report.

These helpers are deterministic and write no Python, render output, or database
rows. Pipeline and Production Designer both import them from core (never the
reverse).
"""
from __future__ import annotations

from datetime import datetime, timezone

CONTRACT_VERSION = "1.0"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")



def music_brief(plan: dict | None, story: dict | None = None) -> str:
    """Score follows the identity and environment brief, not a world-type menu."""
    plan = plan or {}
    story = story or {}
    parts: list[str] = []
    ident = plan.get("identity") or plan.get("identityPackage") or {}
    for key in ("mood", "throughLine", "concept", "cameraPersonality", "storytellingApproach"):
        val = ident.get(key)
        if val:
            parts.append(str(val))
    world = plan.get("world")
    if isinstance(world, dict):
        parts.append(str(world.get("brief") or world.get("name") or world.get("reason") or ""))
        # Deliberately ignore world["type"] — that is a leftover menu label.
    for env in plan.get("worlds") or []:
        if isinstance(env, dict):
            parts.append(str(env.get("brief") or env.get("name") or ""))
    if story.get("tone"):
        parts.append(str(story["tone"]))
    return " ".join(p for p in parts if p).strip()[:400]



def validate_creative_plan(plan: dict | None, story: dict | None = None, catalog: list[dict] | None = None) -> list[str]:
    """Creative-plan validation that goes beyond structure, used before render.

    Editorial plans (pre-Production Designer) only get light checks. Once a
    blueprint or identity package is attached, identity, environments, storyboard,
    asset usage and a credits estimate are required.
    """
    plan = plan or {}
    errs: list[str] = []
    world = plan.get("world") if isinstance(plan.get("world"), dict) else {}
    produced = bool(plan.get("identityPackage") or plan.get("storyboard") or plan.get("productionSource"))
    if produced:
        ident = plan.get("identity") or plan.get("identityPackage") or {}
        if not (ident.get("typography") or ident.get("concept") or ident.get("throughLine") or ident.get("cameraPersonality")):
            errs.append("identity package is missing typography, concept, through-line or camera personality")
        worlds = plan.get("worlds") or (plan.get("blueprint") or {}).get("worlds") or []
        if not worlds and not (world.get("brief") or world.get("name") or ident.get("throughLine")):
            errs.append("no story-driven environment brief")
        review = plan.get("storyboardReview") or {}
        if plan.get("storyboard") and review.get("status") == "needs_review":
            errs.append("storyboard needs review before render")
        if plan.get("costEstimate") is None:
            errs.append("plan is missing a credits estimate")
        elif str((plan.get("costEstimate") or {}).get("unit") or "").lower() not in ("", "credits"):
            errs.append("cost estimate must be in credits, never currency")
        manifest = plan.get("assetUsageManifest") or (plan.get("blueprint") or {}).get("assetUsageManifest")
        if catalog and manifest is None and not (plan.get("blueprint") or {}).get("assetPlacements"):
            errs.append("plan is missing an asset usage manifest")
    # A type-only world with no brief is a leftover menu pick — flag it when we have a chance to rewrite.
    if world.get("type") and not (world.get("brief") or world.get("name") or world.get("reason")):
        errs.append("world has a type label but no story brief")
    return errs


def identity_package(plan: dict | None, story: dict | None = None) -> dict:
    """Reusable, persistent, versioned visual-identity package for a project."""
    plan = plan or {}
    story = story or {}
    ident = dict(plan.get("identity") or (plan.get("blueprint") or {}).get("identity") or {})
    existing = dict(plan.get("identityPackage") or {})
    version = int(existing.get("packageVersion") or existing.get("version") or 0) + (0 if existing else 1)
    if existing and existing.get("typography") == (ident.get("typography") or existing.get("typography")):
        version = int(existing.get("packageVersion") or 1)
    elif existing:
        version = int(existing.get("packageVersion") or 1) + 1
    pkg = {
        "contractVersion": CONTRACT_VERSION,
        "packageVersion": max(1, version),
        "updatedAt": _now(),
        "typography": ident.get("typography") or existing.get("typography") or {},
        "materials": ident.get("materials") or existing.get("materials") or [],
        "palette": ident.get("palette") or existing.get("palette") or (plan.get("style") or {}).get("palette") or {},
        "cameraPersonality": ident.get("cameraPersonality") or existing.get("cameraPersonality"),
        "motifs": ident.get("motifs") or existing.get("motifs") or [],
        "throughLine": ident.get("throughLine") or existing.get("throughLine") or ident.get("concept") or story.get("title"),
        "concept": ident.get("concept") or existing.get("concept"),
        "pacing": ident.get("pacing") or existing.get("pacing"),
        "lighting": ident.get("lighting") or existing.get("lighting"),
        "treatments": ident.get("treatments") or ident.get("inventedTreatments") or existing.get("treatments") or [],
        "transitionLanguage": ident.get("transitionLanguage") or existing.get("transitionLanguage"),
        "storytellingApproach": ident.get("storytellingApproach") or ident.get("approach") or existing.get("storytellingApproach"),
    }
    # Creative state tree used for inheritance and selective regen.
    pkg["state"] = {
        "filmIdentity": pkg["throughLine"],
        "sequences": [c.get("id") or c.get("title") for c in (story.get("chapters") or plan.get("chapters") or [])],
        "environments": [
            (w.get("id") if isinstance(w, dict) else w)
            for w in (plan.get("worlds") or [])
        ],
        "scenes": [(s.get("id") or s.get("index")) for s in (plan.get("scenes") or [])],
    }
    return pkg


def _scene_environment(scene: dict, plan: dict) -> dict:
    worlds = {w.get("id"): w for w in (plan.get("worlds") or []) if isinstance(w, dict)}
    wid = scene.get("worldId") or (scene.get("world") or {}).get("id") if isinstance(scene.get("world"), dict) else scene.get("worldId")
    env = worlds.get(wid) if wid else None
    if env:
        return {"id": env.get("id"), "name": env.get("name"), "brief": env.get("brief")}
    world = scene.get("world") or plan.get("world") or {}
    if isinstance(world, dict):
        return {"id": world.get("id") or world.get("name"), "name": world.get("name"), "brief": world.get("brief")}
    return {"id": None, "name": str(world) if world else None, "brief": None}


def _scene_media(scene: dict, manifest: dict) -> list[dict]:
    wanted = {scene.get("assetId")}
    h = scene.get("handoff") or {}
    if isinstance(h, dict) and h.get("assetId"):
        wanted.add(h["assetId"])
    out = []
    for entry in manifest.get("entries") or []:
        uses = entry.get("usedIn") or []
        if entry.get("assetId") in wanted or any(
            (u.get("sceneIndex") == scene.get("index") or u.get("sceneId") == scene.get("id")) for u in uses
        ):
            out.append({
                "assetId": entry.get("assetId"),
                "role": entry.get("role"),
                "subject": entry.get("subject"),
                "reuseReason": entry.get("reuseReason"),
            })
    if not out and scene.get("assetId"):
        out.append({"assetId": scene["assetId"], "role": scene.get("visualType"), "subject": None, "reuseReason": scene.get("reuseReason")})
    return out


def build_storyboard(plan: dict | None, story: dict | None = None) -> dict:
    """Low-cost storyboard of the intended design for every scene, from the blueprint.

    Deterministic: no paid model call. Actual media selections, camera intent,
    environment and on-screen text are taken from the approved blueprint.
    """
    plan = plan or {}
    story = story or {}
    manifest = plan.get("assetUsageManifest") or (plan.get("blueprint") or {}).get("assetUsageManifest") or {}
    camera = (plan.get("blueprint") or {}).get("cameraPlan") or {}
    frames = []
    for scene in plan.get("scenes") or []:
        env = _scene_environment(scene, plan)
        media = _scene_media(scene, manifest)
        frames.append({
            "sceneId": scene.get("id"),
            "index": scene.get("index"),
            "lineId": scene.get("lineId"),
            "line": scene.get("lineText") or scene.get("description") or scene.get("reason") or "",
            "visualType": scene.get("visualType"),
            "environment": env,
            "media": media,
            "camera": scene.get("camera") or camera.get("personality") or camera.get("route"),
            "composition": scene.get("composition") or (plan.get("blueprint") or {}).get("composition"),
            "transition": (scene.get("handoff") or {}).get("exitStyle") or (scene.get("transition") if isinstance(scene.get("transition"), str) else None),
            "heldStillOk": bool(scene.get("heldStillOk") or scene.get("visualType") == "photo"),
            "original": None if media else (scene.get("missingNeed") or "original illustration or typography for this beat"),
        })
    return {
        "contractVersion": CONTRACT_VERSION,
        "status": "draft",
        "source": "blueprint",
        "updatedAt": _now(),
        "frames": frames,
        "title": story.get("title") or plan.get("title"),
    }


def review_storyboard(storyboard: dict | None, plan: dict | None = None) -> dict:
    """Preproduction review: every scene has an environment, a camera intent, and media or a justified original."""
    frames = (storyboard or {}).get("frames") or []
    issues = []
    for frame in frames:
        if not (frame.get("environment") or {}).get("name") and not (frame.get("environment") or {}).get("brief"):
            issues.append({"index": frame.get("index"), "kind": "environment", "detail": "storyboard frame is missing an environment"})
        if not frame.get("media") and not frame.get("original"):
            issues.append({"index": frame.get("index"), "kind": "media", "detail": "no media selection and no justified original"})
        if not frame.get("camera"):
            issues.append({"index": frame.get("index"), "kind": "camera", "detail": "camera intent is missing"})
    status = "approved" if frames and not issues else ("needs_review" if issues else "draft")
    return {
        "pass": bool(frames) and not issues,
        "status": status,
        "issues": issues,
        "frames": len(frames),
        "contractVersion": CONTRACT_VERSION,
    }


def acquisition_plan(plan: dict | None, story: dict | None = None) -> dict:
    """Per-chapter visual-asset acquisition plan: what exists, what must be created."""
    plan = plan or {}
    inventory = (plan.get("blueprint") or {}).get("inventory") or []
    manifest = plan.get("assetUsageManifest") or (plan.get("blueprint") or {}).get("assetUsageManifest") or {}
    missing = (plan.get("blueprint") or {}).get("missingNeeds") or []
    chapters = []
    ch_rows = story.get("chapters") if story else plan.get("chapters")
    if not ch_rows:
        # Derive chapters from scene chapter ids if present.
        seen = []
        for s in plan.get("scenes") or []:
            cid = s.get("chapterId") or s.get("chapter") or "film"
            if cid not in seen:
                seen.append(cid)
        ch_rows = [{"id": c, "title": str(c)} for c in seen] or [{"id": "film", "title": (story or {}).get("title") or "the film"}]
    used_ids = {e.get("assetId") for e in (manifest.get("entries") or []) if e.get("usedIn")}
    for ch in ch_rows:
        cid = ch.get("id") if isinstance(ch, dict) else ch
        title = (ch.get("title") if isinstance(ch, dict) else None) or str(cid)
        scene_rows = [s for s in (plan.get("scenes") or []) if (s.get("chapterId") or s.get("chapter") or "film") == cid
                      or not s.get("chapterId") and cid in ("film", ch_rows[0].get("id") if isinstance(ch_rows[0], dict) else ch_rows[0])]
        have = []
        for s in scene_rows:
            if s.get("assetId"):
                have.append({"assetId": s["assetId"], "sceneIndex": s.get("index")})
            h = s.get("handoff") or {}
            if isinstance(h, dict) and h.get("assetId"):
                have.append({"assetId": h["assetId"], "sceneIndex": s.get("index"), "kind": "footage"})
        chapters.append({
            "chapterId": cid,
            "title": title,
            "have": have,
            "needCreated": [m for m in missing if not scene_rows or m.get("chapterId") in (None, cid)],
        })
    return {
        "contractVersion": CONTRACT_VERSION,
        "existing": [i.get("id") or i.get("assetId") for i in inventory],
        "used": sorted(x for x in used_ids if x),
        "unused": list(manifest.get("unused") or []),
        "missingNeeds": missing,
        "chapters": chapters,
        "policy": "uploads_only: do not automatically acquire new stock in this phase; missing needs are original illustrations or typography.",
    }


def estimate_credits(plan: dict | None, settings: dict | None = None, story: dict | None = None) -> dict:
    """Rough production cost in credits (never currency) before production proceeds.

    Prefers cheaper treatments: generated score over paid music, iteration at
    480p, registered tools over a custom-code pass when the design allows it.
    """
    plan = plan or {}
    settings = settings or {}
    scenes = plan.get("scenes") or []
    n = max(1, len(scenes))
    duration_s = 0.0
    layout = plan.get("layout") or {}
    if layout.get("durationS"):
        duration_s = float(layout["durationS"])
    else:
        duration_s = float(settings.get("lengthMin") or 3) * 60
    minutes = max(1.0, duration_s / 60)
    voice = settings.get("voiceover") or "ai"
    music = settings.get("music") or plan.get("musicSource") or "generated"
    render_label = str(settings.get("renderSize") or settings.get("resolution") or "480p")

    breakdown = [
        {"id": "direction", "label": "Story and Film Director", "credits": 2, "paidModel": True},
        {"id": "production_design", "label": "Production Designer blueprint", "credits": 2, "paidModel": True},
        {"id": "storyboard", "label": "Storyboard (deterministic pre-review)", "credits": 0, "paidModel": False},
        {"id": "engineering", "label": "Motion Engineer (one pass per scene)", "credits": n, "paidModel": True},
        {"id": "narration", "label": "AI narration" if voice == "ai" else "Your narration (uploaded)" if voice == "upload" else "No narration",
         "credits": int(round(minutes)) if voice == "ai" else 0, "paidModel": voice == "ai"},
        {"id": "music", "label": "Generated music" if music == "elevenlabs" else "Your music" if music in ("upload", "user") else "No music" if music == "none" else "Score generated from the story beats",
         "credits": 3 if music == "elevenlabs" else 0, "paidModel": music == "elevenlabs"},
        {"id": "render", "label": f"Render, mix and QA at {render_label}",
         "credits": max(1, int(round(minutes * (2 if "1080" in render_label or "2160" in render_label or "4k" in render_label else 1)))),
         "paidModel": False},
    ]
    total = int(sum(item["credits"] for item in breakdown))
    return {
        "unit": "credits",
        "currency": "credits",
        "total": total,
        "breakdown": breakdown,
        "scenes": n,
        "minutes": round(minutes, 2),
        "note": "Estimates are in credits, never currency. Cheaper treatments are preferred; paid music and custom-code passes are opt-in.",
    }


def record_checkpoint(plan: dict | None, stage: str, artifacts: dict | None = None) -> list[dict]:
    """Append a versioned long-form checkpoint to the plan and return the list."""
    plan = plan if isinstance(plan, dict) else {}
    rows = list(plan.get("checkpoints") or [])
    rows.append({
        "stage": stage,
        "at": _now(),
        "version": len(rows) + 1,
        "artifacts": artifacts or {},
    })
    plan["checkpoints"] = rows
    return rows


def creative_report(plan: dict | None, scenes: list[dict] | None, review: dict | None, checks: list[dict] | None) -> dict:
    """Detailed production-quality report: technical and creative quality separately."""
    checks = list(checks or [])
    scenes = list(scenes or [])
    review = review or {}
    degraded = [s for s in scenes if s.get("usedFallback") or (s.get("qa") or {}).get("degraded")]
    technical_pass = all(c.get("pass") or c.get("severity") == "warn" for c in checks) and not degraded
    creative_pass = bool(review.get("pass", True)) and technical_pass
    manifest = (plan or {}).get("assetUsageManifest") or {}
    return {
        "contractVersion": CONTRACT_VERSION,
        "technical": {"pass": technical_pass, "checks": [c.get("id") for c in checks], "degradedScenes": [s.get("index") for s in degraded]},
        "creative": {"pass": creative_pass, "review": review.get("status") or ("pass" if review.get("pass") else "needs_review"),
                     "issues": review.get("issues") or review.get("requests") or []},
        "assets": {
            "used": [e.get("assetId") for e in (manifest.get("entries") or [])],
            "unused": list(manifest.get("unused") or []),
            "repeats": manifest.get("repeats") or [],
        },
        "storyboard": (plan or {}).get("storyboardReview") or {},
        "identityPackageVersion": ((plan or {}).get("identityPackage") or {}).get("packageVersion"),
    }
