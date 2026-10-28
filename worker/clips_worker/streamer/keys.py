from __future__ import annotations


def stream_audio_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/audio.opus"


def stream_window_audio_key(workspace_id: str, vod_id: str, window_end_ms: int) -> str:
    """Rolling live-capture window audio (avoids overwriting while analyze is queued)."""
    return f"ws/{workspace_id}/streams/{vod_id}/windows/{int(window_end_ms)}.opus"


def stream_chunk_key(workspace_id: str, vod_id: str, index: int, ext: str, *, window_tag: str | None = None) -> str:
    if window_tag:
        return f"ws/{workspace_id}/streams/{vod_id}/windows/{window_tag}/chunk_{index}.{ext}"
    return f"ws/{workspace_id}/streams/{vod_id}/chunks/{index}.{ext}"


def stream_signals_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/signals.json"


def stream_candidates_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/rank_candidates.json"


def stream_chat_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/chat.jsonl.gz"


def stream_frame_key(workspace_id: str, vod_id: str, index: int) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/frames/{index}.jpg"


def clip_segment_key(workspace_id: str, project_id: str, clip_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/source_seg.mp4"


def montage_output_key(workspace_id: str, project_id: str, montage_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/montages/{montage_id}.mp4"


def montage_poster_key(workspace_id: str, project_id: str, montage_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/montages/{montage_id}.jpg"


def clip_chat_key(workspace_id: str, project_id: str, clip_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/chat.json"
