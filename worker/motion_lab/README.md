# Motion Studio Lab — Stage 1: Construct a world

This is an **independent Python entry point** that imports the **same registered tools, compiler, agents and Skia renderer** as production. No copies of the renderer or agents, no Next.js build, queue, database, Coolify deployment, or Docker image rebuild.

**Stop after Stage 1.** This stage proves drawable world construction, not camera movement. Stage 2 adds camera travel *only after someone watches and approves the MP4*.

## One-time setup (Linux, from repository root)

The lab needs the worker's actual render dependencies and FFmpeg. A working Motion Studio worker Python environment can be used as-is. Otherwise, install them in an isolated virtualenv:

```bash
python3 -m venv .venv-motion-lab
source .venv-motion-lab/bin/activate
python -m pip install skia-python==144.1 pillow numpy scipy librosa
sudo apt-get install -y ffmpeg fontconfig
```

Make sure `ffmpeg` has libx264 and that the worker's licensed fonts and vendored `motion_core` are present; this is **not** a second renderer. On some systems you may need additional packages from `worker/Dockerfile` for the pinned production engine.

## Stage 1A — deterministic tools-to-MP4 world

From the repo root:

```bash
python worker/motion_lab/run.py world
```

This runs actual `create_environment` -> `compile_agent_output` -> `compile_spec` -> sandbox `render_scene` on a short **4-second, 960×540** scene with a full-frame high-contrast perspective grid, horizon, layered city silhouettes, and foreground depth markers. The deterministic scenario specifies an **explicit fixed camera at zoom 1.0** instead of the compiler's default 0.4 zoom; no travel is introduced.

Watch: `worker/motion_lab/outputs/stage1_world.mp4`.

Inspect `worker/motion_lab/outputs/stage1_world_frame.png`, decoded directly from the real video, alongside the MP4. The output directory also contains `designer_blueprint.json` (the world fixture), `tool_calls.json`, `scene_spec.json`, `compiled_scene.py`, `scene_context.json`, `compiler_result.json` and `render_result.json`. A failure writes `failure.json`, retaining its traceback. This deterministic pass **does not call an LLM**; it isolates engine correctness.

## Stage 1B — production agents on the exact same isolated path

Use the **real** production Designer and Engineer only after the deterministic MP4 looks correct. Export the same OpenAI credentials used by the existing worker (do not commit keys), and run:

```bash
OPENAI_API_KEY=your_key python worker/motion_lab/run.py world --mode agent
```

The script calls `design_production` from the production documentary Designer and `design_scene(preflight=True)` from the production Motion Engineer; it then uses the exact same renderer. The design must include actual geometry, and a deliberate static camera is required at Stage 1. This mode uses paid API tokens and may fail if the production agent contract cannot design the tiny brief. It **does not silently replace** a failed agent scene with the deterministic fixture.

Watch: `worker/motion_lab/outputs/stage1_world_agent.mp4`. Inspect `designer_blueprint.json`, `engineer_result.json`, `agent_events.json`, `engineer_failed.py` (if present) and `failure.json` on failures. The sandbox writes no production data.

To keep separate runs isolated:

```bash
python worker/motion_lab/run.py world --out /tmp/ms-world-known
python worker/motion_lab/run.py world --mode agent --out /tmp/ms-world-agent
```

**Acceptance for Stage 1:** the world is visibly built from actual paths and surfaces in the MP4; the agent path produces its own world with no substituted fallback. The Lab deliberately does **not** run tests on command import or auto-run anything. No production app changes are required.

**Next, after human visual review:** Stage 2 adds two distinct camera poses and verifies visible parallax/travel, then animation, transitions, text/media, narration and full-film agent orchestration one at a time.
