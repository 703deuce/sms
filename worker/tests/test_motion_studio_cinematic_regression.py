"""Cinematic quality regression: tool effects must be real, not validated comments.

No project-specific words, pictures or aesthetics. The image probe is only run
when the real Skia worker dependencies are present.
"""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

import pytest

from clips_worker.motion_studio.sandbox.policy import check_code, lint_scene
from clips_worker.motion_studio.tools import compile_spec, new_spec, validate_spec
from clips_worker.motion_studio.tools.compiler import CompileError
from clips_worker.motion_studio.tools.extensions import (
    export_approved_component, hydrate_approved_component, register_component,
)


def _scene():
    spec = new_spec("s0", fps=30, duration_s=3, catalog_ids=[])
    spec["environments"]["e"] = {
        "id": "e", "brief": "original illustrated workspace", "palette": {},
        "backdrop": {"kind": "geometry", "elements": [
            {"kind": "rect", "position": {"x": -600, "y": 0},
             "size": {"width": 750, "height": 800}, "fill": "accent", "z": -700},
            {"kind": "circle", "position": {"x": 450, "y": -100},
             "size": {"width": 500, "height": 500}, "fill": "accent2", "z": -650},
        ]},
    }
    spec["objects"]["circle"] = {
        "id": "circle", "kind": "primitive", "primitiveKind": "circle",
        "position": {"x": -600, "y": 50}, "size": {"radius": 160},
        "material": {"fill": "ink"}, "z": 15,
    }
    spec["objects"]["group"] = {
        "id": "group", "kind": "group", "memberIds": ["circle"],
        "layout": "cluster", "position": {"x": 0, "y": 0},
    }
    spec["animation"]["shift"] = {
        "id": "shift", "targetId": "group", "property": "position.x",
        "from": 0, "to": 1700, "easing": "ease_in_out", "startFrame": 0, "endFrame": 75,
    }
    spec["camera"]["travel"] = {
        "id": "travel", "environmentId": "e", "startFrame": 0, "endFrame": 90,
        "easing": "ease_in_out", "from": {"x": -600, "y": 0, "zoom": 0.6},
        "to": {"x": 700, "y": 0, "zoom": 0.6},
    }
    spec["cameraIntent"] = "travel"
    spec["cameraRequired"] = True
    spec["requiredEffects"] = ["environment_geometry", "group", "property_animation", "camera_travel", "graphic"]
    return spec


def _ctx():
    return {
        "duration": 3.0, "fps": 30, "seed": 5, "style": {"grain": 0},
        "palette": {
            "bg": "#101b27", "ink": "#f0f0f0", "accent": "#e75a39",
            "accent2": "#2cb8b0", "muted": "#47545f",
        },
        "lines": [], "words": [], "emphasis": [], "assets": {}, "data": [],
        "scene": {"id": "s0", "index": 0, "visualType": "diagram"},
    }


def test_compiler_materializes_group_artwork_and_property_animation():
    spec = _scene()
    assert validate_spec(spec) == []
    code = compile_spec(spec)
    check_code(code)
    assert lint_scene(code) == []
    assert "_EnvironmentShape" in code and "_DirectedItem" in code
    assert "position.x" in code and "_elements['circle']" in code
    assert "film.cam(" in code
    assert "# layout group group:" not in code


def test_no_silent_camera_or_visual_effect_substitution():
    spec = _scene()
    spec["camera"] = {}
    problems = validate_spec(spec)
    assert any(p["code"] == "CAMERA_INTENT_MISSING" for p in problems)
    with pytest.raises(CompileError):
        compile_spec(spec)
    spec = _scene()
    spec["animation"] = {}
    problems = validate_spec(spec)
    assert any(p["code"] == "MISSING_PLANNED_EFFECT" for p in problems)


def test_unimplemented_property_rejected_before_render():
    spec = _scene()
    spec["animation"]["shift"]["property"] = "material.fill"
    assert any(p["code"] == "UNSUPPORTED_ANIMATION" for p in validate_spec(spec))


def test_group_cycle_fails_preflight():
    spec = _scene()
    spec["objects"]["group"]["memberIds"] = ["circle", "group2"]
    spec["objects"]["group2"] = {"id": "group2", "kind": "group", "memberIds": ["group"], "position": {"x": 0, "y": 0}}
    assert any(p["code"] == "GROUP_CYCLE" for p in validate_spec(spec))


def test_component_records_are_content_addressed():
    code = (
        "from motion_core import *\n"
        "def build_scene(ctx):\n"
        "    film = ctx.film()\n"
        "    film.add(Panel(0, 0, 800, 500, 0.2, title='Original'))\n"
        "    film.cam(0, 0, 0, 0.5)\n"
        "    film.cam(ctx.duration, 200, 0, 0.5)\n"
        "    return film\n"
    )
    # Approval is only supplied AFTER the integration render has been validated
    # by its owner; this unit test checks the trusted round-trip.
    out = register_component("verified_test_component", code, visual_ok=True)
    assert out["ok"], out
    record = export_approved_component(out["name"], out["version"])
    assert record["codeSha256"]
    assert hydrate_approved_component(record)["ok"]
    record["code"] += "\n# tampered\n"
    assert not hydrate_approved_component(record)["ok"]


@pytest.mark.skipif(importlib.util.find_spec("skia") is None, reason="Skia is only in the worker image")
def test_real_frames_prove_world_and_group_motion():
    from clips_worker.motion_studio.core.render import probe_stills
    from PIL import Image, ImageChops

    code = compile_spec(_scene())
    work = tempfile.mkdtemp(prefix="ms_composition_")
    result = probe_stills(code, _ctx(), work, [0.4, 2.5], 640, 360)
    assert result["ok"] and len(result["stills"]) == 2
    first = Image.open(result["stills"][0]["path"]).convert("RGB")
    second = Image.open(result["stills"][1]["path"]).convert("RGB")
    assert ImageChops.difference(first, second).getbbox() is not None


@pytest.mark.skipif(importlib.util.find_spec("skia") is None, reason="Skia is only in the worker image")
def test_registered_component_is_drawn_as_a_real_item():
    from clips_worker.motion_studio.core.render import probe_stills
    from PIL import Image, ImageStat

    code = (
        "from motion_core import *\n"
        "def build_scene(ctx):\n"
        "    film = ctx.film()\n"
        "    film.add(Panel(0, 0, 900, 600, 0.1, title='Original Object'))\n"
        "    film.cam(0, 0, 0, 0.4)\n"
        "    film.cam(ctx.duration, 50, 0, 0.5)\n"
        "    return film\n"
    )
    scratch = tempfile.mkdtemp(prefix="ms_component_valid_")
    probe_stills(code, _ctx(), scratch, [1.0], 320, 180)
    reg = register_component("real_comp", code, visual_ok=True)
    assert reg["ok"], reg
    spec = _scene()
    spec["requiredEffects"].append("custom_component")
    spec["extensions"]["ext"] = {
        "id": "ext", "kind": "extension", "component": reg["name"],
        "componentVersion": reg["version"], "position": {"x": 0, "y": 0},
    }
    spec["objects"]["ext"] = spec["extensions"]["ext"]
    source = compile_spec(spec)
    assert "_FragmentItem" in source and "film_items__component_ext" in source
    result = probe_stills(source, _ctx(), tempfile.mkdtemp(), [1.0], 640, 360)
    assert result["ok"]
    img = Image.open(result["stills"][0]["path"]).convert("RGB")
    assert max(ImageStat.Stat(img).stddev) > 2



def test_approved_component_is_positionable_groupable_and_animatable():
    """Tier-3 content must participate in the SAME directed-object graph as photos."""
    code = (
        "from motion_core import *\\n"
        "def build_scene(ctx):\\n"
        "    film = ctx.film()\\n"
        "    film.add(Panel(0, 0, 500, 300, 0.0, title='Custom'))\\n"
        "    film.cam(0, 0, 0, 0.5)\\n"
        "    film.cam(ctx.duration, 0, 0, 0.5)\\n"
        "    return film\\n"
    )
    registered = register_component("groupable_component", code, visual_ok=True)
    assert registered["ok"], registered
    spec = _scene()
    ext = {
        "id": "ext", "kind": "extension", "component": registered["name"],
        "componentVersion": registered["version"],
        "position": {"x": 300, "y": 120}, "z": 30,
    }
    spec["objects"]["ext"] = ext
    spec["extensions"]["ext"] = ext
    spec["objects"]["group"]["memberIds"].append("ext")
    spec["requiredEffects"].append("custom_component")
    assert validate_spec(spec) == []
    source = compile_spec(spec)
    check_code(source)
    assert lint_scene(source) == []
    assert "_register('ext', film_items_" in source
    assert "_DirectedItem(_elements['ext']" in source
    assert "film.add(film_items_" not in source
    # The approved component participates in the existing animated group.
    assert "'position.x'" in source and "'kind': 'group'" in source


def test_transitions_require_real_adjacent_boundaries():
    from clips_worker.motion_studio.pipeline.transitions import _transitions, _duration_frames
    scenes = [{"index": 0, "frames": 90}, {"index": 1, "frames": 90}]
    rows = {0: {"qa": {"spec": {"transitions": {"t": {
        "type": "dissolve", "fromSceneId": "s0", "toSceneId": "s1",
        "params": {"durationFrames": 12},
    }}}}}, 1: {"qa": {}}}
    transitions = _transitions(scenes, rows)
    assert transitions[0]["type"] == "dissolve"
    assert _duration_frames(transitions[0], *scenes, 30) == 12
    rows[0]["qa"]["spec"]["transitions"]["t"]["toSceneId"] = "missing"
    with pytest.raises(ValueError, match="unbound transition"):
        _transitions(scenes, rows)
