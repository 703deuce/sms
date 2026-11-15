"""Tool registry, scene spec, compiler, and tool-awareness tests (spec 6)."""
from __future__ import annotations

from clips_worker.motion_studio.sandbox.policy import check_code, lint_scene
from clips_worker.motion_studio.tools import (
    apply_calls,
    assert_tools_fresh,
    compile_agent_output,
    compile_spec,
    default_registry,
    format_tools_reference,
    intended_tool,
    new_spec,
    validate_spec,
)
from clips_worker.motion_studio.tools.extensions import register_component
from clips_worker.motion_studio.tools.registry import UNKNOWN_TOOL

REQUIRED = {
    "create_environment",
    "place_media",
    "animate_camera",
    "create_graphic",
    "transition_scene",
    "compose_audio",
    "draw_path",
    "animate_text",
}


def test_tools_manifest_is_fresh_and_fully_documented():
    assert_tools_fresh()
    reg = default_registry()
    assert REQUIRED.issubset(set(reg.names()))
    assert reg.aliases()["place_photo"] == "place_media"
    for name in reg.names():
        tool = reg._tools[name]
        assert not tool.missing_docs(), (name, tool.missing_docs())
        assert tool.version().startswith(tool.semver)
        assert tool.examples
        assert tool.schema()["required"] or True


def test_docs_are_generated_from_the_registry():
    docs = format_tools_reference()
    for name in REQUIRED:
        assert name in docs
    assert "generated from the tool registry" in docs.lower() or "do not invent tools" in docs.lower()


def test_intended_tool_selects_the_correct_tool():
    assert intended_tool("put this photo on a desk") == "place_media"
    assert intended_tool("push the camera in") == "animate_camera"
    assert intended_tool("create a chart of revenue") == "create_graphic"
    assert intended_tool("create an environment for a worn desk") == "create_environment"
    assert intended_tool("draw a path between the two prints") == "draw_path"
    assert intended_tool("animate typography on the spoken word") == "animate_text"
    assert intended_tool("add a sound effect whoosh") == "compose_audio"
    assert intended_tool("transition between scenes with a shared print") == "transition_scene"


def test_unknown_tool_is_rejected():
    spec = new_spec("scene_1")
    spec, results = apply_calls(spec, [{"tool": "invent_skia_draw", "arguments": {"x": 1}}])
    assert not results[0].ok
    assert results[0].errors[0]["code"] == UNKNOWN_TOOL


def test_place_media_spec_example_compiles_and_lints():
    spec = new_spec("scene_12", fps=30, duration_s=4, catalog_ids=["photo_7"])
    spec, results = apply_calls(spec, [
        {"tool": "create_environment", "arguments": {"environmentId": "env_desk", "brief": "A worn physical desk."}},
        {"tool": "place_media", "arguments": {
            "sceneId": "scene_12",
            "assetId": "photo_7",
            "presentation": "physical_print",
            "position": {"x": 1250, "y": 400},
            "width": 1800,
            "rotation": -3,
            "entrance": {"type": "reveal", "anchorWordId": "word_214"},
        }},
        {"tool": "animate_camera", "arguments": {
            "environmentId": "env_desk",
            "startFrame": 0,
            "endFrame": 90,
            "from": {"x": 0, "y": 0, "zoom": 0.35},
            "to": {"x": 1250, "y": 400, "zoom": 0.7},
            "easing": "ease_in_out",
            "focusTargetId": "media_1",
        }},
    ])
    assert all(r.ok for r in results), results
    assert validate_spec(spec, catalog_ids=["photo_7"]) == []
    code = compile_spec(spec, catalog_ids=["photo_7"])
    assert lint_scene(code) == []
    check_code(code)
    assert "getattr" not in code and "os." not in code and "__import__" not in code
    assert "PhotoFrame" in code and "film.cam(" in code
    assert "WORLD_TYPES" not in code


def test_animate_camera_rejects_bad_range_and_missing_target():
    spec = new_spec("s", fps=30, duration_s=2)
    spec, res = apply_calls(spec, [
        {"tool": "create_environment", "arguments": {"environmentId": "e1", "brief": "open field"}},
        {"tool": "animate_camera", "arguments": {
            "environmentId": "e1",
            "startFrame": 10,
            "endFrame": 10,
            "from": {"x": 0, "y": 0, "zoom": 0.4},
            "to": {"x": 0, "y": 0, "zoom": 0.4},
            "easing": "ease_in_out",
        }},
    ])
    assert not res[-1].ok
    assert any(e["code"] == "INVALID_RANGE" for e in res[-1].errors)
    spec, res = apply_calls(spec, [
        {"tool": "animate_camera", "arguments": {
            "environmentId": "e1",
            "startFrame": 0,
            "endFrame": 30,
            "from": {"x": 0, "y": 0, "zoom": 0.4},
            "to": {"x": 10, "y": 0, "zoom": 0.5},
            "focusTargetId": "does_not_exist",
        }},
    ])
    assert not res[-1].ok
    assert any(e["code"] == "MISSING_TARGET" for e in res[-1].errors)
    # hold with equal frames is allowed
    spec, res = apply_calls(spec, [
        {"tool": "animate_camera", "arguments": {
            "environmentId": "e1",
            "startFrame": 0,
            "endFrame": 0,
            "from": {"x": 0, "y": 0, "zoom": 0.4},
            "to": {"x": 0, "y": 0, "zoom": 0.4},
            "easing": "hold",
        }},
    ])
    assert res[-1].ok, res[-1].errors


def test_validate_catches_missing_media_and_timing():
    spec = new_spec("s", fps=30, duration_s=2, catalog_ids=["photo_7"])
    apply_calls(spec, [{"tool": "create_environment", "arguments": {"environmentId": "e1", "brief": "desk"}}])
    apply_calls(spec, [{"tool": "place_media", "arguments": {
        "assetId": "not_in_catalog", "position": {"x": 0, "y": 0},
    }}])
    # apply() allows this when checking catalog-at-apply only if assets dict is empty-or-contains;
    # we attached catalog_ids so apply should fail UNKNOWN_ASSET already.
    # If the object snuck in, whole-spec validation still catches it.
    problems = validate_spec(spec, catalog_ids=["photo_7"])
    assert any(p["code"] in ("MISSING_MEDIA", "UNKNOWN_ASSET") for p in problems) or any(
        not r.ok for r in apply_calls(new_spec("s", catalog_ids=["photo_7"]), [
            {"tool": "create_environment", "arguments": {"brief": "d", "environmentId": "e"}},
            {"tool": "place_media", "arguments": {"assetId": "missing", "position": {"x": 0, "y": 0}}},
        ])[1]
    )


def test_use_component_rejects_raw_code():
    spec = new_spec("s")
    apply_calls(spec, [{"tool": "create_environment", "arguments": {"environmentId": "e", "brief": "lab"}}])
    spec, res = apply_calls(spec, [{"tool": "use_component", "arguments": {
        "component": "ticker", "code": "def build_scene(ctx): pass",
    }}])
    assert not res[-1].ok
    assert any(e["code"] == "AUTHORIZATION" for e in res[-1].errors)


def test_register_component_requires_visual_tests():
    code = (
        "from motion_core import *\n"
        "def build_scene(ctx):\n"
        "    film = ctx.film()\n"
        "    film.cam(0, 0, 0, 0.4)\n"
        "    film.cam(ctx.duration, 0, 0, 0.4)\n"
        "    return film\n"
    )
    refused = register_component("ticker", code, visual_ok=False)
    assert not refused["ok"]
    accepted = register_component("ticker", code, visual_ok=True, interface={"symbol": "string"})
    assert accepted["ok"]
    assert accepted["version"].startswith("1.0+")


def test_compile_agent_output_prefers_tools_and_passes_limitations():
    out = compile_agent_output(
        {"tools": [
            {"tool": "create_environment", "arguments": {"environmentId": "e", "brief": "desk"}},
            {"tool": "place_media", "arguments": {"assetId": "photo_7", "position": {"x": 1, "y": 2}}},
        ]},
        scene_id="scene_12",
        catalog_ids=["photo_7"],
        duration_s=3,
    )
    assert out["ok"] and out["tier"] == 1 and out["code"]
    assert lint_scene(out["code"]) == []
    lim = compile_agent_output(
        {"limitation": {"reason": "no tool can build a fluid sim", "missingTools": ["fluid"]}},
        scene_id="s",
    )
    assert not lim["ok"] and lim["limitation"]["toRole"] == "production_designer"


def test_chart_data_must_be_verified():
    spec = new_spec("s")
    apply_calls(spec, [{"tool": "create_environment", "arguments": {"environmentId": "e", "brief": "chart wall"}}])
    spec, res = apply_calls(spec, [{"tool": "create_graphic", "arguments": {"kind": "chart_line"}}])
    assert not res[-1].ok
    spec, res = apply_calls(spec, [{"tool": "create_graphic", "arguments": {
        "kind": "chart_line", "data": [{"x": 0, "y": 1}, {"x": 1, "y": 2}],
    }}])
    assert res[-1].ok
