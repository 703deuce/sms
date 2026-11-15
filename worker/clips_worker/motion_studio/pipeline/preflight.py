"""Cheap pre-flight gate: validate story/plan/design and lint/compile every scene spec.

Renders must not start until this returns fully green. Scene implementations
produced here are stored on the scene row so render jobs reuse them (no second
paid engineer call).
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from clips_worker.motion_studio.core.output_contracts import StageContractError, validate_story


def run_preflight(conn, proj: dict, work: str, log, *, prepare_photos, assets_dir, scratch_dir_fn,
                  scene_context_fn, render_hash_fn, upload_file, work_key: str, design_scene,
                  exec_log, catalog: list | None = None, validate_plan=None, validate_blueprint=None) -> dict:
    """Validate contracts and dry-run compile/lint every graphics scene.

    Handoff scenes are checked for a real video asset id but are not rendered.
    Returns {ok, errors, degradations}. Raises StageContractError if not green.
    """
    from clips_worker.motion_studio.sandbox.policy import lint_scene
    pid = proj["id"]
    story, plan = proj.get("story") or {}, proj.get("plan") or {}
    if catalog is None:
        from clips_worker.motion_studio.pipeline import db as _db
        catalog = list(_db.assets(conn, pid))
    errors: list[str] = []
    degradations: list[dict] = []

    log("preflight", "starting pre-flight (story, plan, design, lint/compile)", {})
    for err in validate_story(story):
        errors.append(f"story: {err}")
    if validate_plan and isinstance(story, dict) and isinstance(story.get("lines"), list):
        for err in validate_plan(plan, story, catalog):
            errors.append(f"plan: {err}")
    elif not any(e.startswith("story:") for e in errors):
        errors.append("story: story must include narration lines")
    if validate_blueprint:
        for err in validate_blueprint(plan.get("blueprint")):
            errors.append(f"blueprint: {err}")
    if (plan.get("source") or "") == "fallback" or (plan.get("productionSource") or "") == "fallback":
        errors.append("plan: a fallback/deterministic substitute was used; test runs must not ship that")

    if errors:
        log("preflight_failed", "pre-flight failed contract validation", {"errors": errors[:16]})
        raise StageContractError("preflight", errors)

    from clips_worker.motion_studio.pipeline import db
    lay = plan.get("layout") or {}
    rows = {r["index"]: r for r in db.scenes(conn, pid)}
    assets_meta = prepare_photos(conn, proj, work)
    ad = assets_dir(work)
    seed = int(hashlib.sha256(pid.encode()).hexdigest()[:6], 16)
    graphics = 0
    for sc in lay.get("scenes") or []:
        row = rows.get(sc.get("index"))
        if not row:
            errors.append(f"scene {sc.get('index')}: missing scene row")
            continue
        if sc.get("kind") in ("handoff", "hardcut"):
            h = dict(sc.get("handoff") or {})
            asset = next((a for a in catalog if a.get("id") == h.get("assetId")), None)
            if not asset or asset.get("kind") != "video":
                msg = f"scene {sc.get('index')}: handoff references a missing video asset"
                errors.append(msg)
                degradations.append({"stage": "handoff", "sceneIndex": sc.get("index"), "errors": [msg]})
            continue
        graphics += 1
        ctx = scene_context_fn(sc, lay, story, plan, assets_meta, seed)
        sdir = scratch_dir_fn(f"ms_pf_{pid[-8:]}_{sc['index']}_")
        try:
            d = design_scene(ctx, sdir, ad, log, exec_log, preflight=True)
        except Exception as exc:  # noqa: BLE001 — collect all scene failures, then fail the gate
            msg = f"scene {sc.get('index')}: {type(exc).__name__}: {exc}"
            errors.append(msg)
            degradations.append({"stage": "motion_engineer", "sceneIndex": sc.get("index"), "errors": [msg]})
            continue
        code = d.get("code")
        if not code or d.get("degraded") or d.get("usedFallback") or d.get("limitation") or d.get("verdict") in {"failed", "limitation", "degraded"}:
            cause = d.get("degradeCause") or (d.get("limitation") or {}).get("reason") or "scene failed lint/compile"
            msg = f"scene {sc.get('index')}: {cause}"
            errors.append(msg)
            degradations.append({"stage": "motion_engineer", "sceneIndex": sc.get("index"),
                                 "errors": [cause], "problems": d.get("failedProblems") or []})
            continue
        static = lint_scene(code)
        if static:
            msg = f"scene {sc.get('index')}: lint failed: " + "; ".join(static[:6])
            errors.append(msg)
            degradations.append({"stage": "motion_engineer", "sceneIndex": sc.get("index"), "errors": static})
            continue
        chash = d.get("codeHash") or hashlib.sha256(code.encode()).hexdigest()[:24]
        ck = f"{work_key}/generated/scene_{sc['index']:03d}_{chash}.py"
        cp = Path(work) / f"scene_{sc['index']:03d}.py"
        cp.write_text(code)
        upload_file(ck, cp, "text/x-python")
        qa_blob = {
            "checks": d.get("checks") or [],
            "verdict": d.get("verdict") or "preflight",
            "preflight": True,
            "ctxHash": render_hash_fn(ctx),
        }
        if d.get("spec"):
            qa_blob["spec"] = d.get("spec")
        if d.get("tier") is not None:
            qa_blob["tier"] = d.get("tier")
        db.update_scene(conn, row["id"], codeKey=ck, codeHash=chash, model=d.get("model"),
                        fixRounds=d.get("fixRounds") or 0, usedFallback=False, qa=qa_blob, status="preflight")

    handoffs = sum(1 for sc in (lay.get("scenes") or []) if sc.get("kind") in ("handoff", "hardcut"))
    assigned = {s.get("assetId") for s in (plan.get("scenes") or []) if s.get("assetId")}
    assigned |= {((s.get("handoff") or {}).get("assetId")) for s in (plan.get("scenes") or []) if (s.get("handoff") or {}).get("assetId")}
    report = {
        "ok": not errors,
        "errors": errors,
        "degradations": degradations,
        "graphics": graphics,
        "handoffs": handoffs,
        "scenes": len(lay.get("scenes") or []),
        "planSource": plan.get("source"),
        "productionSource": plan.get("productionSource"),
        "repaired": (plan.get("source") == "model_repaired") or bool(plan.get("repaired")),
        "assignedAssetCount": len({x for x in assigned if x}),
        "catalogCount": len(catalog or []),
    }
    if errors:
        log("preflight_failed", f"pre-flight failed on {len(errors)} check(s); render will not start",
            {k: report[k] for k in ("errors", "graphics", "handoffs", "planSource", "productionSource")})
        raise StageContractError("preflight", errors)
    log("preflight_ok", f"pre-flight green: {graphics} graphics scenes linted, {handoffs} handoffs checked; render may start",
        {k: report[k] for k in ("graphics", "handoffs", "scenes", "planSource", "productionSource", "repaired", "assignedAssetCount", "catalogCount")})
    return report
