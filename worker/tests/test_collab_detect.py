"""Collab detection heuristics for streamer transcribe routing."""
from __future__ import annotations

from clips_worker.streamer.collab_detect import (
    detect_collab,
    resolve_vod_transcribe_provider,
    tags_collab_signal,
    title_collab_signal,
)


def test_title_collab_ft():
    sig = title_collab_signal("Late Night w/ @GuestStreamer — collab special")
    assert sig["hit"] is True


def test_title_solo():
    assert title_collab_signal("Solo ranked grind")["hit"] is False


def test_tags_collab():
    assert tags_collab_signal(["collab", "fps"])["hit"] is True


def test_resolve_collab_uses_modal_diarize():
    assert resolve_vod_transcribe_provider(True, {}) == "modal_diarize"


def test_always_detect_speakers_override():
    settings = {"streamer": {"alwaysDetectSpeakers": True}}
    assert resolve_vod_transcribe_provider(False, settings) == "modal_diarize"


def test_detect_collab_title_only():
    vod = {"title": "Stream ft. Friend", "durationMs": 3_600_000}
    det = detect_collab(vod=vod, state={}, settings={}, video_path=None, scratch=__import__("pathlib").Path("/tmp"))
    assert det.collab_detected is True
    assert det.provider in ("modal", "modal_diarize")
