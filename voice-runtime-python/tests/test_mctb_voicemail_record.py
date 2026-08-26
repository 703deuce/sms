"""Tests for MCTB SIP voicemail recording helpers."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from livekit import rtc

from transovo_voice.session.mctb_voicemail_record import (
    _find_remote_audio_track,
    _pcm_duration_seconds,
    _subscribe_remote_audio_publications,
)


def _audio_publication(*, has_track: bool = True, subscribed: bool = False) -> MagicMock:
    publication = MagicMock(spec=rtc.RemoteTrackPublication)
    publication.kind = rtc.TrackKind.KIND_AUDIO
    publication.sid = "PUB_AUDIO"
    publication.subscribed = subscribed
    if has_track:
        track = MagicMock()
        track.kind = rtc.TrackKind.KIND_AUDIO
        track.sid = "TR_AUDIO"
        publication.track = track
    else:
        publication.track = None
    return publication


def test_find_remote_audio_track_returns_subscribed_track():
    participant = MagicMock()
    publication = _audio_publication()
    participant.track_publications = {publication.sid: publication}

    track = _find_remote_audio_track(participant)

    assert track is publication.track


def test_find_remote_audio_track_skips_video_and_missing_track():
    participant = MagicMock()
    video = MagicMock()
    video.kind = rtc.TrackKind.KIND_VIDEO
    video.track = MagicMock()
    missing = _audio_publication(has_track=False)
    participant.track_publications = {
        "video": video,
        missing.sid: missing,
    }

    assert _find_remote_audio_track(participant) is None


def test_subscribe_remote_audio_publications_calls_set_subscribed():
    participant = MagicMock()
    audio = _audio_publication(has_track=False)
    video = MagicMock()
    video.kind = rtc.TrackKind.KIND_VIDEO
    participant.track_publications = {audio.sid: audio, "video": video}

    count = _subscribe_remote_audio_publications(participant)

    assert count == 1
    audio.set_subscribed.assert_called_once_with(True)


def test_pcm_duration_seconds_half_second():
    bytes_per_second = 24_000 * 2
    pcm = b"\x00" * (bytes_per_second // 2)
    assert _pcm_duration_seconds(pcm) == pytest.approx(0.5)
