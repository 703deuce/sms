"""#1208 RE-11 Part 2 generator (Motion Designer) + #1206 RE-9 bounded fix loop.

Fresh scene code per scene per video, written against `motion_core` only, executed in the sandbox.
Loop: generate -> probe stills (sandbox) -> measure (text audit A5/A18, A14 coverage, spotlight lint) ->
fix (<= MOTION_STUDIO_FIX_ROUNDS, default 2) -> framework fallback. Measurements decide the verdict.
No TTS / paid media inside the loop; LLM code fixes are capped and logged; never an automatic re-run of
the whole scene after the cap (scene goes to needs_review with the fallback render).
"""
from __future__ import annotations

import hashlib
import json

from clips_worker.motion_studio.core import qa
from clips_worker.motion_studio.core.api import API_REFERENCE
from clips_worker.motion_studio.core.craft import designer_system
from clips_worker.motion_studio.core.fallback import fallback_code
from clips_worker.motion_studio.core.render import SandboxError, probe_stills
from clips_worker.motion_studio.pipeline import config
from clips_worker.motion_studio.pipeline.llm import LLMError, chat_json

SYSTEM = designer_system(API_REFERENCE)


def code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()[:24]


def probe_times(ctx: dict) -> list[float]:
    ts = []
    for l in ctx["lines"]:
        ts.append(min(ctx["duration"] - 0.05, l["start"] + 0.9))
    ts.append(max(0.1, ctx["duration"] - 0.4))
    out = []
    for t in sorted(ts):
        if not out or t - out[-1] > 0.6:
            out.append(round(t, 3))
    return out[:6] or [round(ctx["duration"] / 2, 3)]


def measure(res: dict, ctx: dict, probe_h: int) -> tuple[list[dict], list[str]]:
    checks = qa.text_audit(res.get("stills") or [], probe_h) + [qa.empty_background(res.get("stills") or [])]
    problems = [f"{c['id']}: {c['detail']}" for c in checks if not c["pass"]]
    problems += res.get("spotlightLint") or []
    return checks, problems


def design_scene(ctx: dict, scratch: str, assets_dir: str, log, exec_log) -> dict:
    """Returns {code, codeHash, model, fixRounds, usedFallback, checks, verdict, stills}."""
    model = config.model_for("scene_code")
    code = None
    rounds = 0
    history: list[str] = []
    if config.custom_code_enabled() and not config.mock():
        from clips_worker.motion_studio.core.stock import map_catalog
        brief = {"scene": ctx["scene"], "duration": ctx["duration"], "style": ctx["style"], "lines": ctx["lines"],
                 "emphasis": ctx["emphasis"], "data": ctx["data"],
                 "world": (ctx.get("scene") or {}).get("world"),
                 "maps": map_catalog(),
                 "assets": {k: {kk: v.get(kk) for kk in ("kind", "w", "h", "description")} for k, v in ctx["assets"].items()}}
        if ctx["scene"].get("userNotes"):
            brief["userRequest"] = ("The user asked for these changes to this scene; honor them within the house rules: "
                                    + ctx["scene"]["userNotes"])
        try:
            out, m = chat_json("scene_code", SYSTEM, json.dumps(brief), max_tokens=14000)
            code = str(out.get("code") or "")
            log("model_call", f"scene {ctx['scene']['index'] + 1} code", m)
        except LLMError as exc:
            log("model_call_failed", f"scene code generation failed: {exc}", {"step": "scene_code"})
            code = None
    best = None
    while code:
        try:
            res = probe_stills(code, ctx, scratch, probe_times(ctx), 960, 540, assets_dir)
            exec_log("probe", True, None, None, code_hash(code), model, res.get("durationMs"))
            checks, problems = measure(res, ctx, 540)
            best = {"code": code, "checks": checks, "stills": res.get("stills"), "cues": res.get("cues")}
            if not problems:
                break
        except SandboxError as exc:
            exec_log("probe", False, exc.kind, str(exc), code_hash(code), model, None)
            problems = [f"{exc.kind}: {exc}"] + exc.trace
            best = None
        if rounds >= config.fix_rounds():
            log("fix_cap", f"scene {ctx['scene']['index'] + 1}: fix cap reached ({rounds}); needs review", {"problems": problems[:6]})
            break
        rounds += 1
        history.append("; ".join(problems)[:1500])
        try:
            out, m = chat_json("scene_fix", SYSTEM, json.dumps({"previous_code": code, "problems": problems[:12],
                                                                 "instruction": "Fix ONLY these problems. Return the full corrected code."}),
                               max_tokens=14000)
            log("model_call", f"scene {ctx['scene']['index'] + 1} fix round {rounds}", m)
            code = str(out.get("code") or "") or None
        except LLMError as exc:
            log("model_call_failed", f"scene fix failed: {exc}", {"step": "scene_fix"})
            break
    if best and best["code"]:
        verdict = qa.scene_verdict(best["checks"])
        return {"code": best["code"], "codeHash": code_hash(best["code"]), "model": model, "fixRounds": rounds,
                "usedFallback": False, "checks": best["checks"], "verdict": verdict, "cues": best.get("cues") or []}
    fb = fallback_code(ctx)
    res = probe_stills(fb, ctx, scratch, probe_times(ctx), 960, 540, assets_dir)
    checks, _ = measure(res, ctx, 540)
    exec_log("probe", True, None, None, code_hash(fb), "framework", res.get("durationMs"))
    log("fallback", f"scene {ctx['scene']['index'] + 1}: framework fallback scene",
        {"rounds": rounds, "world": (ctx.get("scene") or {}).get("world")})
    return {"code": fb, "codeHash": code_hash(fb), "model": "framework", "fixRounds": rounds,
            "usedFallback": True, "checks": checks, "verdict": qa.scene_verdict(checks), "cues": res.get("cues") or []}
