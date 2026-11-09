"""Bulky vs retained stream object keys (no storage deps — unit-testable)."""
from __future__ import annotations

from typing import Iterable

from clips_worker.streamer.keys import (
    stream_audio_key,
    stream_chunk_key,
    stream_frame_key,
)


def _unique_keys(keys: Iterable[str | None]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for k in keys:
        if not k or not str(k).strip():
            continue
        s = str(k).strip()
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def collect_bulky_stream_keys(
    *,
    workspace_id: str,
    vod_id: str,
    state: dict,
    clip_rows: list[dict],
    platform: str | None = None,
) -> list[str]:
    keys: list[str | None] = [stream_audio_key(workspace_id, vod_id)]
    if state.get("audioKey"):
        keys.append(str(state["audioKey"]))
    if state.get("chatKey"):
        keys.append(str(state["chatKey"]))
    if state.get("analysisProxyKey"):
        keys.append(str(state["analysisProxyKey"]))
    if state.get("localUploadKey") and platform != 'upload':
        keys.append(str(state["localUploadKey"]))
    if state.get("windowCaptureVideoKey"):
        keys.append(str(state["windowCaptureVideoKey"]))

    windows = state.get("windows") or {}
    if isinstance(windows, dict):
        for _end, meta in windows.items():
            if not isinstance(meta, dict):
                continue
            if meta.get("audioKey"):
                keys.append(str(meta["audioKey"]))
            if meta.get("videoKey"):
                keys.append(str(meta["videoKey"]))

    chunks = state.get("chunks") or {}
    for idx, meta in chunks.items():
        if not isinstance(meta, dict):
            continue
        try:
            i = int(idx)
        except (TypeError, ValueError):
            continue
        keys.append(stream_chunk_key(workspace_id, vod_id, i, "opus"))
        wk = meta.get("wordsKey")
        if wk:
            keys.append(str(wk))

    frames = state.get("frames") or {}
    if isinstance(frames, dict):
        for idx in frames:
            try:
                keys.append(stream_frame_key(workspace_id, vod_id, int(idx)))
            except (TypeError, ValueError):
                continue

    return _unique_keys(keys)
