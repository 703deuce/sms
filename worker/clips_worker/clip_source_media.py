"""Resolve clip export / studio-sound source when project upload is deleted."""
from __future__ import annotations

from clips_worker.storage import _s3_missing_key, _s3_object_meta


def _object_exists(object_key: str) -> bool:
    try:
        _s3_object_meta(object_key)
        return True
    except Exception as exc:
        from botocore.exceptions import ClientError

        if isinstance(exc, ClientError) and _s3_missing_key(exc):
            return False
        raise


def resolve_clip_export_source(ctx: dict) -> tuple[str | None, int, str]:
    """
    Return (storage_key, source_offset_ms, reason).
    Prefers persisted segment keys; falls back to canonical source_seg path, preview, upload.
    """
    seg = ctx.get("sourceSegKey")
    if seg:
        if _object_exists(str(seg)):
            return str(seg), int(ctx.get("sourceSegStartMs") or 0), "sourceSegKey"
        from clips_worker.decision_log import decision_log

        decision_log(
            "editor",
            "storage_object_missing",
            clipId=str(ctx.get("clipId") or ""),
            keyKind="sourceSegKey",
            storageKey=str(seg)[:120],
        )

    workspace_id = str(ctx.get("workspaceId") or "")
    project_id = str(ctx.get("projectId") or "")
    clip_id = str(ctx.get("clipId") or "")
    if workspace_id and project_id and clip_id:
        from clips_worker.streamer.keys import clip_segment_key

        canonical = clip_segment_key(workspace_id, project_id, clip_id)
        if _object_exists(canonical):
            off = int(ctx.get("sourceSegStartMs") or ctx.get("startMs") or 0)
            return canonical, off, "canonical_source_seg"

    upload = ctx.get("source_key")
    if upload and _object_exists(str(upload)):
        return str(upload), 0, "upload"

    preview = ctx.get("previewKey")
    if preview and _object_exists(str(preview)):
        return str(preview), int(ctx.get("startMs") or 0), "previewKey_composite"

    return None, 0, "missing"
