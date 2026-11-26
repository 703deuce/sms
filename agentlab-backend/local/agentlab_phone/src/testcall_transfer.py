"""Automated test call: dial the agent number over PSTN from LiveKit (outbound trunk), speak scripted caller lines."""
import asyncio, os, sys, time, uuid, wave
import httpx, numpy as np
from livekit import api, rtc

NUMBER = sys.argv[1] if len(sys.argv) > 1 else '+15715474814'
TRUNK = os.environ.get('PHONE_OUTBOUND_TRUNK_ID')
LINES = [
    (10, "Hi, this is urgent. I need to speak to Rick right now. Can you please transfer me to him?"),
]


async def tts(text):
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post('https://api.openai.com/v1/audio/speech', headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY']},
                         json={'model': 'gpt-4o-mini-tts', 'voice': 'alloy', 'input': text, 'response_format': 'pcm'})
        r.raise_for_status()
        return np.frombuffer(r.content, dtype=np.int16)


async def main():
    url = os.environ['LIVEKIT_URL']
    room_name = 'agentlab-test-' + uuid.uuid4().hex[:6]
    lk = api.LiveKitAPI(url.replace('wss://', 'https://').rstrip('/'), os.environ['LIVEKIT_API_KEY'], os.environ['LIVEKIT_API_SECRET'])
    audio = [await tts(t) for _, t in LINES]
    tok = api.AccessToken(os.environ['LIVEKIT_API_KEY'], os.environ['LIVEKIT_API_SECRET']).with_identity('tester') \
        .with_grants(api.VideoGrants(room_join=True, room=room_name)).to_jwt()
    room = rtc.Room()
    heard = []
    @room.on('track_subscribed')
    def _sub(track, pub, part):
        async def rd():
            async for ev in rtc.AudioStream(track, sample_rate=16000, num_channels=1):
                heard.append(bytes(ev.frame.data))
        asyncio.create_task(rd())
    await room.connect(url, tok)
    src = rtc.AudioSource(24000, 1)
    await room.local_participant.publish_track(rtc.LocalAudioTrack.create_audio_track('mic', src))
    t0 = time.time()
    print('dialing', NUMBER, 'room', room_name, flush=True)
    await lk.sip.create_sip_participant(api.CreateSIPParticipantRequest(
        sip_trunk_id=TRUNK, sip_call_to=NUMBER, sip_number=NUMBER, room_name=room_name,
        participant_identity='agent-line', wait_until_answered=True))
    print('answered after %.1fs' % (time.time() - t0), flush=True)
    for (wait, text), pcm in zip(LINES, audio):
        await asyncio.sleep(wait)
        print('say:', text, flush=True)
        for i in range(0, len(pcm), 480):
            chunk = pcm[i:i + 480]
            if len(chunk) < 480:
                chunk = np.pad(chunk, (0, 480 - len(chunk)))
            f = rtc.AudioFrame.create(24000, 1, 480)
            np.copyto(np.frombuffer(f.data, dtype=np.int16), chunk)
            await src.capture_frame(f)
    await asyncio.sleep(int(os.environ.get('TAIL_S','8')))
    with wave.open('/workspace/runs/phone/testcall-heard.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b''.join(heard))
    print('heard seconds', round(sum(len(h) for h in heard) / 32000, 1), flush=True)
    try:
        await lk.room.delete_room(api.DeleteRoomRequest(room=room_name))
    except Exception:
        pass
    await room.disconnect(); await lk.aclose()

asyncio.run(main())
