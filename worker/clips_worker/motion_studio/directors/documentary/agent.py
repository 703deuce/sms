"""Documentary Director entry points (the only module the registry loads)."""
from clips_worker.motion_studio.directors.documentary.designer import design_scene  # noqa: F401
from clips_worker.motion_studio.directors.documentary.director import direct  # noqa: F401
from clips_worker.motion_studio.directors.documentary.story import build_story  # noqa: F401
