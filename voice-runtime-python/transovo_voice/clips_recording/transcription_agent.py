"""LiveKit agent: Rooms live captions via Deepgram (data topic `rooms-captions`)."""

from __future__ import annotations

import json
import logging
import os

from livekit.agents import AutoSubscribe, JobContext
from livekit import rtc

logger = logging.getLogger('transovo-clips-transcription')

AGENT_NAME = os.getenv('CLIPS_TRANSCRIPTION_AGENT_NAME', 'transovo-clips-transcription').strip()
CAPTION_TOPIC = 'rooms-captions'


async def run_rooms_transcription(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    try:
        meta = json.loads(ctx.job.metadata or '{}')
    except json.JSONDecodeError:
        meta = {}
    session_id = meta.get('sessionId', '')
    ctx.log_context_fields = {
        'service': 'transovo-clips-transcription',
        'sessionId': session_id,
        'room': ctx.room.name,
    }

    api_key = os.getenv('DEEPGRAM_API_KEY', '').strip()
    if not api_key:
        logger.warning('DEEPGRAM_API_KEY missing — captions agent idle')
        return

    try:
        from livekit.plugins import deepgram
    except ImportError:
        logger.error('livekit-plugins-deepgram not installed')
        return

    stt_impl = deepgram.STT(model='nova-2', api_key=api_key)

    async def _publish_caption(text: str) -> None:
        if not text.strip():
            return
        payload = json.dumps({'text': text.strip()}).encode('utf-8')
        await ctx.room.local_participant.publish_data(payload, reliable=True, topic=CAPTION_TOPIC)

    @ctx.room.on('track_subscribed')
    def _on_track(track: rtc.Track, _pub, participant: rtc.RemoteParticipant) -> None:
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        async def _loop() -> None:
            stream = rtc.AudioStream(track)
            stt_stream = stt_impl.stream()
            async for frame in stream:
                stt_stream.push_frame(frame)
            async for ev in stt_stream:
                if ev.type == deepgram.SpeechEventType.FINAL_TRANSCRIPT and ev.alternatives:
                    await _publish_caption(ev.alternatives[0].text)

        import asyncio

        asyncio.create_task(_loop())

    logger.info('clips transcription agent ready room=%s session=%s', ctx.room.name, session_id)


def register_transcription_agent(server) -> None:
    if os.getenv('CLIPS_RECORDING_WORKER_ENABLED', '').strip() != '1':
        return

    @server.rtc_session(agent_name=AGENT_NAME)
    async def _entrypoint(ctx: JobContext) -> None:
        await run_rooms_transcription(ctx)
