"""Stage 1 camera-composition and real line-endpoint regression coverage."""
import ast
from pathlib import Path

# import the standalone lab only in an environment that has worker renderer deps.
from motion_lab.run import world_camera_fit
from clips_worker.motion_studio.tools.composition import RUNTIME


def test_environment_line_uses_authored_points_not_size_as_endpoints():
    tree = ast.parse(RUNTIME)
    shape = next(n for n in tree.body
                 if isinstance(n, ast.ClassDef) and n.name == "_EnvironmentShape")
    draw = next(n for n in shape.body
                if isinstance(n, ast.FunctionDef) and n.name == "draw")
    source = ast.unparse(draw)
    assert 's.get("points")' in source or "s.get('points')" in source
    assert "path.moveTo(" in source
    assert "path.lineTo(" in source
    assert "c.drawPath(path, p)" in source


def test_world_fit_ignores_large_background_and_frames_near_towers():
    world = {"environmentElements": [
        {"id": "city_void", "kind": "surface", "position": {"x": 0, "y": 0},
         "size": {"width": 18000, "height": 11000}},
        {"id": "ground_plane", "kind": "path", "position": {"x": 0, "y": 1700},
         "size": {"width": 15400, "height": 4000},
         "points": [[-7700, 0], [7700, 0], [15000, 4000], [-15000, 4000]]},
        {"id": "horizon_seam", "kind": "line", "position": {"x": 0, "y": -250},
         "size": {"width": 15000, "height": 0},
         "points": [[-7500, 0], [7500, 0]]},
        {"id": "tower_left_near", "kind": "path",
         "position": {"x": -4300, "y": -1500}, "size": {"width": 1100, "height": 3000},
         "points": [[-550, 1500], [-550, -1500], [550, -1500], [550, 1500]]},
        {"id": "grid_ray_left_outer", "kind": "line",
         "position": {"x": 0, "y": -250}, "size": {"width": 0, "height": 6500},
         "points": [[0, 0], [-7700, 6500]]},
    ]}
    pose, info = world_camera_fit(world)
    assert 0.1 < pose["zoom"] < 0.5
    assert pose["y"] > 0
    assert "city_void" in info["excludedBackdrops"]
    assert "ground_plane" in info["excludedBackdrops"]
    assert "tower_left_near" in info["framedGeometryIds"]
    assert "horizon_seam" in info["framedGeometryIds"]


def test_camera_fit_is_static_and_does_not_change_model_world():
    world = {"environmentElements": [
        {"id": "edge_a", "kind": "line", "position": {"x": 0, "y": 0},
         "size": {"width": 4000, "height": 0},
         "points": [[-2000, 0], [2000, 0]]},
        {"id": "dot", "kind": "circle", "position": {"x": 500, "y": 1000},
         "size": {"width": 250, "height": 250}},
    ]}
    import copy
    initial = copy.deepcopy(world)
    pose, info = world_camera_fit(world)
    assert world == initial
    assert pose["rot"] == 0
    assert info["method"].startswith("authored-geometry-bounds")
