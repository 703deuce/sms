"""Single source of truth for worker claimable job types."""
from __future__ import annotations

JOB_TYPES: tuple[str, ...] = (
    "IMPORT_URL",
    "STREAM_IMPORT",
    "STREAM_ANALYZE",
    "STREAM_RENDER",
    "STREAM_RELAYOUT",
    "STREAM_CLEANUP",
    "STREAM_MONTAGE",
    "STREAM_AUTOPULL",
    "PROCESS_PROJECT",
    "RENDER_CLIP",
    "REFRAME_CROP",
    "MUSIC",
    "THUMBNAIL",
    "DUB",
    "STUDIO_SOUND",
    "RENDER_SCRIPT_COMPOSITION",
)


def job_types_sql_in() -> str:
    return ", ".join(f"'{t}'" for t in JOB_TYPES)
