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
from clips_worker.motion_studio.core.api import API_PITFALLS, API_REFERENCE
from clips_worker.motion_studio.core.craft import designer_system
from clips_worker.motion_studio.core.fallback import fallback_code
from clips_worker.motion_studio.core.render import SandboxError, probe_stills
from clips_worker.motion_studio.pipeline import config
from clips_worker.motion_studio.pipeline.llm import LLMError, chat_json
from clips_worker.motion_studio.sandbox.policy import lint_scene

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



def api_excerpt_for(problems: list[str]) -> str:
    """Return the sandbox contract plus any API slices that match the reported problems."""
    blob = " ".join(problems).lower()
    chunks = [API_PITFALLS.strip()]
    # Pull short, relevant lines from the full reference when a specific symbol is named.
    needles = []
    if "stringline" in blob or "rgb" in blob:
        needles.append("StringLine")
    if "drawroundrect" in blob or "rrect" in blob or "arity" in blob:
        needles.append("rrect")
        needles.append("drawRoundRect")
    if "palette" in blob or "dark_line" in blob or "ctx.rgb" in blob:
        needles.append("palette")
    if "spotlight" in blob or "0.25" in blob:
        needles.append("spotlight")
        needles.append("shot(")
    if needles:
        lines = API_REFERENCE.splitlines()
        picked = []
        for i, line in enumerate(lines):
            low = line.lower()
            if any(n.lower() in low for n in needles):
                picked.extend(lines[max(0, i - 1): i + 2])
        if picked:
            # de-dupe adjacent repeats
            out, last = [], None
            for ln in picked:
                if ln != last:
                    out.append(ln)
                    last = ln
            chunks.append("Relevant API excerpt:\n" + "\n".join(out[:40]))
    return "\n\n".join(chunks)


def approved_candidate(passing, failed):
    """Return the passing candidate only. Failed renders are diagnostics, never approved."""
    return passing

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
    passing = None  # last candidate that passed every measurement
    failed = None   # latest renderable-but-failing (or un-runnable) candidate, for diagnostics
    problems: list[str] = []
    while code:
        static = lint_scene(code)
        if static:
            problems = [f"static: {p}" for p in static]
            failed = {"code": code, "checks": [], "stills": None, "cues": [], "problems": problems}
            exec_log("lint", False, "static_check", "; ".join(problems)[:500], code_hash(code), model, None)
        else:
            try:
                res = probe_stills(code, ctx, scratch, probe_times(ctx), 960, 540, assets_dir)
                exec_log("probe", True, None, None, code_hash(code), model, res.get("durationMs"))
                checks, problems = measure(res, ctx, 540)
                cand = {"code": code, "checks": checks, "stills": res.get("stills"), "cues": res.get("cues"),
                        "problems": problems}
                if not problems and qa.scene_verdict(checks) == "pass":
                    passing = cand
                    break
                failed = cand
            except SandboxError as exc:
                exec_log("probe", False, exc.kind, str(exc), code_hash(code), model, None)
                trace = list(exc.trace or [])
                problems = [f"{exc.kind}: {exc}"] + trace
                failed = {"code": code, "checks": [], "stills": None, "cues": [], "problems": problems, "trace": trace}
        if passing:
            break
        if rounds >= config.fix_rounds():
            log("fix_cap", f"scene {ctx['scene']['index'] + 1}: fix cap reached ({rounds}); needs review",
                {"problems": problems[:8]})
            break
        rounds += 1
        history.append("; ".join(problems)[:1500])
        try:
            payload = {"previous_code": code, "problems": problems[:16],
                       "traceback": (failed or {}).get("trace") or problems,
                       "api": api_excerpt_for(problems + ((failed or {}).get("trace") or [])),
                       "instruction": ("Fix ONLY these problems. The traceback is complete. "
                                       "Use only the API shown (sandbox names, signatures, palette keys, "
                                       "spotlight spacing). Return the full corrected code.")}
            out, m = chat_json("scene_fix", SYSTEM, json.dumps(payload), max_tokens=14000)
            log("model_call", f"scene {ctx['scene']['index'] + 1} fix round {rounds}", m)
            code = str(out.get("code") or "") or None
        except LLMError as exc:
            log("model_call_failed", f"scene fix failed: {exc}", {"step": "scene_fix"})
            break
    if passing and passing.get("code"):
        return {"code": passing["code"], "codeHash": code_hash(passing["code"]), "model": model, "fixRounds": rounds,
                "usedFallback": False, "checks": passing["checks"], "verdict": qa.scene_verdict(passing["checks"]),
                "cues": passing.get("cues") or []}
    # A renderable-but-failing candidate is never approved.
    if failed and failed.get("checks") and any(c.get("id") == "A14" and not c.get("pass") for c in failed["checks"]):
        cause = "empty background (A14) after fix rounds"
        log("empty_scene", f"scene {ctx['scene']['index'] + 1}: empty background (A14); using a framework fallback",
            {"rounds": rounds})
    elif failed is None:
        cause = "scene code never produced a renderable probe"
    elif rounds:
        cause = f"fix cap reached ({rounds})" + (f": {'; '.join((failed.get('problems') or problems)[:2])}" if (failed.get("problems") or problems) else "")
    else:
        cause = "framework fallback"
    fb = fallback_code(ctx)
    res = probe_stills(fb, ctx, scratch, probe_times(ctx), 960, 540, assets_dir)
    checks, _ = measure(res, ctx, 540)
    exec_log("probe", True, None, None, code_hash(fb), "framework", res.get("durationMs"))
    log("fallback", f"scene {ctx['scene']['index'] + 1}: framework fallback — {cause}",
        {"rounds": rounds, "cause": cause, "world": (ctx.get("scene") or {}).get("world")})
    out = {"code": fb, "codeHash": code_hash(fb), "model": "framework", "fixRounds": rounds,
           "usedFallback": True, "degraded": True, "degradeCause": cause, "checks": checks,
           "verdict": "degraded", "cues": res.get("cues") or []}
    if failed and failed.get("code"):
        out["failedCode"] = failed["code"]
        out["failedProblems"] = failed.get("problems") or problems
    return out
