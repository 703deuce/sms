"""Collab vs solo detection before full-VOD transcription."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from clips_worker.deepgram_transcribe import deepgram_api_key
from clips_worker.reframe_routing import probe_video_person_count
from clips_worker.streamer.transcribe_stream import resolve_stream_transcribe_provider

_TITLE_COLLAB_RE = re.compile(
    r"(?i)\b(collab|collaboration|co-?stream|dual\s*stream|multistream)\b"
    r"|(?:\bft\.?\b|\bfeat\.?\b|\bfeaturing\b)"
    r"|(?:\bw/\b|\bwith\b)"
    r"|@[\w]{2,}",
)

_PROBE_SAMPLE_S = float(os.environ.get("STREAMER_COLLAB_PROBE_SAMPLE_S", "8"))
_PROBE_SAMPLES = int(os.environ.get("STREAMER_COLLAB_PROBE_SAMPLES", "5"))


@dataclass
class CollabDetection:
    collab_detected: bool
    provider: str
    signals: dict[str, Any]


def _streamer_settings(settings: dict) -> dict:
    raw = settings.get("streamer") or {}
    return raw if isinstance(raw, dict) else {}


def title_collab_signal(title: str | None) -> dict[str, Any]:
    text = (title or "").strip()
    if not text:
        return {"hit": False, "title": ""}
    hit = bool(_TITLE_COLLAB_RE.search(text))
    return {"hit": hit, "title": text[:200]}


def tags_collab_signal(tags: list[str] | None) -> dict[str, Any]:
    if not tags:
        return {"hit": False, "tags": []}
    joined = " ".join(str(t) for t in tags)
    hit = bool(_TITLE_COLLAB_RE.search(joined))
    return {"hit": hit, "tags": [str(t) for t in tags[:20]]}


def twitch_guest_signal(state: dict) -> dict[str, Any]:
    meta = state.get("importMeta") or {}
    if not isinstance(meta, dict):
        return {"hit": False}
    shared = meta.get("sharedChat") or meta.get("shared_chat")
    guests = meta.get("guests") or meta.get("guestStar") or meta.get("guest_star")
    hit = bool(shared) or (isinstance(guests, list) and len(guests) > 0)
    return {
        "hit": hit,
        "sharedChat": bool(shared) if shared is not None else False,
        "guestCount": len(guests) if isinstance(guests, list) else 0,
    }


def _ffmpeg_sample_clip(video: Path, dest: Path, start_s: float, duration_s: float) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start_s:.3f}",
            "-t",
            f"{duration_s:.3f}",
            "-i",
            str(video),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "28",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def multiperson_probe_signal(video: Path, duration_ms: int, scratch: Path) -> dict[str, Any]:
    if duration_ms <= 0 or not video.exists():
        return {"hit": False, "skipped": True, "reason": "no_video"}
    n = max(1, min(_PROBE_SAMPLES, 8))
    dur_s = max(1.0, duration_ms / 1000.0)
    sample_dur = min(_PROBE_SAMPLE_S, max(3.0, dur_s / (n * 4)))
    max_persons = 0
    samples: list[dict[str, int]] = []
    probe_dir = scratch / "collab_probe"
    probe_dir.mkdir(parents=True, exist_ok=True)
    for i in range(n):
        center_s = dur_s * (i + 1) / (n + 1)
        start_s = max(0.0, center_s - sample_dur / 2)
        clip = probe_dir / f"sample_{i}.mp4"
        try:
            _ffmpeg_sample_clip(video, clip, start_s, sample_dur)
            summary = probe_video_person_count(clip)
            n_p = int(summary.n_persons)
            max_persons = max(max_persons, n_p)
            samples.append({"tMs": int(start_s * 1000), "nPersons": n_p})
        except Exception as exc:
            samples.append({"tMs": int(start_s * 1000), "error": type(exc).__name__})
    hit = max_persons >= 2
    return {
        "hit": hit,
        "maxPersons": max_persons,
        "samples": samples,
        "skipped": False,
    }


def resolve_vod_transcribe_provider(collab_detected: bool, settings: dict) -> str:
    streamer = _streamer_settings(settings)
    if streamer.get("alwaysDetectSpeakers"):
        if deepgram_api_key():
            return "deepgram"
        return resolve_stream_transcribe_provider()
    if collab_detected:
        if deepgram_api_key():
            return "deepgram"
        return resolve_stream_transcribe_provider()
    return resolve_stream_transcribe_provider()


def detect_collab(
    *,
    vod: dict,
    state: dict,
    settings: dict,
    video_path: Path | None,
    scratch: Path,
) -> CollabDetection:
    streamer = _streamer_settings(settings)
    always_speakers = bool(streamer.get("alwaysDetectSpeakers"))
    title_sig = title_collab_signal(vod.get("title"))
    tags = state.get("importMeta", {}).get("tags") if isinstance(state.get("importMeta"), dict) else None
    if not tags and isinstance(state.get("tags"), list):
        tags = state.get("tags")
    tags_sig = tags_collab_signal(tags if isinstance(tags, list) else None)
    twitch_sig = twitch_guest_signal(state)
    video_sig = (
        multiperson_probe_signal(video_path, int(vod.get("durationMs") or 0), scratch)
        if video_path
        else {"hit": False, "skipped": True, "reason": "no_video_source"}
    )

    collab = always_speakers or title_sig.get("hit") or tags_sig.get("hit") or twitch_sig.get("hit") or video_sig.get("hit")
    provider = resolve_vod_transcribe_provider(collab, settings)
    signals = {
        "alwaysDetectSpeakers": always_speakers,
        "title": title_sig,
        "tags": tags_sig,
        "twitchGuest": twitch_sig,
        "multipersonProbe": video_sig,
    }
    return CollabDetection(collab_detected=collab, provider=provider, signals=signals)


def log_collab_detection(
    *,
    vod_id: str,
    project_id: str,
    detection: CollabDetection,
) -> None:
    sig_json = json.dumps(detection.signals, separators=(",", ":"), default=str)
    print(
        f"[clipper:stream] collab_detected vodId={vod_id} projectId={project_id} "
        f"collab={detection.collab_detected} provider={detection.provider} signals={sig_json}",
        file=sys.stderr,
        flush=True,
    )
