"""Single source of truth for worker claimable job types."""
from __future__ import annotations

JOB_TYPES: tuple[str, ...] = (
    "IMPORT_URL",
    "STREAM_IMPORT",
    "STREAM_AGENT_PREPARE",
    "STREAM_ANALYZE",
    "STREAM_RENDER",
    "STREAM_RELAYOUT",
    "STREAM_CLEANUP",
    "STREAM_MONTAGE",
    "STREAM_AUTOPULL",
    "FIND_CLIPS",
    "PROCESS_PROJECT",
    "REPLACE_CLIP",
    "RENDER_CLIP",
    "BG_MATTE_PREVIEW",
    "REFRAME_CROP",
    "MUSIC",
    "THUMBNAIL",
    "DUB",
    "STUDIO_SOUND",
    "RENDER_SCRIPT_COMPOSITION",
    "T2V_ASSEMBLE",
    "T2V_EXTRACT_DECK",
    "T2V_VOICE_CLONE",
    "T2V_SCENE_AI_IMAGE",
    "T2V_SCENE_AI_VIDEO",
    "MEDIA_SYNC",
    "MEDIA_TRANSCRIBE",
    "AI_PRODUCER_AGENT_ANALYZE",
    "AI_PRODUCER_AGENT_RUN",
)


def bind_ai_producer_agent_dispatch(dispatch: dict) -> None:
    """Hook worker handlers from the new module (called from main after DISPATCH is built)."""
    from clips_worker.ai_producer_agent.bootstrap import register_dispatch

    register_dispatch(dispatch)


def job_types_sql_in() -> str:
    return ", ".join(f"'{t}'" for t in JOB_TYPES)
