"""Documentary Director entry points (the only module the registry loads)."""
from clips_worker.motion_studio.directors.documentary.designer import design_scene  # noqa: F401
from clips_worker.motion_studio.directors.documentary.contracts import validate_blueprint
from clips_worker.motion_studio.directors.documentary.director import direct as direct_editorial, validate_plan
from clips_worker.motion_studio.directors.documentary.production import design_production, revise_limited_scenes  # noqa: F401
from clips_worker.motion_studio.directors.documentary.story import build_story  # noqa: F401


def direct(project: dict, story: dict, catalog: list[dict], log) -> dict:
    """Film Director editorial plan, then the Production Designer blueprint + asset manifest."""
    plan = direct_editorial(project, story, catalog, log)
    return design_production(project, story, catalog, plan, log)
