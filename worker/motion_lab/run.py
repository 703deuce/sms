"""Standalone Motion Studio Lab: Stage 1, authored world construction.

Imports the production Motion Studio tool registry/compiler/render engine directly.
No Next.js, DB, queue, storage, or Docker build is involved.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import traceback
import time
from datetime import datetime, timezone
from pathlib import Path

WORKER = Path(__file__).resolve().parents[1]
if str(WORKER) not in sys.path:
    sys.path.insert(0, str(WORKER))

from clips_worker.motion_studio.core.render import render_scene
from clips_worker.motion_studio.tools.plan import compile_agent_output

DURATION = 4.0
FPS = 24
# Explicit full-frame camera pose, held steady for all of Stage 1.
WORLD_HOLD_POSE = {"x": 0, "y": 0, "zoom": 1.0, "rot": 0}
PALETTE = {
    "bg": "#071120",
    "ink": "#EFF7FF",
    "accent": "#4DE0FF",
    "accent2": "#EFAD63",
    "muted": "#4F789D",
}


def world_elements() -> list[dict]:
    """A specific layered perspective world made from actual drawable shapes."""
    elements = []

    def shape(id: str, kind: str, x: float, y: float, w: float, h: float,
              fill: str, z: int, **options):
        elements.append({
            "id": id, "kind": kind,
            "position": {"x": x, "y": y},
            "size": {"width": w, "height": h},
            "fill": fill, "opacity": options.pop("opacity", 1),
            "z": z, "rotation": 0, **options,
        })

    # Full-bleed world, authored 2D perspective rather than simulated 3D claims.
    shape("night_sky", "rect", 0, -200, 6800, 3900, "#07111F", -950)
    shape("upper_haze", "rrect", 0, -720, 3100, 820, "#183B58", -930,
          radius=380, opacity=0.95, blur=160)
    shape("skyline_haze", "rrect", 0, -160, 3800, 350, "#235473", -910,
          radius=150, opacity=0.65, blur=80)
    shape("distant_horizon_strip", "rect", 0, -215, 6600, 12, "#57D9F4", -880,
          opacity=0.9)
    shape("floor_plane", "rect", 0, 1500, 7400, 3420, "#10263A", -870)
    shape("floor_deep_glow", "rrect", 0, 900, 3500, 1250, "#153C58", -865,
          radius=400, opacity=0.38, blur=100)

    # Three visual depths: far skyline, luminous perspective floor, near markers.
    towers = [
        (-1620, 390, 145, "#203F59", -858),
        (-1350, 640, 190, "#1B3C58", -856),
        (-1070, 500, 165, "#234864", -854),
        (-740, 760, 185, "#214560", -852),
        (690, 790, 190, "#214560", -850),
        (1040, 530, 185, "#234864", -848),
        (1370, 700, 200, "#1B3C58", -846),
        (1670, 440, 150, "#203F59", -844),
    ]
    for i, (x, h, width, fill, z) in enumerate(towers):
        shape(f"tower_{i:02d}", "rect", x, -215 - h / 2, width, h,
              fill, z, opacity=0.95)
        shape(f"tower_rim_{i:02d}", "rect", x - width * 0.45, -215 - h / 2,
              7, h * 0.9, "#57C3E1", z + 1, opacity=0.8)
        shape(f"tower_roof_{i:02d}", "rect", x, -215 - h, width + 16, 7,
              "#5ECFEB", z + 1, opacity=0.8)
        for level in range(2):
            shape(f"window_{i:02d}_{level}", "rect", x + width * 0.2,
                  -215 - (level + 1) * h / 3, 12, 28,
                  "#B0F1FF", z + 2, opacity=0.8)

    for i, base_x in enumerate(range(-3300, 3301, 220)):
        shape(f"lane_{i:02d}", "path", 0, 0, 0, 0, "#4CCDEB", -810,
              points=[[0, -215], [base_x, 2240]], strokeWidth=7,
              opacity=0.52 if i % 2 else 0.88)
    for i, y in enumerate((-185, -145, -90, -5, 125, 315, 585, 950, 1440, 2020)):
        spread = (y + 245) * 2.0
        shape(f"cross_{i:02d}", "path", 0, 0, 0, 0, "#3EBCD9", -808,
              points=[[-spread, y], [spread, y]], strokeWidth=7,
              opacity=min(0.95, 0.45 + i * 0.052))
    for i, x in enumerate((-1450, -990, 990, 1450)):
        shape(f"foreground_pier_{i}", "rect", x, 650, 24, 980,
              "#2F7997", -790, opacity=0.8)
        shape(f"foreground_cap_{i}", "rect", x, 155, 108, 30,
              "#94EFFF", -788, opacity=0.95)
        shape(f"foreground_foot_{i}", "circle", x, 1140, 115, 115,
              "#46B9D8", -787, radius=58, opacity=0.8)
    shape("vanishing_halo", "circle", 0, -215, 380, 380, "#3BA8CB", -775,
          radius=190, opacity=0.52, blur=60)
    shape("vanishing_core", "circle", 0, -215, 125, 125, "#D3FAFF", -770,
          radius=62, opacity=1.0, blur=10)
    return elements


def stage1_fixture() -> dict:
    elements = world_elements()
    return {
        "name": "stage1_world",
        "world": {
            "id": "world_grid", "name": "Perspective Grid World",
            "brief": "An authored luminous perspective grid floor, layered silhouetted city and horizon.",
            "constructionPlan": "Draw depth using authored floor paths, vanishing lines, and layered towers.",
            "environmentElements": elements,
        },
        "tools": [
            {
                "tool": "create_environment",
                "arguments": {
                    "environmentId": "world_grid",
                    "brief": "Full-frame perspective-grid environment with layered real geometry.",
                    "size": {"width": 3840, "height": 2160},
                    "backdrop": {"kind": "geometry", "elements": elements},
                },
            },
            {
                # This is a static pose, not Stage 2 camera movement.
                "tool": "animate_camera",
                "arguments": {
                    "environmentId": "world_grid",
                    "motionId": "stage1_static_framing",
                    "startS": 0,
                    "endS": DURATION,
                    "from": WORLD_HOLD_POSE,
                    "to": WORLD_HOLD_POSE,
                    "easing": "linear",
                },
            },
        ],
    }


def scene_context(*, world: dict | None = None, binding: dict | None = None,
                  blueprint: dict | None = None) -> dict:
    scene = {
        "id": "lab_stage1", "index": 0, "kind": "graphics",
        "visualType": "diagram",
        "description": "A constructed cinematic perspective-grid world with a layered horizon.",
        "lineIds": ["line_1"],
        "worldId": (world or {}).get("id", "world_grid"),
    }
    line = {
        "id": "line_1", "text": "A world takes shape.", "spoken": "A world takes shape.",
        "hero": "A WORLD TAKES SHAPE", "typed": "",
        "chapter": 1, "start": 0.0, "end": DURATION,
    }
    return {
        "duration": DURATION, "fps": FPS, "seed": 1,
        "lines": [line], "words": [], "emphasis": [], "assets": {}, "data": [],
        "style": {"palette": PALETTE, "mood": "cinematic", "fonts": {}},
        "palette": PALETTE, "scene": scene, "sceneBinding": binding or {},
        "worlds": [world] if world else [],
        "blueprint": blueprint or {},
        "projectId": "motion_lab_stage1",
    }


def save_json(path: Path, obj: object) -> None:
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=str) + "\n")


class LabLog:
    """Unbuffered, timestamped console + JSONL breadcrumbs, no credentials."""
    def __init__(self, output: Path):
        self.path = output / "lab_events.jsonl"
        self.start = time.monotonic()
        self.path.write_text("")

    def __call__(self, stage: str, message: str, detail=None):
        event = {
            "utc": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "elapsedS": round(time.monotonic() - self.start, 3),
            "stage": stage, "message": message,
        }
        if detail is not None:
            event["detail"] = detail
        # Preserve full structured stage events locally; redact credential-shaped keys.
        def scrub(x):
            if isinstance(x, dict):
                return {k: ("[REDACTED]" if any(token in str(k).lower()
                        for token in ("api_key", "authorization", "password", "secret", "token_value"))
                        else scrub(v)) for k, v in x.items()}
            if isinstance(x, list):
                return [scrub(v) for v in x]
            return x
        with self.path.open("a") as stream:
            stream.write(json.dumps(scrub(event), ensure_ascii=False, default=str) + "\n")
            stream.flush()
        print(f"[motion-lab][{event['utc']}][+{event['elapsedS']:.3f}s][{stage}] {message}", flush=True)
        if detail is not None:
            summary = json.dumps(scrub(detail), ensure_ascii=False, default=str)
            print(f"[motion-lab][{stage}] {summary[:2500]}", flush=True)


def _summarize_world(world: dict) -> dict:
    elements = world.get("environmentElements") or []
    return {
        "worldId": world.get("id"),
        "title": world.get("name"),
        "geometryCount": len(elements),
        "kinds": {kind: sum(1 for el in elements if el.get("kind") == kind)
                  for kind in sorted({el.get("kind") for el in elements if isinstance(el, dict)})},
        "ids": [el.get("id") for el in elements if isinstance(el, dict)],
    }


def require_world(world: dict, *, stage: str) -> None:
    """Stage 1 genuinely needs drawable elements, not descriptive prose."""
    elements = world.get("environmentElements") or []
    if len(elements) < 6:
        raise RuntimeError(f"{stage}: world has {len(elements)} drawable elements; need >=6")
    ids = [e.get("id") for e in elements if isinstance(e, dict)]
    if len(ids) != len(elements) or len(set(ids)) != len(ids) or any(not i for i in ids):
        raise RuntimeError(f"{stage}: world elements require unique nonempty IDs")
    allowed = {"rect", "rrect", "surface", "circle", "line", "path"}
    for e in elements:
        if not isinstance(e, dict) or e.get("kind") not in allowed:
            raise RuntimeError(f"{stage}: unsupported or missing geometry element: {e!r}")
        if not isinstance(e.get("position"), dict) or not isinstance(e.get("size"), dict):
            raise RuntimeError(f"{stage}: {e.get('id')} missing position/size")
        if not e.get("fill"):
            raise RuntimeError(f"{stage}: {e.get('id')} missing fill")


def deterministic(output: Path, log: LabLog) -> tuple[str, dict, dict]:
    log("fixture.begin", "Build known reference world through the real tool interface")
    fixture = stage1_fixture()
    require_world(fixture["world"], stage="fixture")
    log("fixture.world", "Authored world constructed", _summarize_world(fixture["world"]))
    save_json(output / "designer_blueprint.json", fixture["world"])
    save_json(output / "tool_calls.json", fixture["tools"])
    log("tools.input", "Registered tool calls saved", {"tools": [x["tool"] for x in fixture["tools"]], "path": str(output / "tool_calls.json")})
    save_json(output / "framing.json", {"pose": WORLD_HOLD_POSE, "intent": "static hold"})
    log("compiler.start", "Compiling world tool calls via production compiler")
    result = compile_agent_output(
        {"tools": fixture["tools"]}, scene_id="lab_stage1",
        fps=FPS, duration_s=DURATION,
        required_effects=["environment_geometry"],
        world_elements=fixture["world"]["environmentElements"],
        camera_intent="hold",
        allow_custom_code=False,
    )
    save_json(output / "compiler_result.json",
              {k: v for k, v in result.items() if k != "code"})
    log("compiler.finish", "Production compiler responded", {"ok": result["ok"], "errors": result.get("errors"), "camera": result.get("spec", {}).get("camera", {})})
    if not result["ok"] or not result.get("code"):
        raise RuntimeError("Stage 1 tool/compiler failure: " + json.dumps(result["errors"]))
    camera = list((result["spec"].get("camera") or {}).values())
    if len(camera) != 1 or camera[0].get("from") != camera[0].get("to"):
        raise RuntimeError("Stage 1 must use one fixed camera pose, with no travel.")
    ctx = scene_context(world=fixture["world"])
    log("fixture.ready", "Deterministic Stage 1 world ready for production renderer")
    return result["code"], result["spec"], ctx


def agent(output: Path, log: LabLog) -> tuple[str, dict, dict]:
    """Real production Designer -> real Engineer, isolated from project orchestration.

    This is intentionally NOT a mock or a separately reimplemented agent. Paid provider
    access is needed. Every failure is preserved for inspection instead of replaced
    by deterministic fixture artwork.
    """
    from clips_worker.motion_studio.directors.documentary.production import design_production
    from clips_worker.motion_studio.directors.documentary.engineer import design_scene
    from clips_worker.motion_studio.pipeline import config

    if config.mock():
        raise RuntimeError("Agent mode requires MOTION_STUDIO_MOCK unset/false.")
    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("Agent mode requires OPENAI_API_KEY for the real production agents.")

    ctx = scene_context()
    story = {
        "title": "A World Takes Shape", "tone": "cinematic", "logline": "A perspective city appears.",
        "lines": ctx["lines"],
        "chapters": [{"id": 1, "title": "A world begins", "lineIds": ["line_1"]}],
    }
    project = {"id": "motion_lab_stage1",
               "settings": {"lengthMin": DURATION / 60, "voiceover": False, "music": False}}
    # design_production consumes an already-approved FILM DIRECTOR plan.
    # Unlike the Production Designer's structured output, that upstream plan
    # owns style.fonts, music mood/reason, style reason and per-scene reasons.
    # Keep these lab-provided editorial facts explicit; never ask Luna to
    # supply Director-only fields or weaken production validate_plan().
    plan = {
        "style": {
            **ctx["style"],
            "fonts": {"display": "cond", "label": "label", "body": "serif"},
            "reason": "A luminous graphic city uses high contrast and legible editorial typography.",
        },
        "music": {
            "mood": "none",
            "reason": "Stage 1 tests visual world construction in isolation; no audio mix.",
        },
        "world": {"id": "world_grid", "name": "Perspective Grid World",
                  "brief": "A cinematic perspective grid city with layered spatial depth.",
                  "reason": "One original spatial environment establishes the opening beat."},
        "scenes": [{
            **ctx["scene"],
            "reason": "The single storyboard beat establishes spatial depth and perspective.",
            "illustrative": True,
            "visualProvenance": "original_illustration",
        }],
        "cameraPlan": {"beats": [{"sceneIndex": 0, "intent": "hold", "hold": True,
                                   "reason": "Stage 1 isolates physical world construction; no camera movement."}]},
    }
    # Fail before an expensive model call if the upstream director fixture
    # drifts from the REAL production plan contract again.
    from clips_worker.motion_studio.directors.documentary.director import validate_plan
    director_errors = validate_plan(plan, story, [])
    log("director.validate", "Validate upstream lab Film Director fixture",
        {"pass": not director_errors, "errors": director_errors,
         "styleFonts": plan["style"]["fonts"], "music": plan["music"],
         "sceneReason": plan["scenes"][0]["reason"]})
    if director_errors:
        save_json(output / "director_fixture_invalid.json",
                  {"errors": director_errors, "plan": plan})
        raise RuntimeError("Lab's Film Director input is invalid: " +
                           "; ".join(director_errors))
    save_json(output / "director_plan.json", plan)
    log("designer.start", "Invoking the REAL Production Designer via production.design_production",
        {"model": config.model_for("production_designer"), "scene": ctx["scene"]["id"],
         "seconds": DURATION, "assets": 0, "cameraStage": "static world only"})
    try:
        designed = design_production(project, story, [], plan, log)
    except Exception as exc:
        raw = getattr(exc, "output", None)
        if raw is not None:
            save_json(output / "designer_failed_output.json", raw)
        log("designer.error", "Designer failed; no reference-world fallback", {
            "type": type(exc).__name__, "error": str(exc),
            "rawOutputSaved": raw is not None})
        raise
    log("designer.finish", "Designer returned approved production plan")
    save_json(output / "designer_blueprint.json", designed)
    bp = designed.get("blueprint") or {}
    bindings = bp.get("sceneBindings") or []
    binding = next((b for b in bindings if b.get("sceneIndex") == 0), None)
    worlds = bp.get("worlds") or []
    world = next((w for w in worlds if w.get("id") == (binding or {}).get("worldId")), None)
    if not binding or not world or not world.get("environmentElements"):
        raise RuntimeError("Designer did not produce the required drawable Stage 1 world.")
    require_world(world, stage="agent.designer")
    log("designer.world", "World geometry authored by agent", _summarize_world(world))
    log("designer.binding", "Agent scene requirements", {"requiredEffects": binding.get("requiredEffects"), "cameraIntent": binding.get("cameraIntent"), "cameraShots": binding.get("cameraShots"), "compositionElements": len(binding.get("compositionElements") or [])})
    if binding.get("cameraIntent") != "hold":
        raise RuntimeError("Designer added camera travel to world-only Stage 1; inspect designer_blueprint.json")
    # For Stage 1, geometry is a mandatory acceptance requirement even if the
    # model accidentally omits it from its requiredEffects array.
    binding = {**binding, "requiredEffects": sorted(set(binding.get("requiredEffects") or []) | {"environment_geometry"})}
    ctx = scene_context(world=world, binding=binding, blueprint=bp)
    ctx["worlds"] = worlds
    log("engineer.start", "Invoking REAL Motion Engineer on the Designer-approved world", {"model": config.model_for("motion_engineer"), "requiredEffects": binding["requiredEffects"]})
    with tempfile.TemporaryDirectory(prefix="motion_lab_agent_") as scratch:
        assets = Path(scratch) / "assets"
        (assets / "photos").mkdir(parents=True, exist_ok=True)
        engineered = design_scene(
            ctx, scratch, str(assets), log,
            lambda *args, **kwargs: log("sandbox", str(args), kwargs), preflight=True,
        )
    log("engineer.finish", "Motion Engineer completed preflight compilation", {"verdict": engineered.get("verdict"), "tier": engineered.get("tier"), "fixRounds": engineered.get("fixRounds"), "hasCode": bool(engineered.get("code")), "failedProblems": engineered.get("failedProblems"), "attempts": len(engineered.get("engineerAttempts") or [])})
    save_json(output / "engineer_result.json",
              {k: v for k, v in engineered.items() if k not in ("code", "failedCode")})
    if engineered.get("failedCode"):
        (output / "engineer_failed.py").write_text(engineered["failedCode"])
    if not engineered.get("code"):
        raise RuntimeError("Engineer did not compile the approved Stage 1 world; see engineer_result.json.")
    spec = engineered.get("spec")
    if not isinstance(spec, dict):
        raise RuntimeError("Stage 1 agent must use registered tools and return a verifiable scene spec.")
    built = [el for env in (spec.get("environments") or {}).values()
             for el in ((env.get("backdrop") or {}).get("elements") or []) + (env.get("geometry") or [])]
    wanted = world["environmentElements"]
    built_by_id = {el.get("id"): el for el in built if isinstance(el, dict)}
    missing = [el.get("id") for el in wanted
               if built_by_id.get(el.get("id")) is None]
    if missing:
        log("agent.world.missing", "Engineer dropped Designer-approved world geometry", {"missingIds": missing})
        raise RuntimeError(f"Engineer dropped Designer-authored world elements: {missing}")
    log("agent.world.verified", "Exact agent-authored world objects survived into tool spec", {"expected": len(wanted), "rendered": len(built), "ids": list(built_by_id)})
    # The camera is merely a lab framing control in this stage, NOT an invented
    # agent world or a later-stage camera move. Correct the 0.4 fallback by
    # requiring a fixed pose through the real registered tool/compiler path.
    from clips_worker.motion_studio.tools.registry import apply_calls
    from clips_worker.motion_studio.tools.compiler import compile_spec
    from clips_worker.motion_studio.tools.validate import _camera_moved
    moves = list((spec.get("camera") or {}).values())
    if any(_camera_moved(m.get("from"), m.get("to")) for m in moves):
        raise RuntimeError("Stage 1 Engineer introduced camera travel; Stage 2 is not yet authorized.")
    if moves:
        for move in moves:
            move["from"] = dict(WORLD_HOLD_POSE)
            move["to"] = dict(WORLD_HOLD_POSE)
            move["easing"] = "hold"
        log("framing.fixed", "Holding the agent-authored world on lab's fixed framing (existing camera call)")
    else:
        spec, results = apply_calls(spec, [{
            "tool": "animate_camera",
            "arguments": {"environmentId": next(iter(spec["environments"])),
                          "motionId": "stage1_lab_static_framing",
                          "startS": 0, "endS": DURATION,
                          "from": WORLD_HOLD_POSE, "to": WORLD_HOLD_POSE,
                          "easing": "linear"},
        }])
        if not all(r.ok for r in results):
            raise RuntimeError("Lab fixed framing failed in registered tool: " +
                               json.dumps([r.as_dict() for r in results]))
        log("framing.fixed", "Added lab-only static camera using registered animate_camera", {"pose": WORLD_HOLD_POSE})
    code = compile_spec(spec)
    log("compiler.finish", "Agent tool spec recompiled after fixed framing", {"objects": len(spec.get("objects") or {}), "environments": len(spec.get("environments") or {}), "codeChars": len(code)})
    return code, spec, ctx


def main() -> int:
    parser = argparse.ArgumentParser(description="Motion Studio Lab — Stage 1: world construction")
    parser.add_argument("scenario", choices=["world", "stage1_world", "world-camera"],
                        help="Stage 1 world; world-camera is a compatibility alias, camera travel comes in Stage 2")
    parser.add_argument("--mode", choices=["deterministic", "agent"], default="deterministic",
                        help="Known authored tool calls, or the exact production Designer/Engineer")
    parser.add_argument("--out", default=None, help="Output folder (default: worker/motion_lab/outputs)")
    parser.add_argument("--size", default="960x540", choices=["960x540", "1280x720"],
                        help="Preview resolution")
    args = parser.parse_args()
    output = Path(args.out).expanduser().resolve() if args.out else Path(__file__).resolve().parent / "outputs"
    output.mkdir(parents=True, exist_ok=True)
    log = LabLog(output)
    log("run.start", "Stage 1 world construction started", {
        "mode": args.mode, "resolution": args.size, "output": str(output),
        "durationS": DURATION, "fps": FPS, "python": sys.version.split()[0]})
    try:
        code, spec, ctx = (deterministic(output, log) if args.mode == "deterministic"
                           else agent(output, log))
        save_json(output / "scene_spec.json", spec)
        save_json(output / "scene_context.json", ctx)
        (output / "compiled_scene.py").write_text(code)
        log("artifact.compile", "Saved full compiled scene source and spec", {"source": str(output / "compiled_scene.py"), "spec": str(output / "scene_spec.json"), "codeChars": len(code)})
        video = output / ("stage1_world_agent.mp4" if args.mode == "agent"
                          else "stage1_world.mp4")
        width, height = map(int, args.size.split("x"))
        log("renderer.start", "Sending compiled agent/fixture code to production sandbox renderer", {"video": str(video), "width": width, "height": height, "fps": FPS})
        with tempfile.TemporaryDirectory(prefix="motion_lab_render_") as scratch:
            assets = Path(scratch) / "assets"
            (assets / "photos").mkdir(parents=True, exist_ok=True)
            result = render_scene(code, ctx, str(video), scratch, width, height,
                                  workers=1, assets_dir=str(assets))
        save_json(output / "render_result.json", result)
        log("renderer.finish", "Render completed with frame count and elapsed milliseconds", result)
        import subprocess
        poster = output / ("stage1_world_agent_frame.png" if args.mode == "agent"
                           else "stage1_world_frame.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1",
                        "-i", str(video), "-frames:v", "1", str(poster)], check=True)
        log("frame.saved", "Decoded review frame from actual MP4", {"frame": str(poster), "bytes": poster.stat().st_size})
        print(f"[lab] VIDEO: {video}", flush=True)
        print(f"[lab] FRAME: {poster}", flush=True)
        print(f"[lab] LOGS: {log.path}", flush=True)
        print("[lab] Stop after Stage 1. Watch the MP4 before proceeding.", flush=True)
        log("run.success", "MP4 and diagnostic artifacts produced; awaiting human visual approval")
        return 0
    except Exception as exc:
        failure = {"error": str(exc), "type": type(exc).__name__,
                   "traceback": traceback.format_exc()}
        save_json(output / "failure.json", failure)
        log("run.failed", "Stage 1 stopped with a full failure traceback saved", {"type": type(exc).__name__, "error": str(exc), "failurePath": str(output / "failure.json")})
        print(f"[lab] FAILED: {exc} (see {output / 'failure.json'})", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
