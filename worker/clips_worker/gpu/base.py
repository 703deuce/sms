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


@dataclass
class FaceTrackReq:
    video_url: str | None = None
    video_path: str | None = None


@dataclass
class RenderReq:
    pass


@dataclass
class RenderRes:
    pass


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
        out.append(
            {
                "w": w,
                "s": round(s, 3),
                "e": round(e, 3),
                "p": round(p, 3),
                "i": pos,
            }
        )
    return out
