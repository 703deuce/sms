"""Motion Designer prompt teaches engine craft and worked film examples."""
import pathlib

from clips_worker.motion_studio.core.craft import (
    CRAFT_GUIDE,
    EXAMPLE_BOARD,
    EXAMPLE_CHART,
    EXAMPLE_MAP,
    SCENE_SKELETON,
    WORKED_EXAMPLES,
    designer_system,
)
from clips_worker.motion_studio.sandbox.policy import check_code

ROOT = pathlib.Path(__file__).resolve().parents[1]
API_SRC = (ROOT / "clips_worker/motion_studio/core/api.py").read_text()
DESIGNER_SRC = (ROOT / "clips_worker/motion_studio/directors/documentary/designer.py").read_text()


def _api_reference() -> str:
    marker = "API_REFERENCE ="
    start = API_SRC.index(marker)
    q = "'''" if "API_REFERENCE = '''" in API_SRC else '"""'
    a = API_SRC.index(q, start) + len(q)
    b = API_SRC.index(q, a)
    return API_SRC[a:b]


def _example_code(block: str) -> str:
    i = block.index("from motion_core import")
    return block[i:].strip()


def test_designer_prompt_includes_craft_guide_and_examples():
    api = _api_reference()
    system = designer_system(api)
    assert "designer_system(API_REFERENCE)" in DESIGNER_SRC
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
        "typed",
        "riser",
        "spotlight",
        "ctx.geo",
        "rollingnumber",
        "glowpin",
        "pricechart",
        "source of truth",
        "illustrations",
        "never the only templates",
        "starter skeleton",
        "wright flyer",
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
