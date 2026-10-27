"""Clips script recording server-side LiveKit helpers (M14–M16).

Repurpose slot on the existing transovo-voice worker container — webhooks, optional
RoomComposite egress safety track, or guest upload-failure fallback. Primary capture
remains browser MediaRecorder → B2 (see docs/clips/descript/livekit-api-brief.md).

Does not modify SIP / telephony env vars; phone flows are legacy.
"""

from transovo_voice.clips_recording.config import livekit_credentials_for_recording, recording_livekit_target

__all__ = ['livekit_credentials_for_recording', 'recording_livekit_target']
