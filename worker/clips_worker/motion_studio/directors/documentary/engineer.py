"""Motion Engineer: technical-only translation of an approved blueprint into a scene.

Refactor of the former designer.py scene-code call (spec 7). Creative decisions
live with the Production Designer. This agent prefers registered tools, writes
custom motion_core code only on the Tier 3 extension path, and returns a
structured limitation when a design cannot be built.
"""
from __future__ import annotations

import hashlib
import json

from clips_worker.motion_studio.core import qa
from clips_worker.motion_studio.core.api import API_REFERENCE
from clips_worker.motion_studio.core.probes import final_res_times, probe_times
from clips_worker.motion_studio.core.api_manifest import format_repair, load_manifest
from clips_worker.motion_studio.core.craft import engineer_system
from clips_worker.motion_studio.core.render import SandboxError, probe_stills
from clips_worker.motion_studio.directors.documentary.contracts import extract_limitation
from clips_worker.motion_studio.pipeline import config
from clips_worker.motion_studio.core.output_contracts import StageContractError, format_contract, schema_for, schema_name
from clips_worker.motion_studio.pipeline.llm import LLMError, chat_json
from clips_worker.motion_studio.sandbox.policy import lint_scene
from clips_worker.motion_studio.tools.plan import compile_agent_output
from clips_worker.motion_studio.tools.registry import format_tools_reference

SYSTEM = engineer_system(API_REFERENCE, format_tools_reference()) + "\n\n" + format_contract("motion_engineer")


def code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()[:24]


def measure(res: dict, ctx: dict, probe_h: int) -> tuple[list[dict], list[str]]:
    checks = qa.text_audit(res.get("stills") or [], probe_h) + [qa.empty_background(res.get("stills") or [])]
    problems = [f"{c['id']}: {c['detail']}" for c in checks if not c["pass"]]
    problems += res.get("spotlightLint") or []
    return checks, problems


def api_excerpt_for(problems: list[str], code: str | None = None) -> str:
    """Exact error + offending line + signature + working example, from the API manifest."""
    return format_repair(problems, code)


def approved_candidate(passing, failed):
    """Return the passing candidate only. Failed renders are diagnostics, never approved."""
    return passing


def _catalog_ids(ctx: dict) -> list[str]:
    assets = ctx.get("assets") or {}
    return list(assets)


def _engineer_brief(ctx: dict) -> dict:
    from clips_worker.motion_studio.core.stock import map_catalog
    try:
        caps = {
            "engineSha": load_manifest().get("engineSha"),
            "engineVersion": load_manifest().get("engineVersion"),
        }
    except Exception:  # noqa: BLE001
        caps = {}
    brief = {
        "role": "motion_engineer",
        "blueprint": ctx.get("blueprint") or (ctx.get("scene") or {}).get("blueprint") or {},
        "scene": ctx["scene"],
        "duration": ctx["duration"],
        "durationS": ctx["duration"],
        "fps": int(ctx.get("fps") or 30),
        "durationFrames": int(round(float(ctx["duration"]) * int(ctx.get("fps") or 30))),
        "lines": ctx["lines"],
        "emphasis": ctx["emphasis"],
        "data": ctx["data"],
        "timeAnchors": ctx.get("timeAnchors") or ctx["lines"],
        "assets": {k: {kk: v.get(kk) for kk in ("kind", "w", "h", "description")} for k, v in ctx["assets"].items()},
        "style": ctx.get("style"),
        "engineCapabilities": caps,
        "instruction": (
            "Translate the approved blueprint with registered tools. "
            "Do not rewrite the creative concept or pick random media. "
            "durationS, fps and durationFrames are the exact length of THIS scene after layout/TTS timing. "
            "Express tool timing relative to the scene: startS/endS (seconds from 0), startFrac/endFrac (0..1), "
            "or a line/word anchor. Do not convert to frames; the engine converts from the real duration. "
            "A move or hold that lasts the whole scene uses startS=0 and endS='end' or endFrac=1."
        ),
    }
    # Maps remain available as engine capabilities, not as a world to invent.
    brief["maps"] = map_catalog()
    if ctx["scene"].get("userNotes"):
        brief["userRequest"] = (
            "The user asked for these technical changes to this scene; honor them without changing the approved design: "
            + ctx["scene"]["userNotes"]
        )
    return brief


def _interpret(out: dict, ctx: dict) -> dict:
    return compile_agent_output(
        out,
        scene_id=str((ctx.get("scene") or {}).get("id") or (ctx.get("scene") or {}).get("index") or "scene"),
        catalog_ids=_catalog_ids(ctx),
        duration_s=ctx.get("duration"),
        fps=int((ctx.get("fps") or 30)),
        allow_custom_code=config.custom_code_enabled(),
        camera_intent=(ctx.get("sceneBinding") or {}).get("cameraIntent"),
        required_effects=(ctx.get("sceneBinding") or {}).get("requiredEffects") or [],
        anchors={
            "lines": {
                l["id"]: {"startS": l.get("start"), "endS": l.get("end")}
                for l in (ctx.get("lines") or []) if isinstance(l, dict) and l.get("id")
            },
            "words": [
                {"w": w.get("w"), "s": w.get("s"), "e": w.get("e"), "line": w.get("line")}
                for w in (ctx.get("words") or []) if isinstance(w, dict)
            ],
        },
    )


def design_scene(ctx: dict, scratch: str, assets_dir: str, log, exec_log, *, preflight: bool = False) -> dict:
    """Motion Engineer entry point. Returns a validated scene implementation or a degraded fallback.

    Also returns `limitation` when the approved design cannot be built, so the
    Production Designer can revise the blueprint.
    preflight=True: lint/compile only (no probe, no framework fallback) so a cheap gate can
    fail before any render starts.
    """
    model = config.model_for("motion_engineer")
    code = None
    spec = None
    rounds = 0
    limitation = None
    interpreted = None
    if not config.mock():
        brief = _engineer_brief(ctx)
        try:
            out, m = chat_json("motion_engineer", SYSTEM, json.dumps(brief), max_tokens=14000,
                             schema=schema_for("motion_engineer"), schema_name=schema_name("motion_engineer"))
            log("model_call", f"scene {ctx['scene']['index'] + 1} engineer", m)
            interpreted = _interpret(out, ctx)
            limitation = interpreted.get("limitation")
            code = interpreted.get("code")
            spec = interpreted.get("spec")
            if not interpreted.get("ok") and interpreted.get("errors") and not limitation:
                # Tool/spec errors go into the repair loop as problems, not a silent redesign.
                code = None
        except LLMError as exc:
            log("model_call_failed", f"motion engineer failed: {exc}", {"step": "motion_engineer"})
            code = None
    passing = None
    failed = None
    problems: list[str] = list(
        (f"{e.get('code')}: {e.get('message')}" if isinstance(e, dict) else str(e))
        for e in ((interpreted or {}).get("errors") or [])
    )
    # If the first pass produced tool errors and no code, run a repair on the errors.
    if problems and not code and not limitation and not config.mock():
        code = ""  # enter the loop for a repair round without probing empty code
    while code is not None:
        if not code:
            # First-pass tool errors only — skip lint/probe until we have source.
            failed = {"code": "", "checks": [], "stills": None, "cues": [], "problems": problems, "spec": spec}
        else:
            static = lint_scene(code)
            if static:
                problems = [f"static: {p}" for p in static]
                failed = {"code": code, "checks": [], "stills": None, "cues": [], "problems": problems, "spec": spec}
                exec_log("lint", False, "static_check", "; ".join(problems)[:500], code_hash(code), model, None)
            elif preflight:
                passing = {"code": code, "checks": [], "stills": None, "cues": [],
                           "problems": [], "spec": spec, "tier": (interpreted or {}).get("tier")}
                break
            else:
                try:
                    res = probe_stills(code, ctx, scratch, probe_times(ctx), 960, 540, assets_dir)
                    exec_log("probe", True, None, None, code_hash(code), model, res.get("durationMs"))
                    checks, problems = measure(res, ctx, 540)
                    cand = {"code": code, "checks": checks, "stills": res.get("stills"), "cues": res.get("cues"),
                            "problems": problems, "spec": spec, "tier": (interpreted or {}).get("tier")}
                    if not problems and qa.scene_verdict(checks) == "pass":
                        passing = cand
                        break
                    failed = cand
                except SandboxError as exc:
                    exec_log("probe", False, exc.kind, str(exc), code_hash(code), model, None)
                    trace = list(exc.trace or [])
                    problems = [f"{exc.kind}: {exc}"] + trace
                    failed = {"code": code, "checks": [], "stills": None, "cues": [], "problems": problems,
                              "trace": trace, "spec": spec}
        if passing:
            break
        if limitation:
            break
        if rounds >= config.fix_rounds():
            log("fix_cap", f"scene {ctx['scene']['index'] + 1}: fix cap reached ({rounds}); needs review",
                {"problems": problems[:8]})
            break
        rounds += 1
        try:
            payload = {
                "previous_code": code,
                "previous_spec": spec,
                "problems": problems[:16],
                "traceback": (failed or {}).get("trace") or problems,
                "api": api_excerpt_for(problems + ((failed or {}).get("trace") or []), code or None),
                "instruction": (
                    "Fix ONLY these problems. Prefer corrected tool calls. "
                    "The traceback and API excerpt are complete. Do not change the approved design. "
                    "If the design cannot be implemented, return a structured limitation."
                ),
            }
            out, m = chat_json("scene_fix", SYSTEM, json.dumps(payload), max_tokens=14000,
                           schema=schema_for("motion_engineer"), schema_name=schema_name("motion_engineer"))
            log("model_call", f"scene {ctx['scene']['index'] + 1} engineer fix round {rounds}", m)
            interpreted = _interpret(out, ctx)
            limitation = interpreted.get("limitation")
            if limitation:
                code = None
                break
            if interpreted.get("ok") and interpreted.get("code"):
                code = interpreted["code"]
                spec = interpreted.get("spec")
            elif interpreted.get("errors"):
                problems = [
                    f"{e.get('code')}: {e.get('message')}" if isinstance(e, dict) else str(e)
                    for e in interpreted["errors"]
                ]
                code = ""
            else:
                code = None
        except LLMError as exc:
            log("model_call_failed", f"scene fix failed: {exc}", {"step": "scene_fix"})
            break
    if passing and passing.get("code"):
        result = {
            "code": passing["code"], "codeHash": code_hash(passing["code"]), "model": model, "fixRounds": rounds,
            "usedFallback": False, "checks": passing["checks"], "verdict": qa.scene_verdict(passing["checks"]),
            "cues": passing.get("cues") or [], "tier": passing.get("tier"), "spec": passing.get("spec") or spec,
            "dependencies": (interpreted or {}).get("dependencies") or [],
        }
        return result
    if limitation:
        log("limitation", f"scene {ctx['scene']['index'] + 1}: engineer limitation for Production Designer",
            {"reason": limitation.get("reason")})
        out = {
            "code": None, "codeHash": None, "model": model, "fixRounds": rounds,
            "usedFallback": False, "degraded": True, "degradeCause": "limitation: " + (limitation.get("reason") or ""),
            "checks": [], "verdict": "limitation", "cues": [], "limitation": limitation, "spec": spec,
        }
        return out
    if failed and failed.get("checks") and any(c.get("id") == "A14" and not c.get("pass") for c in failed["checks"]):
        cause = "empty background (A14) after fix rounds"
        log("empty_scene", f"scene {ctx['scene']['index'] + 1}: empty background (A14); not substituting a framework scene",
            {"rounds": rounds})
    elif failed is None:
        cause = "scene implementation never produced a renderable probe"
    elif rounds:
        cause = f"fix cap reached ({rounds})" + (f": {'; '.join((failed.get('problems') or problems)[:2])}" if (failed.get("problems") or problems) else "")
    else:
        cause = "framework fallback"
    log("engineer_failed", f"scene {ctx['scene']['index'] + 1}: {cause} — not substituting a framework scene",
        {"rounds": rounds, "cause": cause, "preflight": preflight})
    out = {"code": None, "codeHash": None, "model": model, "fixRounds": rounds,
           "usedFallback": False, "degraded": True, "degradeCause": cause, "checks": (failed or {}).get("checks") or [],
           "verdict": "failed", "cues": [], "spec": spec}
    if failed and failed.get("code"):
        out["failedCode"] = failed["code"]
        out["failedProblems"] = failed.get("problems") or problems
    return out
