from __future__ import annotations


def stream_audio_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/audio.opus"


def stream_chunk_key(workspace_id: str, vod_id: str, index: int, ext: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/chunks/{index}.{ext}"


def stream_signals_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/signals.json"


def stream_chat_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/chat.jsonl.gz"


def stream_frame_key(workspace_id: str, vod_id: str, index: int) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/frames/{index}.jpg"


def clip_segment_key(workspace_id: str, project_id: str, clip_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/source_seg.mp4"
