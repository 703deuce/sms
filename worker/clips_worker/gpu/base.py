from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class TranscribeReq:
    audio_url: str | None = None
    audio_path: str | None = None
    offset_ms: int = 0
    language: str | None = None
    initial_prompt: str | None = None
    model: str | None = None


@dataclass
class TranscribeRes:
    words: list[dict]
    language: str
    duration_s: float
    gpu_seconds: float
    provider: str
    transcription_engine: str = "local_whisper"
    fallback_reason: str | None = None


@dataclass
class FaceTrackReq:
    video_url: str | None = None
    video_path: str | None = None


@dataclass
class RenderReq:
    segment_url: str | None = None
    filtergraph: str | None = None
    out_upload_url: str | None = None
    encoder: str = "libx264"


@dataclass
class RenderRes:
    ok: bool = True
    duration_ms: int = 0
    size_bytes: int = 0
    gpu_seconds: float = 0.0
    provider: str = "modal"


class GpuProvider(Protocol):
    name: str

    def transcribe(self, req: TranscribeReq) -> TranscribeRes: ...

    def transcribe_many(self, reqs: list[TranscribeReq]) -> list[TranscribeRes]: ...

    def face_track(self, req: FaceTrackReq) -> dict: ...

    def render_batch(self, reqs: list[RenderReq]) -> list[RenderRes]: ...


def normalize_words(raw_segments: list[dict], offset_ms: int = 0) -> list[dict]:
    """Map faster-whisper / Modal word dicts to pipeline shape {w,s,e,p,i}."""
    offset_s = offset_ms / 1000.0
    out: list[dict] = []
    for pos, item in enumerate(raw_segments):
        if "w" in item:
            w = item["w"]
            s = float(item["s"])
            e = float(item["e"])
            p = float(item.get("p", item.get("prob", 0)))
        else:
            w = (item.get("word") or "").strip()
            s = float(item.get("start", 0)) + offset_s
            e = float(item.get("end", 0)) + offset_s
            p = float(item.get("prob", item.get("probability", 0)))
        row: dict = {
            "w": w,
            "s": round(s, 3),
            "e": round(e, 3),
            "p": round(p, 3),
            "i": pos,
        }
        spk = item.get("spk")
        if spk is None and item.get("speaker") is not None:
            spk = item.get("speaker")
        if spk is not None:
            try:
                row["spk"] = int(spk)
            except (TypeError, ValueError):
                pass
        out.append(row)
    return out
