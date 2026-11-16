"""Regression: Stage 1 Engineer repairs are deltas, not replacement scenes."""
from clips_worker.motion_studio.directors.documentary.engineer import merge_engineer_tool_repairs
from clips_worker.motion_studio.tools.plan import compile_agent_output


def _world():
    return [{"id": "grid_vanishing_pin", "kind": "circle",
             "position": {"x": 0, "y": -360}, "size": {"width": 60, "height": 60},
             "fill": "#4DE0FF", "opacity": 1, "z": 1, "rotation": 0}]


def _binding():
    return [
        {"id": "grid_vanishing_pin", "kind": "environment", "purpose": "Vanishing point"},
        {"id": "world_title", "kind": "typography", "purpose": "Opening headline",
         "motion": "Reveal title over first second", "connectTo": "grid_vanishing_pin"},
    ]


def _original():
    return [
        {"tool": "create_environment", "arguments": {
            "environmentId": "world_grid", "brief": "Luna-approved static world",
            "backdrop": {"elements": _world()}}},
        {"tool": "animate_text", "arguments": {
            "environmentId": "world_grid", "typeId": "world_title",
            "text": "A WORLD TAKES SHAPE", "position": {"x": 0, "y": -300},
            "entrance": {"type": "reveal"}, "role": "title", "size": 120}},
    ]


def _compile(tools):
    return compile_agent_output(
        {"tools": tools}, scene_id="lab_stage1", duration_s=4, fps=24,
        required_effects=["environment_geometry", "typography"],
        world_elements=_world(), world_id="world_grid",
        composition_elements=_binding(), camera_intent="hold")


def test_spatial_title_anchor_not_misread_as_mandatory_connector():
    result = _compile(_original())
    assert result["ok"], result.get("errors")
    assert "world_title" in result["spec"]["typography"]


def test_title_entrance_satisfies_its_authored_reveal_motion():
    result = _compile(_original())
    assert result["ok"], result.get("errors")
    assert result["spec"]["typography"]["world_title"]["entrance"]["type"] == "reveal"


def test_repair_keeps_environment_title_and_adds_new_animation():
    patch = [{"tool": "animate_property", "arguments": {
        "targetId": "world_title", "property": "opacity", "from": 0, "to": 1,
        "startFrame": 0, "endFrame": 24, "animationId": "world_title_fade"}}]
    merged, audit = merge_engineer_tool_repairs(_original(), patch)
    assert [x["tool"] for x in merged] == [
        "create_environment", "animate_text", "animate_property"]
    assert audit["previousCalls"] == 2 and audit["resultCalls"] == 3
    assert _compile(merged)["ok"]


def test_repair_replaces_same_title_without_deleting_environment():
    patch = [{"tool": "animate_text", "arguments": {
        "environmentId": "world_grid", "typeId": "world_title",
        "text": "NEW TITLE", "position": {"x": 0, "y": -450},
        "entrance": {"type": "fade"}, "size": 120}}]
    merged, audit = merge_engineer_tool_repairs(_original(), patch)
    assert len(merged) == 2
    assert merged[1]["arguments"]["text"] == "NEW TITLE"
    assert len(audit["replaced"]) == 1
    assert _compile(merged)["ok"]
