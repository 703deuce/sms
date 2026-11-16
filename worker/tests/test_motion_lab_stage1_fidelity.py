"""Regression coverage for the Stage 1 saved-world render fidelity failures."""
import ast

from clips_worker.motion_studio.tools.plan import _prepare_engineer_tools
from clips_worker.motion_studio.tools.composition import RUNTIME
from motion_lab.run import world_camera_fit


def _shape(id, kind, points=None, position=None):
    return {
        "id": id, "kind": kind, "position": position or {"x": 0, "y": 0},
        "size": {"width": 10000, "height": 2000},
        "fill": "#4DE0FF", "points": points or [],
    }


def test_idless_engineer_world_copies_are_not_rendered_twice():
    horizon = _shape("horizon", "line", [[-5000, -560], [5000, -560]],
                     {"x": -5000, "y": -560})
    tower = _shape("tower", "path", [[-4000, -560], [-4000, -2200], [-3000, -2200]],
                   {"x": -3500, "y": -560})
    extras = _shape("new_approved_detail", "line", [[0, 0], [10, 10]])
    calls = [{"tool": "create_environment", "arguments": {
        "environmentId": "world_grid",
        "backdrop": {"kind": "geometry", "elements": [
            {k: v for k, v in horizon.items() if k != "id"},
            {k: v for k, v in tower.items() if k != "id"},
            extras,
        ]},
    }}]
    prepared, adjustments, errors = _prepare_engineer_tools(
        calls, approved_world=[horizon, tower], duration_s=4, fps=24,
        world_id="world_grid")
    assert not errors
    built = prepared[0]["arguments"]["backdrop"]["elements"]
    assert [s["id"] for s in built] == ["horizon", "tower", "new_approved_detail"]
    assert any(x.get("droppedIdlessCopies") == 2 for x in adjustments)


def test_camera_fit_uses_same_absolute_points_as_renderer():
    world = {"environmentElements": [
        _shape("sky", "surface", position={"x": 0, "y": 0}),
        _shape("horizon", "line", [[-5000, -560], [5000, -560]],
               {"x": -5000, "y": -560}),
        _shape("towers", "path", [[-4925, -560], [-4925, -2200], [-3000, -2200]],
               {"x": -3700, "y": -560}),
    ]}
    pose, audit = world_camera_fit(world)
    assert audit["bounds"][0] == -5000
    assert audit["bounds"][2] == 5000
    assert "horizon" in audit["framedGeometryIds"]
    assert pose["zoom"] > 0.3


def test_explicit_local_points_still_translate_for_framing():
    shape = _shape("local", "line", [[0, 0], [100, 0]],
                   {"x": 500, "y": 700})
    shape["pointsSpace"] = "local"
    _, audit = world_camera_fit({"environmentElements": [shape]})
    assert audit["bounds"] == (500.0, 700.0, 600.0, 700.0)


def test_environment_runtime_supports_separate_subpaths():
    ast.parse(RUNTIME)
    assert 's.get("segments")' in RUNTIME
    assert 's.get("segmentMode") == "pairs"' in RUNTIME
    assert "path.moveTo(float(segment[0][0])" in RUNTIME

def test_environment_runtime_has_no_comprehension_local_scope_lint_failure():
    """Prevent Stage 1's 'undefined name i' regression in emitted source."""
    tree = ast.parse(RUNTIME)
    for node in ast.walk(tree):
        assert not isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp))
