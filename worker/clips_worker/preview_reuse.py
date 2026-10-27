"""When RENDER_CLIP may copy preview.mp4 instead of re-encoding."""

from clips_worker.preview_edits_match import preview_export_matches

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
        and preview_export_matches(edits, clip_start_ms, clip_end_ms)
    )
