"""Mirror of new-app/lib/clips/export-edits-match.ts for preview.mp4 reuse."""

from __future__ import annotations

from clips_worker.edits_render import default_edits, is_default_edits


def preview_export_matches(edits: dict, clip_start_ms: int, clip_end_ms: int) -> bool:
    if not is_default_edits(edits, clip_start_ms, clip_end_ms):
        return False
    d = default_edits(clip_start_ms, clip_end_ms)
    if edits.get("broll"):
        return False
    zoom = edits.get("zoom") if isinstance(edits.get("zoom"), dict) else {}
    if zoom.get("enabled"):
        return False
    silence = edits.get("silenceTrim") if isinstance(edits.get("silenceTrim"), dict) else {}
    if silence.get("enabled"):
        return False
    audio = edits.get("audio") if isinstance(edits.get("audio"), dict) else {}
    if audio.get("music") or (audio.get("sfx") or []):
        return False
    layout = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    if (layout.get("mode") or d["layout"]["mode"]) != d["layout"]["mode"]:
        return False
    aspect = edits.get("aspectRatio")
    if aspect and aspect != "9:16":
        return False
    cap = edits.get("captions") if isinstance(edits.get("captions"), dict) else {}
    dcap = d.get("captions") or {}
    for key in ("enabled", "presetId", "animation", "size", "position", "case", "wordsPerLine"):
        if cap.get(key, dcap.get(key)) != dcap.get(key):
            return False
    return True
