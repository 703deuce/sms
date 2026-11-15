"""Cheap pre-flight gate: validate story/plan/design and lint/compile every scene spec.

Renders must not start until this returns fully green. Scene implementations
produced here are stored on the scene row so render jobs reuse them (no second
paid engineer call).
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from clips_worker.motion_studio.core.designer_capabilities import assets_in_hand
from clips_worker.motion_studio.core.output_contracts import StageContractError, validate_story


def run_preflight(conn, proj: dict, work: str, log, *, prepare_photos, assets_dir, scratch_dir_fn,
                  scene_context_fn, render_hash_fn, upload_file, work_key: str, design_scene,
                  exec_log, catalog: list | None = None, validate_plan=None, validate_blueprint=None,
                  revise_limited_scenes=None, db_mod=None) -> dict:
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
    for err in validate_story(story, catalog=catalog):
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

    if db_mod is not None:
        db = db_mod
    else:
        from clips_worker.motion_studio.pipeline import db as _db_default
        db = _db_default
    lay = plan.get("layout") or {}
    rows = {r["index"]: r for r in db.scenes(conn, pid)}
    assets_meta = prepare_photos(conn, proj, work)
    ad = assets_dir(work)
    seed = int(hashlib.sha256(pid.encode()).hexdigest()[:6], 16)
    def _persist(sc, row, d):
        code = d.get("code")
        static = lint_scene(code)
        if static:
            msg = f"scene {sc.get('index')}: lint failed: " + "; ".join(static[:6])
            errors.append(msg)
            degradations.append({"stage": "motion_engineer", "sceneIndex": sc.get("index"), "errors": static})
            return False
        chash = d.get("codeHash") or hashlib.sha256(code.encode()).hexdigest()[:24]
        ck = f"{work_key}/generated/scene_{sc['index']:03d}_{chash}.py"
        cp = Path(work) / f"scene_{sc['index']:03d}.py"
        cp.write_text(code)
        upload_file(ck, cp, "text/x-python")
        qa_blob = {
            "checks": d.get("checks") or [],
            "verdict": d.get("verdict") or "preflight",
            "preflight": True,
            "ctxHash": render_hash_fn(ctx_by_index[sc["index"]]),
        }
        if d.get("spec"):
            qa_blob["spec"] = d.get("spec")
        if d.get("tier") is not None:
            qa_blob["tier"] = d.get("tier")
        db.update_scene(conn, row["id"], codeKey=ck, codeHash=chash, model=d.get("model"),
                        fixRounds=d.get("fixRounds") or 0, usedFallback=False, qa=qa_blob, status="preflight")
        return True

    def _design(sc, row):
        ctx = scene_context_fn(sc, lay, story, plan, assets_meta, seed)
        ctx_by_index[sc["index"]] = ctx
        sdir = scratch_dir_fn(f"ms_pf_{pid[-8:]}_{sc['index']}_")
        try:
            d = design_scene(ctx, sdir, ad, log, exec_log, preflight=True)
        except Exception as exc:  # noqa: BLE001 — collect all scene failures, then fail the gate
            msg = f"scene {sc.get('index')}: {type(exc).__name__}: {exc}"
            return "error", msg, {"stage": "motion_engineer", "sceneIndex": sc.get("index"), "errors": [msg]}, None
        lim = d.get("limitation") if isinstance(d.get("limitation"), dict) else None
        is_lim = bool(lim) or d.get("verdict") == "limitation"
        if is_lim:
            cause = d.get("degradeCause") or (lim or {}).get("reason") or "scene failed lint/compile"
            payload = {
                "sceneIndex": sc.get("index"),
                "reason": cause,
                "missingTools": (lim or {}).get("missingTools") or [],
                "missingAssets": (lim or {}).get("missingAssets") or [],
                "unblock": (lim or {}).get("unblock") or "",
                "assetId": sc.get("assetId") or ((sc.get("handoff") or {}).get("assetId") if isinstance(sc.get("handoff"), dict) else None),
                "limitation": lim or d.get("limitation"),
            }
            return "limitation", cause, {"stage": "motion_engineer", "sceneIndex": sc.get("index"),
                                         "errors": [cause], "problems": d.get("failedProblems") or []}, payload, d
        if not d.get("code") or d.get("degraded") or d.get("usedFallback") or d.get("verdict") in {"failed", "degraded"}:
            cause = d.get("degradeCause") or "scene failed lint/compile"
            msg = f"scene {sc.get('index')}: {cause}"
            return "error", msg, {"stage": "motion_engineer", "sceneIndex": sc.get("index"),
                                  "errors": [cause], "problems": d.get("failedProblems") or []}, None
        return "ok", d, None, None

    ctx_by_index: dict = {}
    graphics = 0
    pending: list[dict] = []
    for sc in lay.get("scenes") or []:
        row = rows.get(sc.get("index"))
        if not row:
            errors.append(f"scene {sc.get('index')}: missing scene row")
            continue
        if sc.get("kind") in ("handoff", "hardcut"):
            h = dict(sc.get("handoff") or {})
            asset = next((a for a in assets_in_hand(catalog) if a.get("id") == h.get("assetId")), None)
            if not asset or asset.get("kind") != "video":
                msg = f"scene {sc.get('index')}: handoff references a missing video asset"
                errors.append(msg)
                degradations.append({"stage": "handoff", "sceneIndex": sc.get("index"), "errors": [msg]})
            continue
        graphics += 1
        status, *rest = _design(sc, row)
        if status == "ok":
            _persist(sc, row, rest[0])
        elif status == "limitation":
            cause, deg, payload, _d = rest
            pending.append({"sc": sc, "row": row, "payload": payload, "cause": cause, "deg": deg})
        else:
            msg, deg, _ = rest
            errors.append(msg)
            if deg:
                degradations.append(deg)

    revised_scenes: list = []
    production_revisions = 0
    if pending and revise_limited_scenes:
        payloads = [p["payload"] for p in pending]
        log("preflight_revision", f"routing {len(payloads)} engineer limitation(s) to a targeted Production Designer revision",
            {"scenes": [p.get("sceneIndex") for p in payloads]})
        try:
            plan = revise_limited_scenes(proj, story, catalog, plan, payloads, log)
            proj["plan"] = plan
            production_revisions = 1
            revised_scenes = [p.get("sceneIndex") for p in payloads]
        except StageContractError as exc:
            for e in exc.errors:
                errors.append(f"production revision: {e}")
            degradations.append({"stage": "production_designer", "errors": list(exc.errors)})
        else:
            still = []
            for item in pending:
                sc, row = item["sc"], item["row"]
                status, *rest = _design(sc, row)
                if status == "ok":
                    _persist(sc, row, rest[0])
                elif status == "limitation":
                    cause, deg, payload, _d = rest
                    errors.append(f"scene {sc.get('index')}: {cause}")
                    if deg:
                        degradations.append(deg)
                    still.append(payload)
                else:
                    msg, deg, _ = rest
                    errors.append(msg)
                    if deg:
                        degradations.append(deg)
            pending = still
    elif pending:
        for item in pending:
            errors.append(f"scene {item['sc'].get('index')}: {item['cause']}")
            if item.get("deg"):
                degradations.append(item["deg"])

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
        "productionRevisions": production_revisions,
        "revisedScenes": revised_scenes,
    }
    if production_revisions:
        report["plan"] = plan
        db.update_project(conn, pid, plan=plan)
    if errors:
        log("preflight_failed", f"pre-flight failed on {len(errors)} check(s); render will not start",
            {k: report[k] for k in ("errors", "graphics", "handoffs", "planSource", "productionSource")})
        raise StageContractError("preflight", errors)
    log("preflight_ok", f"pre-flight green: {graphics} graphics scenes linted, {handoffs} handoffs checked; render may start",
        {k: report[k] for k in ("graphics", "handoffs", "scenes", "planSource", "productionSource", "repaired", "assignedAssetCount", "catalogCount")})
    return report
