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


def deterministic(output: Path) -> tuple[str, dict, dict]:
    fixture = stage1_fixture()
    save_json(output / "designer_blueprint.json", fixture["world"])
    save_json(output / "tool_calls.json", fixture["tools"])
    save_json(output / "framing.json", {"pose": WORLD_HOLD_POSE, "intent": "static hold"})
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
    if not result["ok"] or not result.get("code"):
        raise RuntimeError("Stage 1 tool/compiler failure: " + json.dumps(result["errors"]))
    camera = list((result["spec"].get("camera") or {}).values())
    if len(camera) != 1 or camera[0].get("from") != camera[0].get("to"):
        raise RuntimeError("Stage 1 must use one fixed camera pose, with no travel.")
    ctx = scene_context(world=fixture["world"])
    return result["code"], result["spec"], ctx


def agent(output: Path) -> tuple[str, dict, dict]:
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
    plan = {
        "style": ctx["style"],
        "world": {"id": "world_grid", "name": "Perspective Grid World",
                  "brief": "A cinematic perspective grid city with layered spatial depth."},
        "scenes": [ctx["scene"]],
        "cameraPlan": {"beats": [{"sceneIndex": 0, "intent": "hold", "hold": True,
                                   "reason": "Stage 1 isolates physical world construction; no camera movement."}]},
    }
    events = []

    def log(kind, message, detail=None):
        events.append({"kind": kind, "message": message, "detail": detail})
        save_json(output / "agent_events.json", events)
        print(f"[lab] {kind}: {message}", flush=True)

    designed = design_production(project, story, [], plan, log)
    save_json(output / "designer_blueprint.json", designed)
    bp = designed.get("blueprint") or {}
    bindings = bp.get("sceneBindings") or []
    binding = next((b for b in bindings if b.get("sceneIndex") == 0), None)
    worlds = bp.get("worlds") or []
    world = next((w for w in worlds if w.get("id") == (binding or {}).get("worldId")), None)
    if not binding or not world or not world.get("environmentElements"):
        raise RuntimeError("Designer did not produce the required drawable Stage 1 world.")
    if binding.get("cameraIntent") != "hold":
        raise RuntimeError("Designer added camera travel to world-only Stage 1; inspect designer_blueprint.json")
    ctx = scene_context(world=world, binding=binding, blueprint=bp)
    ctx["worlds"] = worlds
    with tempfile.TemporaryDirectory(prefix="motion_lab_agent_") as scratch:
        assets = Path(scratch) / "assets"
        (assets / "photos").mkdir(parents=True, exist_ok=True)
        engineered = design_scene(
            ctx, scratch, str(assets), log,
            lambda *args, **kwargs: log("sandbox", str(args), kwargs), preflight=True,
        )
    save_json(output / "engineer_result.json",
              {k: v for k, v in engineered.items() if k not in ("code", "failedCode")})
    if engineered.get("failedCode"):
        (output / "engineer_failed.py").write_text(engineered["failedCode"])
    if not engineered.get("code"):
        raise RuntimeError("Engineer did not compile the approved Stage 1 world; see engineer_result.json.")
    return engineered["code"], engineered.get("spec"), ctx


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
    print(f"[lab] Stage 1 world | {args.mode} | {output}", flush=True)
    try:
        code, spec, ctx = (deterministic(output) if args.mode == "deterministic"
                           else agent(output))
        save_json(output / "scene_spec.json", spec)
        save_json(output / "scene_context.json", ctx)
        (output / "compiled_scene.py").write_text(code)
        video = output / ("stage1_world_agent.mp4" if args.mode == "agent"
                          else "stage1_world.mp4")
        width, height = map(int, args.size.split("x"))
        with tempfile.TemporaryDirectory(prefix="motion_lab_render_") as scratch:
            assets = Path(scratch) / "assets"
            (assets / "photos").mkdir(parents=True, exist_ok=True)
            result = render_scene(code, ctx, str(video), scratch, width, height,
                                  workers=1, assets_dir=str(assets))
        save_json(output / "render_result.json", result)
        import subprocess
        poster = output / ("stage1_world_agent_frame.png" if args.mode == "agent"
                           else "stage1_world_frame.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1",
                        "-i", str(video), "-frames:v", "1", str(poster)], check=True)
        print(f"[lab] VIDEO: {video}", flush=True)
        print(f"[lab] FRAME: {poster}", flush=True)
        print("[lab] Stop after Stage 1. Watch the MP4 before proceeding.", flush=True)
        return 0
    except Exception as exc:
        failure = {"error": str(exc), "type": type(exc).__name__,
                   "traceback": traceback.format_exc()}
        save_json(output / "failure.json", failure)
        print(f"[lab] FAILED: {exc} (see {output / 'failure.json'})", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
