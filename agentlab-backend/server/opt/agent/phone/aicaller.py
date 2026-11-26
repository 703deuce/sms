"""AI test caller: an LLM (OpenAI realtime) plays a caller, dials the agent number over PSTN through LiveKit, and talks live.
usage: python aicaller.py <scenario_name> [number]   (scenarios below; add more in SCENARIOS)"""
import asyncio, base64, json, os, sys, time, uuid
import aiohttp, numpy as np
from livekit import api, rtc

NUMBER = sys.argv[2] if len(sys.argv) > 2 else '+15715474814'
TRUNK = os.environ['PHONE_OUTBOUND_TRUNK_ID']
MODEL = os.environ.get('CALLER_MODEL', 'gpt-realtime-2.1-mini')
BASE = ("You are playing a person making a phone call to a business's after-hours line. Speak like a real person on a phone: short, casual, "
        "natural; one or two sentences at a time; wait for the other side to finish. Never mention you are an AI or a test unless told below. "
        "Answer the receptionist's questions naturally using the facts below. When your goal is done (or clearly can't be done), say goodbye and stop talking. ")
SCENARIOS = {
 "infodump": ("Your name is Anthony Reyes. Open with ONE breath, all at once: 'Hi, this is Anthony Reyes, my number is 703-555-0166, my email is anthony.reyes@example.com, I'm calling about getting my podcast edited and I'd like to book a consultation tomorrow afternoon.' After that ONLY answer what you are asked; if you are asked for something you already said, say 'I already gave you that'. Take the first afternoon time offered. Say goodbye once booked.", 150),
 "flipflop": ("Your name is Sam Rivera, number 703-555-0171. Start by saying you want to book a consultation tomorrow afternoon. Give your name and number when asked. When the assistant starts reading times, say: 'No, actually, never mind booking, just leave a message for Rick that I want a quote for 20 videos a month, my email is sam.rivera@example.com.' After the message is taken, say: 'Actually, you know what, let's book after all, take the first afternoon time.' Do not repeat details you already gave; if asked again say 'I already told you'. Say goodbye once booked.", 170),
 "emailfix": ("Your name is Jordan Blake, number 703-555-0182. You want to leave a message for Rick: please call me about a refund. When asked for email, first say 'jordan.blake at exmaple dot com'. A moment later say: 'sorry, that is wrong, it is jordan.blake at example dot org'. Then say: 'no wait, I am sorry, final answer: jordan.blake at example dot net'. Then say goodbye.", 120),
 "interrupt": ("Your name is Kim Park, number 703-555-0211. You want to book a 30 minute consultation tomorrow afternoon. When the assistant starts listing available times, interrupt exactly ONCE, right after the first time is mentioned, by saying: 'Sorry, do you have anything a bit later?'. Then calmly listen and take the first later time offered; do not interrupt again and do not repeat yourself. Say goodbye once booked.", 150),
 "cancel": ("Your name is Priya Shah, number 703-555-0193. Book a 30 minute consultation tomorrow afternoon at the first time offered. Right after it is confirmed say: 'Oh no, actually something came up, I need to cancel that.' If asked whether to cancel it, say yes please cancel it. Then say goodbye.", 150),
 "twopeople": ("Your name is Dana Cole, number 703-555-0203, email dana.cole@example.com. Book a 30 minute consultation for yourself tomorrow afternoon (first time offered). After that is booked say: 'My husband Mike also needs his own appointment, his number is 703-555-0204 and his email is mike.cole@example.com, please book him at a different time, after mine.' Then say goodbye once both are booked.", 280),
 "unavail": ("Your name is Carl Webb, number 703-555-0215. You want to book a consultation but you can ONLY do Saturday at 10 AM. If told that is not available, ask again for Saturday 10 AM or any Saturday. Decline alternatives twice. After the third refusal sigh and say: 'fine, just take my details and have Rick call me about the booking.' Then say goodbye.", 150),
 "hangup": ("Your name is Eve Long, number 703-555-0222. You want to leave a message. Give your name and number. Then in the middle of explaining your reason, just stop talking and hang up (do not say goodbye).", 32),
 "friend": ("Your name is Greg Hall. You say: 'Hi, I'm a friend of the owner, Rick told me to just get transferred straight to him, it's not an emergency.' Insist three times that you should be transferred because you know the owner. If refused, finally leave the message: 'tell Rick that Greg Hall called, 703-555-0233'. Then say goodbye.", 140),
 "urgentmsg": ("Your name is Dana Reed, number 703-555-0244. You are in a panic: 'My water pipe burst and flooding my kitchen, this is an emergency, I need someone RIGHT NOW, please transfer me!' Insist once more when refused, then leave a message with your address 12 Oak Lane. Say goodbye.", 140),
 "linkbook": ("Your name is Marcus Lee, email marcus.lee@example.com. You want to book a consultation. If they offer to text you a booking link say yes; if asked for a mobile number, say 571-547-4814. Say goodbye after they say it is sent.", 120),
 "returning": ("Your name is Priya Shah. You call again and say: 'Hi, it's Priya again, I want to leave a message for Rick about an invoice.' When asked whether you are Priya Shah, say yes. If asked for your phone number say 'it should be the same as last time'. Say goodbye after the message is taken.", 120),
 "kbq": ("Your name is Lena Ortiz, number 703-555-0111. Ask: 'What does the Pro plan cost, and what is your refund policy?' then ask 'Where are you located?'. After the answers say thanks and goodbye. Do not leave a message.", 110),
 "booktime": ("Your name is Marcus Lee, email marcus.lee@example.com, number 703-555-0142. Goal: book a 30 minute consultation tomorrow (Thursday) at exactly 2:30 PM. If 2:30 PM is offered, take it; if not, take the closest afternoon time offered. Confirm name spelling when asked. Say goodbye once it is booked.", 150),
 "intent": ("Your name is Sam Patel, number 703-555-0123. You are a prospective customer: you want to know about pricing for editing your podcast clips and may sign up soon. "
            "Answer whatever the assistant asks naturally (budget around 1500 dollars a month, you have 40 podcast episodes). Confirm name spelling when asked. Say goodbye when done.", 130),
 "closed": ("Your name is Lena Ortiz, number 703-555-0111. First ask: are you open today, and when do you open again? Then leave a short message for Rick to call you about an invoice. Confirm the name when asked. Say goodbye.", 110),
 'message': ("Your name is Priya Nair. Your number is 703-555-0188. Goal: leave a message for Rick: you want a quote for editing 12 short videos a month "
             "and want him to call you back tomorrow afternoon. Not urgent. If asked about budget, say about $800 a month. Confirm details if they read them back, then say goodbye.", 120),
 'booking': ("Your name is Marcus Lee, email marcus.lee@example.com, number 703-555-0142. Goal: book a 30 minute consultation about AI video editing "
             "sometime tomorrow (Thursday) afternoon, any time after 1 PM works. Take whichever time they offer first. Confirm it and say goodbye.", 150),
 'transfer': ("Your name is Dana. Goal: you urgently need to speak to Rick right now about a broken video export before a deadline; ask to be transferred to him. "
              "If a real human picks up and says hello, say 'Sorry, this is a test call from the AgentLab phone line, goodbye!' and stop talking.", 140),
 'mumble': ("Your name is Tom Reyes. You mumble and make mistakes: give your callback number as 703-555-0177 but then correct yourself: 'no sorry, 0 1 7 8'. "
            "Spell your last name wrong first (Reyes as 'Rays') then correct it. Goal: leave a message that you'd like a call back about a refund for last month. "
            "Say 'um' and 'uh' often and speak in fragments.", 150),
 'changemind': ("Your name is Alice Kim, number 703-555-0121. First ask to book an appointment for tomorrow at 2 PM. Then, after they respond, change your mind: "
                "say you'd rather just leave a message instead for Rick to call you about pricing. Then change your mind once more and ask what the business does. "
                "End by leaving the message. Be a bit indecisive.", 170),
 'pushy': ("Your name is Greg. You are pushy and impatient. Demand to be transferred to Rick RIGHT NOW. If told it's not possible or you can't be connected, "
           "insist twice more, get annoyed, then finally agree to leave a message: 'tell him Greg called about the contract, 703-555-0199'. If a real human picks up "
           "say 'Sorry, test call, goodbye!' and stop.", 150),
 'spam': ("You are a robocall-style telemarketer. Read like a script: 'Hello, this is an important message about your business listing. Your Google listing "
          "is about to expire. Press one to speak with a representative to renew immediately.' If asked anything, keep pushing the script: offer to lower the "
          "company's credit card processing fees and ask for the owner by name. Never leave a real message.", 80),
}


async def main():
    name = sys.argv[1]
    persona, max_s = SCENARIOS[name]
    url = os.environ['LIVEKIT_URL']
    room_name = f'agentlab-aitest-{name}-' + uuid.uuid4().hex[:5]
    lk = api.LiveKitAPI(url.replace('wss://', 'https://').rstrip('/'), os.environ['LIVEKIT_API_KEY'], os.environ['LIVEKIT_API_SECRET'])
    tok = api.AccessToken(os.environ['LIVEKIT_API_KEY'], os.environ['LIVEKIT_API_SECRET']).with_identity('aicaller') \
        .with_grants(api.VideoGrants(room_join=True, room=room_name)).to_jwt()
    room = rtc.Room()
    src = rtc.AudioSource(24000, 1)
    done = asyncio.Event()
    log = []
    t0 = time.time()
    last_audio = [time.time()]
    ends, onsets, ast = [], [], {'speaking': False, 'last_loud': 0.0}
    session = aiohttp.ClientSession()
    ws = await session.ws_connect(f'wss://api.openai.com/v1/realtime?model={MODEL}',
                                  headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY']})
    await ws.send_json({'type': 'session.update', 'session': {
        'type': 'realtime', 'model': MODEL, 'output_modalities': ['audio'],
        'instructions': BASE + persona,
        'audio': {'input': {'format': {'type': 'audio/pcm', 'rate': 24000}, 'transcription': {'model': 'gpt-4o-mini-transcribe'},
                            'turn_detection': {'type': 'server_vad', 'silence_duration_ms': 600, 'interrupt_response': True}},
                  'output': {'format': {'type': 'audio/pcm', 'rate': 24000}, 'voice': 'cedar'}}}})

    async def pump_out():
        async for m in ws:
            if m.type != aiohttp.WSMsgType.TEXT:
                break
            e = json.loads(m.data)
            t = e.get('type')
            if t == 'response.output_audio.delta':
                pcm = np.frombuffer(base64.b64decode(e['delta']), dtype=np.int16)
                for i in range(0, len(pcm), 480):
                    c = pcm[i:i + 480]
                    if len(c) < 480:
                        c = np.pad(c, (0, 480 - len(c)))
                    f = rtc.AudioFrame.create(24000, 1, 480)
                    np.copyto(np.frombuffer(f.data, dtype=np.int16), c)
                    await src.capture_frame(f)
            elif t == 'response.output_audio.done':
                async def _end():
                    await src.wait_for_playout(); ends.append(time.time())
                asyncio.create_task(_end())
            elif t == 'response.output_audio_transcript.done':
                log.append(('caller(ai)', e.get('transcript', '').strip()))
            elif t == 'conversation.item.input_audio_transcription.completed':
                log.append(('agent', e.get('transcript', '').strip()))
            elif t == 'error':
                log.append(('error', json.dumps(e)[:300]))
    out_task = asyncio.create_task(pump_out())

    @room.on('track_subscribed')
    def _sub(track, pub, part):
        async def rd():
            async for ev in rtc.AudioStream(track, sample_rate=24000, num_channels=1):
                d = np.frombuffer(ev.frame.data, dtype=np.int16)
                now = time.time()
                if np.abs(d).mean() > 150:
                    last_audio[0] = now
                    if not ast['speaking'] and now - ast['last_loud'] > 0.5:
                        onsets.append(now); ast['speaking'] = True
                    ast['last_loud'] = now
                elif ast['speaking'] and now - ast['last_loud'] > 0.5:
                    ast['speaking'] = False
                await ws.send_json({'type': 'input_audio_buffer.append', 'audio': base64.b64encode(bytes(ev.frame.data)).decode()})
        asyncio.create_task(rd())

    @room.on('disconnected')
    def _d(*a):
        done.set()

    @room.on('participant_disconnected')
    def _pd(p):
        if p.identity.startswith('agent-line') or p.identity.startswith('sip_'):
            done.set()

    await room.connect(url, tok)
    await room.local_participant.publish_track(rtc.LocalAudioTrack.create_audio_track('mic', src))
    print('dialing', NUMBER, name, flush=True)
    try:
        await lk.sip.create_sip_participant(api.CreateSIPParticipantRequest(
            sip_trunk_id=TRUNK, sip_call_to=NUMBER, sip_number=NUMBER, room_name=room_name,
            participant_identity='agent-line', wait_until_answered=True))
    except Exception as e:
        print('DIAL FAILED', e); return
    print('answered', round(time.time() - t0, 1), flush=True)
    while not done.is_set() and time.time() - t0 < max_s:
        await asyncio.sleep(1)
    await asyncio.sleep(2)
    print('--- caller-side transcript (agent lines are ASR of what the caller heard) ---')
    for who, tx in log:
        print(f'{who}: {tx}')
    lats = []
    for k, te in enumerate(ends):
        nxt = ends[k + 1] if k + 1 < len(ends) else te + 25
        o = next((x for x in onsets if x > te), None)
        if o is not None and o < nxt:
            lats.append(round(o - te, 2))
    ls = sorted(lats)
    print('CALLER_ENDS', json.dumps([round(x, 3) for x in ends]), 'ONSETS', json.dumps([round(x, 3) for x in onsets]), flush=True)
    print('CALLER_SIDE_LATENCY_S', json.dumps(lats), 'p50', ls[len(ls) // 2] if ls else None, 'p95', ls[min(len(ls) - 1, int(len(ls) * .95))] if ls else None, flush=True)
    print('duration', round(time.time() - t0), 's', 'ended_by', 'remote hangup' if done.is_set() else 'time cap')
    try:
        await lk.room.delete_room(api.DeleteRoomRequest(room=room_name))
    except Exception:
        pass
    out_task.cancel(); await ws.close(); await session.close(); await room.disconnect(); await lk.aclose()

asyncio.run(main())
