"""Regression coverage for Stage 1 world construction ownership and tool handoff.

This test intentionally makes no provider requests or GPU renders.
"""
from clips_worker.motion_studio.directors.documentary.production import validate_lab_world_only
from clips_worker.motion_studio.tools.plan import _prepare_engineer_tools


def _world():
    return [
        {"id": "env_ground", "kind": "surface", "position": {"x": 0, "y": 180},
         "size": {"width": 3000, "height": 1800}, "fill": "#071120",
         "opacity": 1, "z": 0, "rotation": 0, "points": [[-960, 540], [960, 540]]},
        {"id": "env_horizon", "kind": "line", "position": {"x": 0, "y": -280},
         "size": {"width": 1920, "height": 2}, "fill": "#4F789D",
         "opacity": 0.72, "z": 1, "rotation": 0, "points": [[-960, -280], [960, -280]]},
    ]


def _scene(elements):
    return {"scenes": [{"index": 0}],
            "blueprint": {"worlds": [{"id": "world_grid", "environmentElements": _world()}],
                          "sceneBindings": [{"sceneIndex": 0, "worldId": "world_grid",
                                             "cameraIntent": "hold", "cameraShots": [],
                                             "requiredEffects": ["environment_geometry"],
                                             "compositionElements": elements}]}}


def test_lab_rejects_composite_phantom_id_instead_of_wasting_engineer_rounds():
    errors = validate_lab_world_only(_scene([
        {"id": "street_perspective_lines", "kind": "environment", "groupId": "city_composition",
         "connectTo": "env_horizon", "motion": "Static."}
    ]))
    assert len(errors) == 1
    assert "does not reference any approved world geometry ID" in errors[0]


def test_lab_accepts_static_approved_world_ids_without_tool_object_duplicates():
    assert validate_lab_world_only(_scene([
        {"id": "env_ground", "kind": "surface", "groupId": None, "connectTo": None,
         "motion": "Static environment surface."},
        {"id": "env_horizon", "kind": "line", "groupId": None, "connectTo": None,
         "motion": None},
        {"id": "title", "kind": "text", "groupId": "title_group",
         "motion": "Fade in title"},
    ])) == []


def test_lab_rejects_camera_travel_even_without_required_effect():
    plan = _scene([])
    plan["blueprint"]["sceneBindings"][0]["cameraShots"] = [{
        "fromPose": {"x": 0, "y": 0, "zoom": 1, "rot": 0},
        "toPose": {"x": 20, "y": 0, "zoom": 1, "rot": 0},
    }]
    assert any("cameraShots" in e for e in validate_lab_world_only(plan))


def test_tool_boundary_uses_designers_exact_world_when_engineer_forgets_environment():
    approved = _world()
    calls = [{"tool": "draw_path",
              "arguments": {"objectId": "foreground_stroke",
                            "environmentId": "world_grid",
                            "points": [{"x": 0, "y": 0}, {"x": 1, "y": 1}],
                            "width": 2}}]
    prepared, changes, errors = _prepare_engineer_tools(
        calls, approved_world=approved, duration_s=4.0, fps=24,
        world_id="world_grid", world_brief="A city from Luna's designed shapes")
    assert not errors
    assert prepared[0]["tool"] == "create_environment"
    assert prepared[0]["arguments"]["backdrop"]["elements"] == approved
    assert any(e["kind"] == "insert_approved_environment" for e in changes)
    assert calls[0]["tool"] == "draw_path"


def test_tool_boundary_overrides_engineers_rewritten_geometry_with_audit():
    approved = _world()
    calls = [{"tool": "create_environment",
              "arguments": {"environmentId": "world_grid", "brief": "city",
                            "backdrop": {"elements": [
                                {"id": "env_ground", "kind": "environment",
                                 "fill": "#BADBAD"}
                            ]}}}]
    prepared, changes, errors = _prepare_engineer_tools(
        calls, approved_world=approved, duration_s=4.0, fps=24,
        world_id="world_grid")
    assert not errors
    assert prepared[0]["arguments"]["backdrop"]["elements"] == approved
    assert changes[0]["overridden"][0]["id"] == "env_ground"
    assert "env_horizon" in changes[0]["restoredIds"]


def test_tool_boundary_does_not_assign_ambiguous_environment_ids():
    prepared, changes, errors = _prepare_engineer_tools(
        [{"tool": "draw_path", "arguments": {"environmentId": "wrong_world"}}],
        approved_world=_world(), duration_s=4, fps=24, world_id="world_grid")
    assert not prepared
    assert errors[0]["code"] == "MISSING_ENVIRONMENT_TOOL"


def test_lab_allows_independent_foreground_paths_with_unique_ids():
    assert validate_lab_world_only(_scene([
        {"id": "city_center_tower", "kind": "path", "groupId": "city_reveal_group",
         "connectTo": "env_horizon", "motion": "Draw the tower edge upward."},
        {"id": "junction_marks", "kind": "circle", "groupId": "city_reveal_group",
         "connectTo": None, "motion": "Fade in after the tower."},
    ])) == []
