"""Motion Designer prompt teaches engine craft and topic-neutral grammar sketches."""
import pathlib

from clips_worker.motion_studio.core.api_manifest import format_api_reference
from clips_worker.motion_studio.core.craft import (
    CRAFT_GUIDE,
    EXAMPLE_BOARD,
    EXAMPLE_CHART,
    EXAMPLE_MAP,
    SCENE_SKELETON,
    WORKED_EXAMPLES,
    designer_system,
    engineer_system,
)
from clips_worker.motion_studio.tools.registry import format_tools_reference

from clips_worker.motion_studio.sandbox.policy import check_code

ROOT = pathlib.Path(__file__).resolve().parents[1]
API_SRC = (ROOT / "clips_worker/motion_studio/core/api.py").read_text()
DESIGNER_SRC = (ROOT / "clips_worker/motion_studio/directors/documentary/designer.py").read_text()
ENGINEER_SRC = (ROOT / "clips_worker/motion_studio/directors/documentary/engineer.py").read_text()


def _api_reference() -> str:
    return format_api_reference()


def _example_code(block: str) -> str:
    i = block.index("from motion_core import")
    return block[i:].strip()


def test_designer_prompt_includes_craft_guide_and_examples():
    api = _api_reference()
    system = designer_system(api)
    assert "from clips_worker.motion_studio.directors.documentary.engineer import" in DESIGNER_SRC
    assert "engineer_system" in ENGINEER_SRC
    assert "format_tools_reference" in ENGINEER_SRC
    assert CRAFT_GUIDE in system
    assert SCENE_SKELETON in system
    assert EXAMPLE_BOARD in system
    assert EXAMPLE_MAP in system
    assert EXAMPLE_CHART in system
    assert WORKED_EXAMPLES in system
    low = system.lower()
    for needle in (
        "one hero per beat",
        "spoken word",
        "ctx.w(",
        "riser",
        "spotlight",
        "ctx.geo",
        "rollingnumber",
        "glowpin",
        "pricechart",
        "source of truth",
        "grammar only",
        "ctx.scene.assetid",
        "starter skeleton",
        "data is the world",
        "paperdoc",
        "three",
    ):
        assert needle in low, f"missing craft cue {needle!r}"
    # Token budget: chars/4 is a rough token count. Keep the system prompt tight.
    assert len(system) < 28_000, f"designer system prompt is {len(system)} chars; trim the guide or examples"
    assert "Cached" in api
    assert "CREAM" in api
    assert "heartbeat" in api
    assert "per_frame_grain" in API_SRC


def test_worked_examples_pass_sandbox_policy():
    for block in (SCENE_SKELETON, EXAMPLE_BOARD, EXAMPLE_MAP, EXAMPLE_CHART):
        check_code(_example_code(block))


def test_motion_core_exports_craft_surface():
    for name in ("Cached", "CREAM", "WHITE", "RUST", "MUSTARD", "HILITE", "Print", "PaperDoc",
                 "BigText", "GeoMap", "RegionFill", "per_frame_grain"):
        assert name in API_SRC, name


def test_engineer_prompt_is_technical_and_tool_first():
    api = _api_reference()
    tools = format_tools_reference()
    system = engineer_system(api, tools)
    low = system.lower()
    assert "motion engineer" in low
    assert "technical" in low
    assert "registered" in low and "tools" in low
    assert "limitation" in low
    assert "place_media" in low and "animate_camera" in low
    assert "do not invent the creative concept" in low
    assert "wright flyer" not in low
    assert "you decide what, where, when and why" not in low
    assert "already in scope" in low or "already in scope" in api.lower()
    assert "no 'rgb' argument" in api.lower() or "no rgb argument" in api.lower()
    assert "dark_line" in api
    assert "0.25" in api
    assert len(system) < 28_000, f"engineer system prompt is {len(system)} chars"
