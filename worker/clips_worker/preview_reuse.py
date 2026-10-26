"""When RENDER_CLIP may copy preview.mp4 instead of re-encoding."""

from clips_worker.edits_render import is_default_edits

CLIP_PREVIEW_ASPECT = "9:16"
CLIP_PREVIEW_RESOLUTION = "720p"


def can_reuse_clip_preview_for_render(
    aspect: str,
    resolution: str,
    edits: dict,
    clip_start_ms: int,
    clip_end_ms: int,
) -> bool:
    return (
        aspect == CLIP_PREVIEW_ASPECT
        and resolution == CLIP_PREVIEW_RESOLUTION
        and is_default_edits(edits, clip_start_ms, clip_end_ms)
    )
