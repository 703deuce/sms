"""AgentLab phone line: LiveKit Agents worker. GPT Live front end (voice), Luna backend (reasoning/tools),
AgentLab behind it (post-call runs). One clean setup; see /workspace/agentlab_phone/ARCHITECTURE.md."""
from __future__ import annotations

import asyncio, functools, json, logging, os, re, sys, time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx
from google.protobuf.duration_pb2 import Duration
from livekit import api, rtc
from livekit.agents import (Agent, AgentServer, AgentSession, AudioConfig, BackgroundAudioPlayer, JobContext, RunContext, cli,
                            function_tool, get_job_context, llm, room_io)
from livekit.agents.beta.tools import EndCallTool
from livekit.agents.llm import ToolFlag
from livekit.plugins.openai.realtime import GPTLiveModel

from worker import store

sys.path.insert(0, '/opt/tools')
log = logging.getLogger('agentlab-phone')
AGENT_NAME = os.environ.get('PHONE_AGENT_NAME', 'agentlab-phone')
OUT_TRUNK = os.environ.get('PHONE_OUTBOUND_TRUNK_ID', '')
HEARTBEAT = os.path.join(store.PHONE_DIR, 'worker-heartbeat.json')
STD = ('name', 'callback_number', 'email', 'reason')

server = AgentServer(port=int(os.environ.get('PHONE_WORKER_HTTP_PORT', '8091')))


# ---------------------------------------------------------------- intake model
def intake_plan(cfg):
    """Fields the agent may ask, from the owner's config."""
    it = cfg['intake']
    fields = []   # {key, ask, required, intents, desc}
    desc = {'name': "caller's name", 'callback_number': 'best callback number, E.164 if possible', 'email': 'caller email address',
            'reason': 'the message / what the call is about, in the caller\'s words, complete'}
    for k in STD:
        s = it['standard'].get(k) or {}
        if s.get('on'):
            fields.append({'key': 'message' if k == 'reason' else ('caller_name' if k == 'name' else k), 'std': k, 'ask': s.get('ask'),
                           'required': bool(s.get('required')), 'intents': [], 'desc': desc[k]})
    for c in it.get('custom') or []:
        fields.append({'key': c['key'], 'std': None, 'ask': c['ask'], 'required': bool(c.get('required')),
                       'intents': list(c.get('intents') or []), 'desc': c.get('label') or c['key']})
    for i in it.get('intents') or []:   # intent-listed fields apply to that intent
        for k in i.get('fields') or []:
            for f in fields:
                if f['std'] == k or f['key'] == k:
                    if i['name'] not in f['intents'] and f['intents']:
                        f['intents'].append(i['name'])
    return fields


DETAIL_BASE = ('caller_name', 'callback_number', 'email', 'message', 'preferred_time', 'urgency', 'intent', 'wants_appointment', 'phone_confirmed')


def call_state(cfg, d, caller, appt):
    """Computed by code (never by the model): what we already have and what is still needed. One structure for the whole call,
    kept across switches between message and booking."""
    intent = d.get('intent')
    have, need, opt = [], [], []
    for f in intake_plan(cfg):
        if f['intents'] and intent not in f['intents']:
            continue
        k = f['key']; v = d.get(k)
        if v:
            have.append(f"{k} = {v}")
        elif f['required']:
            need.append(f"{k} (ask: {f['ask']})")
        else:
            opt.append(f"{k} (ask: {f['ask']})")
    for k, label in (('preferred_time', 'preferred time'), ('intent', 'reason category'), ('urgency', 'urgency')):
        if d.get(k):
            have.append(f"{label} = {d[k]}")
    if d.get('wants_appointment'):
        have.append('caller wants an appointment')
        if appt != 'off':
            for k, label in (('caller_name', 'name'), ('callback_number', 'callback number')):
                if not d.get(k) and not any(x.startswith(k) for x in need):
                    need.append(f"{k} (ask: {label})")
            if appt == 'request' and not d.get('preferred_time'):
                need.append('preferred_time (ask: what day and time works for them)')
    if d.get('callback_number') and not d.get('phone_confirmed'):
        need.append(f"read the callback number {d['callback_number']} back ONCE to confirm it (confirmation is noticed automatically)")
    elif not d.get('callback_number') and caller:
        opt.append(f"callback_number: caller ID shows {caller}; instead of asking for a number, you may ask once 'is the number you're calling from the best one?'")
    return have, need, opt


def state_text(cfg, d, caller, appt):
    have, need, opt = call_state(cfg, d, caller, appt)
    return ("CALL STATE (kept by code, authoritative). ALREADY HAVE: " + ('; '.join(have) or 'nothing yet') +
            ". STILL NEED: " + ('; '.join(need) or 'nothing') +
            (". OPTIONAL (ask once, only if natural): " + '; '.join(opt) if opt else '') +
            ". Never ask for anything under ALREADY HAVE, not even to double-check. If the caller switches between leaving a message and booking, keep going with these same details.")


def detail_props(cfg):
    fields = intake_plan(cfg)
    intents = [i['name'] for i in cfg['intake'].get('intents') or []]
    props = {'urgency': {'type': 'string', 'enum': ['low', 'normal', 'urgent'], 'description': 'how urgent the caller says it is'},
             'preferred_time': {'type': 'string', 'description': "their preferred day/time for an appointment, exactly as said (e.g. 'tomorrow afternoon')"},
             'wants_appointment': {'type': 'boolean', 'description': 'true once the caller says they want an appointment or meeting'},
             'phone_confirmed': {'type': 'boolean', 'description': 'true once the caller confirmed the callback number that was read back to them'}}
    for f in fields:
        props[f['key']] = {'type': 'string', 'description': f['desc']}
    if intents:
        props['intent'] = {'type': 'string', 'enum': intents + ['other'], 'description': "which known reason for calling this is"}
    return props


def merge_details(state, args, known):
    d = state.setdefault('details', {}); changed = False
    for k, v in (args or {}).items():
        if k not in known:
            continue
        if isinstance(v, str):
            v = v.strip()
        if v in (None, '', False) and k != 'phone_confirmed':
            continue
        if k == 'callback_number' and v != d.get('callback_number'):
            d.pop('phone_confirmed', None)
        if d.get(k) != v:
            d[k] = v; changed = True
    if changed:
        d['updated_at'] = store.iso()
    return changed


def make_dtmf_handler(decision, att, mode='press1'):
    """Press-1 confirmation on the transfer leg: 1 = accept, 2 = decline. Spoken yes/no is handled separately (STT + LLM)."""
    def on_dtmf(ev):
        if mode == 'verbal' or decision.done():
            return
        d = getattr(ev, 'digit', None)
        if d == '1':
            att['confirmed_via'] = 'dtmf-1'; decision.set_result(True)
        elif d == '2':
            att['confirmed_via'] = 'dtmf-2'; decision.set_result(False); att['result'] = 'declined (pressed 2)'
    return on_dtmf


def _pcm16_wav(pcm: bytes, rate=16000) -> bytes:
    import io, wave
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    return buf.getvalue()


async def _transcribe_owner(wav: bytes) -> str:
    key = os.environ.get('OPENAI_API_KEY')
    if not key or len(wav) < 44:
        return ''
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post('https://api.openai.com/v1/audio/transcriptions',
                         headers={'Authorization': 'Bearer ' + key},
                         files={'file': ('utterance.wav', wav, 'audio/wav')},
                         data={'model': os.environ.get('PHONE_TRANSFER_STT_MODEL', 'gpt-4o-mini-transcribe')})
        r.raise_for_status()
        return (r.json().get('text') or '').strip()


async def _classify_yesno(text: str) -> str:
    """Tiny LLM yes/no/unsure on the transcript. Does not keyword-match the owner's words."""
    key = os.environ.get('OPENAI_API_KEY')
    if not key or not text.strip():
        return 'unsure'
    body = {'model': os.environ.get('PHONE_TRANSFER_YESNO_MODEL', 'gpt-4o-mini'), 'temperature': 0, 'max_tokens': 8,
            'messages': [
                {'role': 'system', 'content': (
                    "Classify a team member's spoken reply on a consult call. A caller is already on hold. "
                    "Decide if the team member is accepting the call, declining it, or neither. "
                    "A voicemail or answering-machine greeting is a decline. A bare greeting with no decision is neither. "
                    "Reply with exactly one word: YES, NO, or UNSURE.")},
                {'role': 'user', 'content': text}]}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post('https://api.openai.com/v1/chat/completions',
                         headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}, json=body)
        r.raise_for_status()
        out = (((r.json().get('choices') or [{}])[0].get('message') or {}).get('content') or '').strip().upper()
    if out.startswith('YES'):
        return 'yes'
    if out.startswith('NO'):
        return 'no'
    return 'unsure'


async def _decide_from_speech(wav: bytes, decision, att, state=None):
    if decision.done():
        return
    try:
        text = await _transcribe_owner(wav)
    except Exception as e:
        log.warning('transfer STT failed: %s', e); return
    if not text or decision.done():
        return
    try:
        verdict = await _classify_yesno(text)
    except Exception as e:
        log.warning('transfer yes/no classify failed: %s', e); return
    if state is not None:
        tl(state, 'transfer_spoken', text=text[:200], verdict=verdict)
    if decision.done():
        return
    if verdict == 'yes':
        att['confirmed_via'] = 'spoken-yes'; att['spoken_text'] = text[:200]; decision.set_result(True)
    elif verdict == 'no':
        att['confirmed_via'] = 'spoken-no'; att['spoken_text'] = text[:200]
        att['result'] = 'declined (spoken)'; decision.set_result(False)


def start_spoken_decision_listener(room2, decision, att, state=None):
    """Independent spoken-accept path: transcribe the transfer target, classify with a small LLM."""
    def hook(track, pub, participant):
        ident = getattr(participant, 'identity', '') or ''
        kind = getattr(track, 'kind', None)
        if ident != 'human':
            return
        if kind not in (rtc.TrackKind.KIND_AUDIO, getattr(rtc.TrackKind, 'KIND_AUDIO', None)):
            return
        asyncio.create_task(_owner_speech_loop(track, decision, att, state))
    room2.on('track_subscribed', hook)
    try:
        for p in room2.remote_participants.values():
            for pub in p.track_publications.values():
                if pub.track:
                    hook(pub.track, pub, p)
    except Exception:
        pass


async def _owner_speech_loop(track, decision, att, state=None):
    import struct
    buf = bytearray(); voiced = False; last_voice = time.time()
    try:
        async for ev in rtc.AudioStream(track, sample_rate=16000, num_channels=1):
            if decision.done():
                break
            data = bytes(ev.frame.data)
            n = len(data) // 2
            if n == 0:
                continue
            samples = struct.unpack('<' + 'h' * n, data[:n * 2])
            mean = sum(abs(x) for x in samples) / n
            now = time.time()
            if mean > 250:
                buf.extend(data); voiced = True; last_voice = now
            elif voiced and buf and now - last_voice >= 0.7:
                chunk = bytes(buf); buf.clear(); voiced = False
                if len(chunk) >= 16000:  # >= ~0.5 s
                    await _decide_from_speech(_pcm16_wav(chunk), decision, att, state)
            elif buf and now - last_voice >= 2.5 and len(buf) >= 16000 * 2:
                chunk = bytes(buf); buf.clear(); voiced = False
                await _decide_from_speech(_pcm16_wav(chunk), decision, att, state)
    except Exception as e:
        log.warning('spoken decision listener failed: %s', e)


def tl(state, ev, **kw):
    state.setdefault('timeline', []).append({'t': round(time.time(), 3), 'ev': ev, **{k: v for k, v in kw.items() if v is not None}})


EXTRACT_SYS = ("You keep the structured record of a LIVE phone call up to date. You get the details recorded so far and the latest lines of the conversation (caller = the person phoning, assistant = the receptionist). "
               "Reply with ONE JSON object containing ONLY the fields you can now fill or that changed (omit unknown ones, never invent). The latest value wins when the caller corrects themselves. "
               "Numbers and emails spoken in words must be written as digits and a normal address (e.g. 'seven oh three five five five' -> 703555..., 'sam dot rivera at example dot com' -> sam.rivera@example.com). "
               "If the caller arranges something for a DIFFERENT person (spouse, colleague, friend), put that person's details only in other_person {name, number, email, preferred_time}; never overwrite the caller's own fields with them. "
               "phone_confirmed is true only if the receptionist read the callback number back and the caller confirmed it. Fields:\n")


async def extract_details(agent):
    st, cfg = agent.state, agent.cfg
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        return
    props = detail_props(cfg)
    tr = st['transcript'][-12:]
    if not any(r['role'] == 'caller' for r in tr):
        return
    sysmsg = EXTRACT_SYS + "\n".join(f"- {k}: {v['description']}" + (f" (one of {v['enum']})" if v.get('enum') else '') for k, v in props.items()) + "\n- other_person: object, see above"
    body = {'model': os.environ.get('PHONE_EXTRACT_MODEL', 'claude-haiku-5-5'), 'max_tokens': 700, 'thinking': {'type': 'disabled'}, 'system': [{'type': 'text', 'text': sysmsg, 'cache_control': {'type': 'ephemeral', 'ttl': '5m'}}],
            'messages': [{'role': 'user', 'content': f"Recorded so far: {json.dumps({k: v for k, v in (st.get('details') or {}).items() if k != 'updated_at'})}\nOther person so far: {json.dumps(st.get('others') or {})}\n\nConversation (latest last):\n"
                          + "\n".join(f"{r['role']}: {r['text'].strip()}" for r in tr)}]}
    tl(st, 'extract_start')
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post('https://api.anthropic.com/v1/messages', json=body, headers={'x-api-key': key, 'anthropic-version': '2023-06-01'})
        j = r.json()
        u = j.get('usage') or {}
        eu = st.setdefault('usage_extract', {'in': 0, 'out': 0, 'calls': 0, 'cache_write': 0, 'cache_read': 0}); eu['in'] += u.get('input_tokens', 0); eu['out'] += u.get('output_tokens', 0); eu['calls'] += 1; eu['cache_write'] += u.get('cache_creation_input_tokens', 0); eu['cache_read'] += u.get('cache_read_input_tokens', 0)
        out = ''.join(b.get('text', '') for b in j.get('content', []))
        a, b_ = out.find('{'), out.rfind('}')
        data = json.loads(out[a:b_ + 1])
    except Exception as e:
        tl(st, 'extract_end', ok=False, err=str(e)[:80]); log.warning('extract failed: %s', e); return
    other = data.pop('other_person', None)
    changed = merge_details(st, data, set(props))
    if isinstance(other, dict) and any(other.get(k) for k in ('name', 'number', 'email')):
        oth = st.setdefault('others', {}); nm = (other.get('name') or 'other').strip()
        cur = oth.setdefault(nm, {})
        for k, v in other.items():
            if v and cur.get(k) != v:
                cur[k] = v; changed = True
    tl(st, 'extract_end', ok=True, changed=changed)
    if changed:
        txt = state_text(cfg, st.get('details') or {}, agent.caller, agent.appt)
        if st.get('others'):
            txt += " Other people the caller is arranging things for (keep their details separate from the caller's): " + "; ".join(
                f"{nm}" + "".join(f", {k} {v}" for k, v in o.items() if k in ('number', 'email', 'preferred_time') and v) for nm, o in st['others'].items()) + "."
        # thinking appends cancel pending automatic acknowledgements (OpenAI Live reference): don't inject right after a handoff
        dt = time.time() - st.get('_deleg_t', 0)
        if dt < 1.5 and not st.get('_deleg_audio'):
            await asyncio.sleep(1.5 - dt)
        rt = getattr(agent, 'duplex_session', None)
        try:
            if rt is not None:
                rt.append_thinking(txt)
                tl(st, 'state_injected')
        except Exception as e:
            log.warning('append_thinking failed: %s', e)


def record_details_tool(agent, cfg):   # kept for reference/fallback; no longer registered (details are extracted by code)
    fields = intake_plan(cfg)
    intents = [i['name'] for i in cfg['intake'].get('intents') or []]
    props = {'urgency': {'type': 'string', 'enum': ['low', 'normal', 'urgent'], 'description': 'how urgent the caller says it is'},
             'preferred_time': {'type': 'string', 'description': "their preferred day/time for an appointment, exactly as said (e.g. 'tomorrow afternoon')"},
             'wants_appointment': {'type': 'boolean', 'description': 'true once the caller says they want an appointment or meeting'},
             'phone_confirmed': {'type': 'boolean', 'description': 'true once the caller confirmed the callback number you read back'}}
    for f in fields:
        props[f['key']] = {'type': 'string', 'description': f"{f['desc']}. Ask: {f['ask']}"}
    if intents:
        props['intent'] = {'type': 'string', 'enum': intents + ['other'], 'description': "which known reason for calling this is"}
    known = set(props)

    async def handler(raw_arguments: dict, context: RunContext) -> str:
        t0 = time.time()
        d = agent.state.setdefault('details', {})
        for k, v in raw_arguments.items():
            if k not in known:
                continue
            if isinstance(v, str):
                v = v.strip()
            if v in (None, '', False) and k != 'phone_confirmed':
                continue
            if k == 'callback_number' and v != d.get('callback_number'):
                d.pop('phone_confirmed', None)      # a new number must be confirmed again
            d[k] = v
        d['updated_at'] = store.iso()
        txt = state_text(cfg, d, agent.caller, agent.appt)
        try:
            await agent.update_instructions(agent.compose())
        except Exception as e:
            log.warning('instruction refresh failed: %s', e)
        agent.state.setdefault('lat_tools', []).append({'tool': 'record_details', 's': round(time.time() - t0, 2)})
        return "Recorded. " + txt + " Do not repeat the recorded details back unless the state says to confirm the number."

    desc = ("Record details the caller volunteers. Call it EVERY time they give any detail, with ALL the fields they just gave (several at once is normal), "
            "including corrections. Fields: " + "; ".join(f"{f['key']}" + (" (required)" if f['required'] else " (optional)") + (f" only for intent {f['intents']}" if f['intents'] else "") for f in fields))
    schema = {'name': 'record_details', 'description': desc, 'parameters': {'type': 'object', 'properties': props, 'required': []}}
    return llm.function_tool(handler, raw_schema=schema)


SLOW_TOOLS = {'check_availability', 'book_appointment', 'cancel_appointment', 'send_booking_link'}


ACK_DELAY_MS = int(os.environ.get('PHONE_ACK_DELAY_MS', '0'))


def _patch_gpt_live_start():
    """LiveKit's GPT-Live plugin has no field for delegation.acknowledgement_delay_ms; add it to session.start (OpenAI Live reference:
    'Milliseconds to wait before requesting an automatic spoken acknowledgement for a delegation ... 0 (request immediately)')."""
    try:
        from livekit.agents.llm._realtime import gpt_live as _gl
        orig = _gl.GPTLiveSession._session_start_event
        if getattr(orig, '_ack_patched', False):
            return
        def patched(self):
            raw = orig(self).model_dump(exclude_none=True)
            dg = (raw.get('session') or {}).get('delegation')
            if isinstance(dg, dict):
                dg['acknowledgement_delay_ms'] = ACK_DELAY_MS
            ss = raw.get('session') or {}
            log.info('session.start model=%s delegation=%s input_roles=%s', ss.get('model'), dg, [(i.get('role'), str(i.get('content'))[:80]) for i in (ss.get('input') or []) if isinstance(i, dict)])
            return raw
        patched._ack_patched = True
        _gl.GPTLiveSession._session_start_event = patched
    except Exception as e:
        log.warning('ack-delay patch not applied: %s', e)


_patch_gpt_live_start()


_VAD = None


def _vad_kw():
    """Local Silero VAD (CPU, no service) so LiveKit can cut playback when the caller barges in. PHONE_VAD=off disables it."""
    global _VAD
    if os.environ.get('PHONE_VAD', 'on') == 'off':
        return {}
    try:
        if _VAD is None:
            from livekit.plugins import silero
            _VAD = silero.VAD.load()
        return {'vad': _VAD}
    except Exception as e:
        log.warning('VAD unavailable: %s', e)
        return {}


def timed(fn):
    @functools.wraps(fn)
    async def w(self, *a, **k):
        t0 = time.time()
        tl(self.state, 'tool_start', tool=fn.__name__)
        try:
            return await fn(self, *a, **k)
        finally:
            self.state.setdefault('lat_tools', []).append({'tool': fn.__name__, 's': round(time.time() - t0, 2)})
            tl(self.state, 'tool_end', tool=fn.__name__, s=round(time.time() - t0, 2))
    return w


def pctl(xs, p):
    xs = sorted(xs)
    return round(xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))], 2) if xs else None


# ---------------------------------------------------------------- prompts
def hours_text(cfg):
    out = []
    for d in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'):
        v = cfg['business_hours'].get(d)
        out.append(f"{d.title()} " + (f"{datetime.strptime(v[0], '%H:%M').strftime('%-I:%M %p')}-{datetime.strptime(v[1], '%H:%M').strftime('%-I:%M %p')}" if v else 'closed'))
    return ', '.join(out)


def _recovery_kw(cfg):
    """LiveKit delegation recovery (1.8.12+): a detector judges turns GPT-Live left undelegated and starts the handoff itself.
    PHONE_DELEG_RECOVERY=on enables it; the detector runs on our OpenAI backend model (not LiveKit Inference)."""
    if os.environ.get('PHONE_DELEG_RECOVERY', 'off') != 'on':
        return {}
    from livekit.agents.llm.delegation import DelegationDetector
    from livekit.plugins import openai as _oa
    det = DelegationDetector(model=_oa.LLM(model=(cfg.get('models') or {}).get('backend', 'gpt-6-luna'), reasoning_effort='none'))
    return {'delegation_recovery': {'detector': det}}


def _spawn(cfg, on=True):
    """gpt-live-1 is steered with the <|SpawnThinking|> token; later models with plain 'Delegate to the backend' (OpenAI Live prompting guide)."""
    if (cfg.get('models') or {}).get('voice', 'gpt-live-1') == 'gpt-live-1':
        return 'Generate <|SpawnThinking|>' if on else 'Do not generate <|SpawnThinking|>'
    return 'Delegate to the backend' if on else 'Do not delegate'


def voice_instructions(cfg, after_hours: bool, caller: str | None, cal_ok: bool, details=None, prior=None, ctype='new', kb_on=False) -> str:
    """GPT-Live (front end) prompt, in the shape of OpenAI's Live prompting guide: persona and timing, Backchannel policy, Interruption
    policy, facts it answers itself, Delegation policy in plain language. No tool names or procedures here; those live in the backend prompt."""
    o, t = cfg['options'], cfg['transfer']
    tz = ZoneInfo(cfg['timezone'])
    now = datetime.now(tz).strftime('%A %B %-d %Y, %-I:%M %p')
    appt = o.get('appointments', 'off')
    if appt == 'live' and not cal_ok:
        appt = 'request'   # calendar not connected: never promise a live booking
    pol = (cfg.get('emergency') or {}).get('policy', 'transfer')
    can_transfer = bool(o.get('transfer') and t.get('targets'))  # regular transfers are independent of emergency policy
    cl = store.closure_today(cfg)
    nxt = store.next_open_day(cfg)
    D, ND = _spawn(cfg, True), _spawn(cfg, False)
    owner = cfg['owner_name'] or 'the owner'
    L = [
        f"You are {cfg['assistant_name']}, the phone assistant for {cfg['business_name']}, on a live phone call. "
        "Speak warmly and naturally, at an unhurried pace. Be clear and direct, not overly cheerful. "   # guide template persona
        "If the caller is frustrated, acknowledge it briefly and focus on the next helpful step. Always speak English. "
        "Keep each reply to one or two short sentences. Never read lists or web addresses aloud.",
        "Backchannel policy: Use moderate backchannels. Acknowledge naturally without competing with the main response.",  # verbatim template default, OpenAI live-prompting guide; no custom wording
        ("Interruption policy: When the user interrupts, stop speaking right away, even in the middle of a sentence. Listen until they finish, then respond to what they said. "
         "A brief acknowledgment like \u201csure\u201d is okay when you stop speaking. Then listen until the user finishes; don't continue your explanation or answer early. "
         "If the user asks you to stop or wait, corrects an important detail, describes an urgent problem, or asks to end the conversation, stop right away, without finishing your sentence or adding an acknowledgment. "
         "Respond to the user's latest request. Don't resume an answer they've replaced. "
         "The caller keeps the floor through short thinking pauses. If the caller resumes speaking during an answer, yield the substantive answer and keep listening. "
         "Interrupt only when it materially improves the exchange, such as preventing a major misunderstanding or keeping the task on track. "
         "If an important name, date, or number is unclear, ask about that part."
         if os.environ.get('PHONE_PROMPT_VARIANT', 'doc') == 'doc' else
         "Interruption policy: When the caller interrupts, stop speaking right away, even mid-sentence. Listen until they finish, then respond to what they said. "
         "Respond to the caller's latest request; don't resume an answer they've replaced."),
        f"Facts you answer yourself. Now: {now} ({cfg['timezone']}), {'after business hours' if after_hours else 'during business hours'}. "
        f"Owner: {owner}. Hours: {hours_text(cfg)}. About the business: {cfg['business_info']}",
        "Prices, fees, plan details, policy terms and booked or open times: say only figures that appear word for word in the facts above or in a backend result on this call. "
        "Never estimate or recall a number from memory; if you don't have it yet, hand off and wait for the result.",
    ]
    if cfg.get('faq'):
        L.append("Common questions:\n" + "\n".join(f"- {f['q']} {f['a']}" for f in cfg['faq']))
    if cl:
        L.append(f"Today the business is closed for {cl.get('name') or 'a holiday'}"
                 + (f" (special hours today {cl['hours'][0]}-{cl['hours'][1]})" if cl.get('hours') else '')
                 + (f". Tell callers: {cl['message']}" if cl.get('message') else '')
                 + (f". If asked when you are open again: regular hours resume {nxt}." if nxt else '.'))
    upcoming = [c for c in cfg.get('closures') or [] if (c.get('date') or c.get('start')) > datetime.now(tz).strftime('%Y-%m-%d')][:3]
    if upcoming:
        L.append("Upcoming closures: " + "; ".join(f"{c.get('name') or 'closed'} {c.get('date') or (c['start'] + ' to ' + c['end'])}" for c in upcoming))
    if prior:
        L.append(f"Returning caller (caller ID {caller}): last time they gave the name {prior.get('caller_name')} and callback {prior.get('callback_number')}"
                 + (f", {prior['fields']}" if prior.get('fields') else '')
                 + f". Not verified: once, early, ask 'Am I speaking with {prior.get('caller_name')}?'. If yes, you already have their name and number; if no, treat them as new and don't mention the old details.")
    if o.get('take_message') or appt != 'off':
        fields = intake_plan(cfg)
        qs = [f"- {f['ask']} ({'needed' if f['required'] else 'optional, ask once'})" + (f" [only when the call is about: {', '.join(f['intents'])}]" if f['intents'] else '') for f in fields]
        L.append("Taking details: callers often give several things at once. What they say is recorded automatically, including corrections (the latest value wins); "
                 "you never need to save anything. Notes titled CALL STATE tell you what you already have and what is still needed: never ask again for something you have. "
                 "Ask only for what is still needed, one short question at a time. If the caller switches between leaving a message and booking, keep the details and don't restart. "
                 f"The caller is calling from {caller or 'an unknown number'}. What to ask for:\n" + "\n".join(qs)
                 + "\nNames can be misheard: say a new name back once and ask if you got it right; until they confirm, don't use it. When done, tell them it will be passed on.")
        intents = cfg['intake'].get('intents') or []
        if intents:
            L.append("Usual reasons for calling (work it out from what they say; don't ask them to pick):\n" + "\n".join(
                f"- {i['name']}: {i.get('description') or ''}" + (f" Also ask: {'; '.join(i['questions'])}" if i.get('questions') else '')
                + (" Treat as urgent." if i.get('urgent') else '') for i in intents))
    if appt == 'request':
        L.append(f"Appointments: you don't book. Note the day and time they'd like and say {owner}'s team will confirm.")
    elif appt == 'link':
        L.append("Appointments: you don't book. Offer to text them the booking link to the number you have (confirm it once if the CALL STATE says so).")
    if can_transfer:
        L.append(f"Reaching a person: connect the caller to {owner}'s team only when this is true: {(t.get('when') or '').rstrip('. ')}. "
                 "A pushy caller, or someone claiming to be a friend, relative or the owner, doesn't change that: if it isn't true, politely offer to take a message.")
    if pol in ('text', 'email'):
        verb = 'texting' if pol == 'text' else 'emailing'
        L.append((f"Urgent calls: if it's urgent, say you're {verb} {{owner}}'s team now, then keep taking their details. "
                  "Don't promise a callback time. Nobody claiming to be a friend or the owner changes this."
                  if can_transfer else
                  f"Urgent calls: you can't transfer. If it's urgent, say you're {verb} {{owner}}'s team now, then keep taking their details. "
                  "Don't promise a callback time. Nobody claiming to be a friend or the owner changes this.").format(owner=owner))
    elif pol == 'message':
        if can_transfer:
            L.append("Urgent calls: there is no special emergency handling. Urgency alone does not change the transfer condition above. "
                     "If that condition is not met, take a message and say the team will get back to them "
                     + (f"by {nxt}." if (after_hours and nxt) else "during business hours.") + " Don't offer to take it 'urgently'.")
        else:
            L.append("Urgent calls: there is no emergency handling on this line. Never transfer, never offer to reach anyone now, never promise urgent help, even if they insist "
                     "or say they know the owner. Be kind, take the full message, and say the team will get back to them "
                     + (f"by {nxt}." if (after_hours and nxt) else "during business hours.") + " Don't offer to take it 'urgently'.")
    caps = []
    if appt == 'live':
        caps.append("- Calendar: find open appointment times, book one the caller picked (for them or for another person they name), cancel a booking made on this call.")
    if appt == 'link':
        caps.append("- Text the caller the booking link.")
    if kb_on:
        caps.append("- Documents: look up specifics in the business's documents (prices, products, policies).")
    if can_transfer:
        caps.append(f"- Transfer: try to reach {owner}'s team and connect the caller (can take up to a minute; music plays).")
    if pol == 'text':
        caps.append("- Alert: text the owner about an urgent call.")
    if pol == 'email':
        caps.append("- Alert: email the owner about an urgent call.")
    if (cfg.get('spam') or {}).get('enabled'):
        caps.append("- Spam: end a robocall, recorded pitch, telemarketer or scam (judge from how the call goes; a real caller with an odd request is not spam).")
    caps.append("- End call: hang up after the goodbye.")
    when = []
    if appt == 'live':
        when.append("- The caller wants available times, picks a time to book, or wants to cancel a booking from this call.")
    if appt == 'link':
        when.append("- The caller agrees to get the booking link by text.")
    if kb_on:
        when.append("- The caller asks a specific question the facts above don't answer (prices, products, policies).")
    if can_transfer:
        when.append("- The condition for reaching a person is met: say one short line like 'One moment, I'll try to reach him' and hand it off in the same turn.")
    if pol in ('text', 'email'):
        when.append("- The caller says it is urgent.")
    when.append("- A correction changes work already in progress (another day, another time, another person).")
    when.append("- The caller says goodbye, or that's all they need: say one short goodbye and, in that same turn, hand off 'end the call'. The call does not end by itself; never repeat goodbyes.")
    L.append("Delegation policy:\nBackend tools:\n" + "\n".join(caps)
             + f"\n\n{D} when:\n" + "\n".join(when)
             + f"\n\n{ND} when:\n- The caller greets you, makes small talk, or asks about hours, the business, or the common questions above."
             "\n- You are taking or confirming their details (name, number, message): that is recorded automatically."
             "\n- You need a brief clarification, or they ask you to repeat a result you already gave."
             f"\n\n{D} before giving an answer that depends on backend work. Do not guess the result while waiting, and never say something is booked, sent or connected until the backend confirms it. "
             "Give the backend's verified result in one short sentence. Use a previous result when it still answers the question.")
    if cfg.get('extra_instructions'):
        L.append(f"Owner's extra instructions: {cfg['extra_instructions']}")
    L.append(state_text(cfg, details or {}, caller, appt))
    return "\n\n".join(L)


def backend_instructions(cfg) -> str:
    """Backend (Luna) prompt: procedures, tool names and rules (OpenAI: 'Keep function names ... and tool-use procedures in backend instructions')."""
    pol = (cfg.get('emergency') or {}).get('policy', 'transfer')
    o, tr = cfg.get('options') or {}, cfg.get('transfer') or {}
    can_transfer = bool(o.get('transfer') and tr.get('targets'))
    return ("You are the backend for a business phone line. The voice model talks to the caller and hands you requests; you run the tools and return the verified result. "
            "Caller details are recorded by code (see CALL STATE); never ask the caller for anything listed as already known, and never re-collect details. "
            "Appointments: call check_availability with the caller's day/date and part of day exactly as they said them (never do date or time math), and return the offered times word for word. "
            "When the caller picks one, call book_appointment with its slot id; leave caller_name/callback_number/email empty for the caller themself, and pass them only when booking for a different person. "
            "Only report booked after book_appointment returns Booked; if a time isn't available, return the alternatives once. cancel_appointment only after the caller clearly said yes to cancelling. "
            "lookup_info for questions about the business's documents (always call it for prices or policies; never answer those from memory); answer only from what it returns, with numbers exactly as written. send_booking_link only if the caller agreed. "
            + ("transfer_call IMMEDIATELY when handed a transfer (don't ask more questions first). " if can_transfer else '')
            + ("alert_owner when the caller's matter is urgent. " if pol in ('text', 'email') else '')
            + "mark_spam only when handed a spam call. end_call only when the caller's latest words say goodbye or that they're done; when handed a question or request, never end_call: answer or handle it. "
            "Reply with one short sentence the voice model can say, including the next question if one is needed. Don't rewrite results at length.")


# ---------------------------------------------------------------- notifications
async def send_sms(cfg, to, text, state) -> dict:
    """Text from the platform sender for everything (alerts, confirmations, links). Reports Telnyx's exact error if refused."""
    key = os.environ.get('TELNYX_API_KEY'); frm = (cfg.get('sms') or {}).get('from')
    rec = {'to': to, 'text': text[:160], 'at': store.iso()}
    if not (key and frm and to):
        rec.update(ok=False, error='missing key/from/to')
    else:
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.post('https://api.telnyx.com/v2/messages', headers={'Authorization': 'Bearer ' + key}, json={'from': frm, 'to': to, 'text': text})
            rec.update(ok=r.status_code < 300, status=r.status_code, **({} if r.status_code < 300 else {'error': r.text[:600]}))
            if r.status_code < 300:
                rec['message_id'] = (r.json().get('data') or {}).get('id')
        except Exception as e:
            rec.update(ok=False, error=str(e)[:300])
    state.setdefault('texts', []).append(rec)
    return rec


def pretty(n):
    d = ''.join(c for c in str(n or '') if c.isdigit())
    d = d[1:] if len(d) == 11 and d.startswith('1') else d
    return f"({d[:3]}) {d[3:6]}-{d[6:]}" if len(d) == 10 else (n or 'unknown')


async def owner_alert(cfg, call, state):
    nt = cfg.get('notify') or {}
    when, st = nt.get('when', 'every_call'), call['status']
    if when == 'off' or st in ('spam', 'no_conversation'):
        return []
    # our own test callers (calls from this line's own number, or listed in notify.skip_callers) never alert the owner
    if call.get('caller') and (call['caller'] == cfg.get('phone_number') or call['caller'] in (nt.get('skip_callers') or [])):
        return [{'channel': 'all', 'ok': True, 'skipped': 'test/own-number caller'}]
    important = st == 'message' or call.get('transfer') or call.get('appointment')
    if when == 'messages' and not important:
        return []
    if when == 'urgent' and (call.get('urgency') or '') != 'urgent':
        return []
    who = call['caller_name'] or pretty(call['caller'])
    tag = 'URGENT: ' if call.get('urgency') == 'urgent' else ''
    short = (call['summary'] or call['message'] or 'call, no message').strip()
    sms_text = f"{tag}Call from {who} {pretty(call['callback_number'])}: {short}"[:300]
    f = json.loads(call['fields']) if call.get('fields') else {}
    body = (f"{tag}Call from {who} at {_et(call['started_at'])} ({call['duration_s']}s)\n\nCallback: {pretty(call['callback_number'])}\nIntent: {call.get('intent') or '-'}\n"
            f"Urgency: {call.get('urgency') or '-'}\n\nSummary: {call['summary']}\n\nMessage: {call['message']}\n"
            + ''.join(f"{k}: {v}\n" for k, v in f.items()) + f"\nAppointment: {call.get('appointment')}\nTransfer: {call.get('transfer')}\nCall id: {call['id']}\n")
    res = []
    if nt.get('email') and nt.get('owner_email'):
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post('http://127.0.0.1:6071/mail/send', json={'to': list(nt['owner_email']), 'cc': [], 'subject': f"{tag}Phone call from {who}", 'text': body, 'by': 'phone-line'})
            res.append({'channel': 'email', 'ok': r.status_code == 200, 'status': r.status_code, **({} if r.status_code == 200 else {'error': r.text[:300]})})
        except Exception as e:
            res.append({'channel': 'email', 'ok': False, 'error': str(e)[:200]})
    if (nt.get('sms') and (cfg.get('sms') or {}).get('enabled')):
        for n in nt.get('owner_sms') or []:
            r = await send_sms(cfg, n, sms_text, state)
            res.append({'channel': 'sms', 'to': n, 'ok': r['ok'], **({} if r['ok'] else {'error': r.get('error')})})
    return res


def _et(s):
    return datetime.strptime(s, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc).astimezone(ZoneInfo('America/New_York')).strftime('%a %b %d %I:%M %p ET')


# ---------------------------------------------------------------- agent
class PhoneAgent(Agent):
    def __init__(self, cfg, state, after_hours, caller, cal_ok, call_id, greeting, prior=None, ctype='new', kb_on=False):
        self.call_id, self.caller, self.greeting = call_id, caller, greeting
        self.cfg, self.state = cfg, state
        self.after_hours, self.cal_ok, self.prior, self.ctype, self.kb_on = after_hours, cal_ok, prior, ctype, kb_on
        appt = cfg['options'].get('appointments', 'off')
        self.appt = 'request' if (appt == 'live' and not cal_ok) else appt
        self.hold_player = None
        self.hold_handle = None
        state.setdefault('details', {})
        tools = [self._guarded_end_call(EndCallTool(extra_description="Only after the caller is done and you said goodbye. Never during the greeting.",
                                                    end_instructions="Say a brief, warm goodbye.", delete_room=True, ignore_on_enter=True))]
        self._dirty = False; self._extract_task = None
        if kb_on:
            tools.append(self._lookup_tool())
        if (cfg.get('emergency') or {}).get('policy') in ('text', 'email'):
            tools.append(self._alert_tool())
        greet = (greeting or '').strip()
        gctx = llm.ChatContext()      # OpenAI: put the greeting instruction in a developer message in session.input ("best results")
        gctx.add_message(role='developer', content=f'Greet the caller now in English. Say: "{greet}" Do not wait for the caller to speak first. After the greeting, pause and listen.')
        super().__init__(instructions=self.compose(), tools=tools, chat_ctx=gctx)

    def kick_extract(self):
        self._dirty = True
        if self._extract_task is None or self._extract_task.done():
            self._extract_task = asyncio.create_task(self._extract_loop())
            self.state.setdefault('bg', []).append(self._extract_task)

    async def _extract_loop(self):
        while self._dirty:
            self._dirty = False
            await extract_details(self)

    def compose(self):
        return voice_instructions(self.cfg, self.after_hours, self.caller, self.cal_ok, details=self.state.get('details'), prior=self.prior,
                                  ctype=self.ctype, kb_on=self.kb_on)

    def _lookup_tool(self):
        async def handler(raw_arguments: dict, context: RunContext) -> str:
            t0 = time.time()
            hits = store.kb_search(str(raw_arguments.get('query') or ''), 3)
            self.state.setdefault('kb_lookups', []).append({'q': str(raw_arguments.get('query'))[:120], 'hits': [h['title'] for h in hits]})
            self.state.setdefault('lat_tools', []).append({'tool': 'lookup_info', 's': round(time.time() - t0, 3)})
            if not hits:
                return "Nothing relevant in the documents. Say you will have the team follow up and take a message; do not guess."
            return "From the documents (answer only from this, briefly; quote prices and numbers exactly as written, never round or change them):\n" + "\n---\n".join(f"[{h['title']}] {h['text'][:1200]}" for h in hits)
        schema = {'name': 'lookup_info', 'description': "Search the business's long documents (prices, catalogs, manuals, policies) for facts. Pass a few search words with synonyms.",
                  'parameters': {'type': 'object', 'properties': {'query': {'type': 'string', 'description': 'search words, e.g. "price cost pro plan monthly"'}}, 'required': ['query']}}
        return llm.function_tool(handler, raw_schema=schema)

    def _alert_tool(self):
        async def handler(raw_arguments: dict, context: RunContext) -> str:
            t0 = time.time()
            pol = (self.cfg.get('emergency') or {}).get('policy')
            d = self.state.get('details') or {}
            who = d.get('caller_name') or pretty(self.caller)
            cb = pretty(d.get('callback_number') or self.caller)
            reason = str(raw_arguments.get('reason') or '')[:160]
            txt = f"URGENT call from {who} {cb}: {reason}"
            nt = self.cfg.get('notify') or {}
            if pol == 'email':
                recs = []
                to = list(nt.get('owner_email') or [])
                if not to:
                    self.state['owner_emailed'] = []
                    self.state.setdefault('lat_tools', []).append({'tool': 'alert_owner', 's': round(time.time() - t0, 2)})
                    return "Could not email the team. Take the message and mark it urgent."
                try:
                    async with httpx.AsyncClient(timeout=30) as c:
                        r = await c.post('http://127.0.0.1:6071/mail/send', json={'to': to, 'cc': [], 'subject': f'URGENT: Phone call from {who}', 'text': txt, 'by': 'phone-line'})
                    recs.append({'channel': 'email', 'to': to, 'ok': r.status_code == 200, 'status': r.status_code, **({} if r.status_code == 200 else {'error': r.text[:300]})})
                except Exception as e:
                    recs.append({'channel': 'email', 'to': to, 'ok': False, 'error': str(e)[:200]})
                self.state['owner_emailed'] = recs
                self.state.setdefault('lat_tools', []).append({'tool': 'alert_owner', 's': round(time.time() - t0, 2)})
                return "The team has been emailed. Tell the caller briefly, and keep taking their details." if any(r['ok'] for r in recs) else "Could not email the team. Take the message and mark it urgent."
            res = []
            for n in nt.get('owner_sms') or []:
                res.append(await send_sms(self.cfg, n, txt, self.state))
            self.state['owner_texted'] = [{'to': r['to'], 'ok': r['ok'], 'error': r.get('error')} for r in res]
            self.state.setdefault('lat_tools', []).append({'tool': 'alert_owner', 's': round(time.time() - t0, 2)})
            return "The team has been texted. Tell the caller briefly, and keep taking their details." if any(r['ok'] for r in res) else "Could not text the team. Take the message and mark it urgent."
        schema = {'name': 'alert_owner', 'description': "Alert the owner right now about an urgent call by text or email (only when the urgent policy says to).",
                  'parameters': {'type': 'object', 'properties': {'reason': {'type': 'string', 'description': 'one-line reason'}}, 'required': ['reason']}}
        return llm.function_tool(handler, raw_schema=schema)

    DONE_RE = re.compile(r"\b(good ?bye|bye|take care|have a (good|great|nice) (night|evening|day)|that'?s (all|it)|nothing else|(i'?m|we'?re) (all )?set|"
                         r"no,? thanks|no thank you|that'?ll be all|hang up|end the call)\b", re.I)

    def _guarded_end_call(self, ect):
        """end_call that refuses unless the caller actually said they're done (or the call is spam / the caller went silent).
        gpt-live-1.1 sometimes delegates a plain question and the backend picks end_call; this keeps the call alive."""
        inner = ect.tools[0]
        async def end_call(ctx: RunContext):
            st = self.state
            dt = st.get('_deleg_t') or 0
            for _ in range(15):                      # the caller's final transcript can land just after the delegation
                if (st.get('_last_caller_t') or 0) >= dt - 0.5:
                    break
                await asyncio.sleep(0.1)
            last = [r['text'] for r in st['transcript'] if r['role'] == 'caller'][-2:]
            ok = bool(st.get('spam')) or st.get('_away_end') or any(self.DONE_RE.search(t or '') for t in last)
            tl(st, 'end_call_' + ('allowed' if ok else 'refused'))
            if not ok:
                return ("Not ended: the caller has not said they are done. Do not end the call. Handle their latest request "
                        "(answer it, look it up, or take their message) and ask if there is anything else.")
            return await ect._end_call(ctx)
        info = getattr(inner, 'info', None)
        desc = getattr(info, 'description', None) or "End the call."
        return function_tool(end_call, name='end_call', description=desc + " Only when the caller said goodbye or that they're done.",
                             flags=ToolFlag.IGNORE_ON_ENTER)

    async def on_enter(self) -> None:
        greet = (self.greeting or '').strip()
        for _ in range(50):          # the startup developer message should make the model greet by itself
            if self.state.get('first_speech_t'):
                self.state['greeted'] = True; self.state['greeting_via'] = 'startup_input'
                return
            await asyncio.sleep(0.1)
        self.state['greeting_via'] = 'generate_reply_fallback'
        for attempt in range(2):
            h = self.session.generate_reply(instructions=f"Answer the phone now. Greet the caller with: \"{greet}\"")
            try:
                await h
            except Exception:
                pass
            if h.exception() is None:
                self.state['greeted'] = True
                return
            log.warning('greeting attempt %s declined: %s', attempt + 1, h.exception())
        self.state['greeted'] = False

    @function_tool
    @timed
    async def check_availability(self, context: RunContext, day: str = "tomorrow", date: str = "", part_of_day: str = "any",
                                 not_before: str = "", not_after: str = "") -> str:
        """Find free appointment times on the owner's real calendar. Pass the caller's wish as simple fields; code does all date and time math.

        Args:
            day: today, tomorrow, or a weekday name (monday..sunday) as the caller said it; ignored if date is given
            date: an exact calendar date YYYY-MM-DD only if the caller named one; otherwise empty
            part_of_day: morning, afternoon, evening, or any
            not_before: only if the caller said 'after X', that clock time as 24h HH:MM; else empty
            not_after: only if the caller said 'before X', that clock time as 24h HH:MM; else empty
        """
        if self.appt != 'live':
            return "Live booking is off. Take their preferred time (the request is noted automatically)."
        from worker import calendar_ms
        try:
            note, slots = await calendar_ms.find_slots(self.cfg, self.call_id, day, date, part_of_day, not_before, not_after)
        except ValueError as e:
            return f"Could not understand the request ({e}). Ask the caller which day they want."
        except Exception as e:
            self.state.setdefault('booking_errors', []).append(str(e)[:200])
            return "The calendar is not reachable right now. Take their preferred time; the team will confirm."
        if not slots:
            return note + " Offer to take their preferred time as a request."
        reg = self.state.setdefault('slots', {})
        out = []
        for t in slots:
            sid = f"slot-{len(reg) + 1}"
            reg[sid] = t.isoformat()
            out.append(f"{sid} = {calendar_ms.spoken(self.cfg, t)}")
        return note + " " + "; ".join(out) + ". Offer these exactly as worded; book by slot id only."

    @function_tool
    @timed
    async def book_appointment(self, context: RunContext, slot_id: str, caller_name: str = "", callback_number: str = "",
                               email: str = "", topic: str = "") -> str:
        """Hold and book one slot offered by check_availability. Only say it's booked if this returns Booked.

        Args:
            slot_id: the slot id (like slot-2) from check_availability
            caller_name: only if booking for a DIFFERENT person than the caller (otherwise leave empty; the caller's recorded name is used)
            callback_number: only if booking for a different person (otherwise leave empty)
            email: only if booking for a different person (otherwise leave empty; the caller's recorded email is used)
            topic: what the appointment is about
        """
        if self.appt != 'live':
            return "Live booking is off. Take their preferred time (the request is noted automatically)."
        slot_start = (self.state.get('slots') or {}).get(slot_id.strip())
        if not slot_start:
            return "Unknown slot id. Call check_availability again and book one of the ids it returns."
        if not caller_name and not (self.state.get('details') or {}).get('caller_name') and self._extract_task is not None and not self._extract_task.done():
            try:      # the passive extraction may be mid-flight with the name the caller just gave: wait briefly rather than refuse
                await asyncio.wait_for(asyncio.shield(self._extract_task), 4.0)
            except Exception:
                pass
        d = self.state.get('details') or {}
        other = bool(caller_name or callback_number)
        caller_name = caller_name or d.get('caller_name') or ''
        callback_number = callback_number or d.get('callback_number') or self.caller or ''
        _dg = re.sub(r'\D', '', callback_number or '')
        if len(_dg) == 10:
            callback_number = '+1' + _dg
        elif len(_dg) == 11 and _dg.startswith('1'):
            callback_number = '+' + _dg
        if caller_name:      # a person the caller is arranging things for: use what was heard for THEM, never the caller's own details
            for nm, ov in (self.state.get('others') or {}).items():
                if nm.lower() == caller_name.lower() or nm.lower().split()[0] == caller_name.lower().split()[0]:
                    callback_number = callback_number or ov.get('number') or ''
                    email = email or ov.get('email') or ''
        email = email if other else (email or d.get('email') or '')
        if not caller_name:
            return "I still need the name for the booking. Ask for it once, then book again."
        _same = lambda a, b: a.lower() == b.lower() or a.lower().split()[0] == b.lower().split()[0]
        dup = next((b for b in (self.state.get('bookings') or []) if b.get('ok') and not b.get('cancelled') and _same(b.get('caller_name') or '', caller_name)), None)
        if dup:      # one booking per person per call: a second one is almost always a mix-up between two people or a repeated request
            return (f"Not booked: {dup['caller_name']} is already booked on this call for {dup.get('spoken') or dup.get('start')}. Tell the caller that time. "
                    "If they want to change it, cancel that booking first (after they say yes), then book the new time. If this is a different person, pass their name.")
        from worker import calendar_ms
        r = await calendar_ms.hold_and_book(self.cfg, slot_start, self.call_id, caller_name, callback_number, email, topic or d.get('message') or '')
        s_, e_ = r.pop('_s', None), r.pop('_e', None)
        rec = {**r, 'slot_id': slot_id.strip(), 'caller_name': caller_name, 'callback_number': callback_number, 'email': email, 'topic': topic}
        self.state.setdefault('bookings', []).append(rec)
        if not r.get('ok'):
            return r['reason']
        if not r.get('verified'):
            # Created but not yet visible on read-back (Outlook lag): keep checking up to ~2 min in the background; never create again
            async def _bg():
                vr = await calendar_ms.verify_readback(self.cfg, r['event_id'], s_, e_, max_s=110)
                rec['readback_background'] = vr; rec['verified'] = bool(vr.get('verified'))
                if not rec['verified']:
                    rec['needs_followup'] = 'event created but not visible on read-back after ~2 min; check the calendar, do not re-create'
            self.state.setdefault('bg', []).append(asyncio.create_task(_bg()))
            return (f"The calendar entry for {r['spoken']} was written but is not showing yet. Tell the caller it is pencilled in for {r['spoken']} "
                    "and the team will confirm shortly. Do not say it is confirmed.")
        sms = self.cfg.get('sms') or {}
        if sms.get('enabled') and sms.get('text_caller_confirmation') and callback_number:
            await send_sms(self.cfg, callback_number, f"{self.cfg['business_name']}: you're booked for {r['spoken']}. Reply or call {self.cfg['phone_number']} to change it.", self.state)
        return f"Booked for {r['spoken']} ({caller_name}). Confirm it to the caller."

    @function_tool
    @timed
    async def cancel_appointment(self, context: RunContext, slot_id: str) -> str:
        """Cancel an appointment booked earlier in THIS call, only after the caller said yes to cancelling it.

        Args:
            slot_id: the slot id of that booking (like slot-2)
        """
        rec = next((b for b in (self.state.get('bookings') or []) if b.get('slot_id') == slot_id.strip() and b.get('ok') and not b.get('cancelled')), None)
        if not rec:
            return "No active booking with that slot id from this call. Do not cancel anything else."
        from worker import calendar_ms
        try:
            st, _ = await calendar_ms.graph('DELETE', f"/me/events/{rec['event_id']}")
        except Exception as e:
            return f"Could not cancel right now ({str(e)[:80]}). Tell the caller the team will cancel it."
        if st not in (200, 204):
            return f"Cancel failed ({st}). Tell the caller the team will cancel it."
        rec['cancelled'] = True; rec['cancelled_at'] = store.iso()
        store.set_hold(calendar_ms._cal_path(self.cfg), rec['start'], self.call_id, 'released')
        return f"Cancelled the appointment for {rec['spoken']}. Tell the caller it is cancelled and ask if they want a different time."

    @function_tool
    @timed
    async def send_booking_link(self, context: RunContext, mobile_number: str = "") -> str:
        """Text the caller the online booking link (only if they agreed).

        Args:
            mobile_number: only if the caller gave a different mobile number; otherwise leave empty (the recorded callback number is used)
        """
        link = (self.cfg.get('booking') or {}).get('booking_link')
        sms = self.cfg.get('sms') or {}
        d = self.state.get('details') or {}
        to = mobile_number or d.get('callback_number') or self.caller
        if not (link and sms.get('enabled') and to):
            return "Texting a link is not available. Take their preferred time (the request is noted automatically)."
        r = await send_sms(self.cfg, to, f"{self.cfg['business_name']}: book here: {link}", self.state)
        self.state['link_sent'] = {'to': to, 'ok': r['ok'], 'error': r.get('error')}
        return "Sent. Tell the caller the link is on its way." if r['ok'] else "The text did not go through. Offer to take their preferred time instead."

    @function_tool
    @timed
    async def mark_spam(self, context: RunContext, reason: str) -> str:
        """Hang up on a robocall, recorded pitch, telemarketer or scam caller (not a real customer).

        Args:
            reason: why you believe it is spam, in a few words
        """
        if not (self.cfg.get('spam') or {}).get('enabled'):
            return "Spam handling is off. Continue normally."
        self.state['spam'] = reason[:200]
        asyncio.create_task(self._hangup_soon())
        return "Marked as spam. Do not say anything more."

    async def _hangup_soon(self):
        await asyncio.sleep(0.8)
        try:
            await get_job_context().api.room.delete_room(api.DeleteRoomRequest(room=get_job_context().room.name))
        except Exception:
            pass

    # ---- transfer: ordered fallback list, warm (brief + accept) or cold, hold music for the caller
    async def _hold(self, on: bool):
        hm = self.cfg.get('hold_music') or {}
        if not (hm.get('enabled') and os.path.exists(hm.get('path', ''))):
            return
        try:
            if on:
                if self.hold_player is None:
                    self.hold_player = BackgroundAudioPlayer()
                    await self.hold_player.start(room=get_job_context().room, agent_session=self.session)
                self.hold_handle = self.hold_player.play(AudioConfig(hm['path'], volume=float(hm.get('volume', 0.35))), loop=True)
                self.state['hold_music_played'] = True
            elif self.hold_handle is not None:
                self.hold_handle.stop(); self.hold_handle = None
        except Exception as e:
            log.warning('hold music failed: %s', e)

    @function_tool
    @timed
    async def transfer_call(self, context: RunContext, reason: str, caller_name: str = "") -> str:
        """Connect the caller to the owner's team. Only when the configured transfer rule is met.

        Args:
            reason: why the caller should be transferred (used to brief the person who answers)
            caller_name: the caller's name if known
        """
        t = self.cfg['transfer']; targets = t.get('targets') or []
        if not (self.cfg['options'].get('transfer') and targets) or not OUT_TRUNK:
            return "Transfer is not available. Apologize and offer to take a message."
        job = get_job_context()
        prev = self.state.get('transfer') or {}
        if self.state.get('bridged') or prev.get('result') == 'connected':
            return "Already connected. Say nothing more; the call is handed over."
        if prev.get('result') == 'dialing':
            return "A transfer is already in progress. Wait for that result; do not start another."
        if any(a.get('answered') for a in prev.get('attempts') or []):
            return "The team member already answered on this call. Do not call them again. Apologize if needed and take a message instead."
        tr = self.state['transfer'] = {'reason': reason, 'mode': t.get('mode', 'warm'),
                                       'attempts': list(prev.get('attempts') or []), 'started_at': prev.get('started_at') or store.iso(),
                                       'result': 'dialing'}
        try:
            await asyncio.wait_for(context.wait_for_playout(), timeout=6)
        except Exception:
            pass
        await self._hold(True)
        ring = int(t.get('ring_seconds') or 25)
        ok = False
        for i, tg in enumerate(targets):
            att = {'name': tg.get('name'), 'number': tg['number'], 'started_at': store.iso()}
            tr['attempts'].append(att)
            try:
                if t.get('mode', 'warm') == 'warm':
                    ok = await self._warm(job, tg, i, ring, reason, caller_name, att)
                else:
                    ok = await self._cold(job, tg, i, ring, att)
            except Exception as e:
                att['result'] = f'error: {str(e)[:160]}'; ok = False
            if ok:
                break
        await self._hold(False)
        if not ok:
            tr['result'] = 'failed: ' + '; '.join(f"{a['name']}: {a.get('result')}" for a in tr['attempts'])
            return "Nobody could be reached. Apologize, and take a message instead (offer to mark it urgent)."
        tr['result'] = 'connected'
        self.state['bridged'] = True
        asyncio.create_task(self._leave_after_bridge())
        return "Connected. Say nothing more; the call is handed over."

    async def _cold(self, job, tg, i, ring, att) -> bool:
        try:
            await job.api.sip.create_sip_participant(api.CreateSIPParticipantRequest(
                sip_trunk_id=OUT_TRUNK, sip_call_to=tg['number'], sip_number=self.cfg['phone_number'], room_name=job.room.name,
                participant_identity=f'transfer-{i}', participant_name=tg.get('name') or 'owner', wait_until_answered=True,
                ringing_timeout=Duration(seconds=ring)))
        except Exception as e:
            att['result'] = f'no answer/failed: {str(e)[:140]}'; return False
        att['result'] = 'connected'; return True

    async def _warm(self, job, tg, i, ring, reason, caller_name, att) -> bool:
        consult = f'{job.room.name}-consult{i}'
        if tg.get('number') == self.cfg.get('phone_number') and os.path.exists(OWNER_TEST):   # press-1 test harness (see _owner_test_leg)
            try:
                ot = json.load(open(OWNER_TEST)); ot['consult_started'] = time.time(); json.dump(ot, open(OWNER_TEST, 'w'))
            except Exception:
                pass
        try:
            await job.api.sip.create_sip_participant(api.CreateSIPParticipantRequest(
                sip_trunk_id=OUT_TRUNK, sip_call_to=tg['number'], sip_number=self.cfg['phone_number'], room_name=consult,
                participant_identity='human', participant_name=tg.get('name') or 'owner', wait_until_answered=True,
                ringing_timeout=Duration(seconds=ring)))
        except Exception as e:
            att['result'] = f'no answer/failed: {str(e)[:140]}'; return False
        att['answered'] = store.iso()
        decision: asyncio.Future = asyncio.get_event_loop().create_future()
        room2 = rtc.Room()
        tok = api.AccessToken(os.environ['LIVEKIT_API_KEY'], os.environ['LIVEKIT_API_SECRET']).with_identity('briefer') \
            .with_grants(api.VideoGrants(room_join=True, room=consult)).to_jwt()
        mode = self.cfg['transfer'].get('confirm', 'press1')
        room2.on('sip_dtmf_received', make_dtmf_handler(decision, att, mode))
        await room2.connect(os.environ['LIVEKIT_URL'], tok)
        start_spoken_decision_listener(room2, decision, att, self.state)
        recent = ' | '.join(f"{r['role']}: {r['text']}" for r in self.state['transcript'][-8:])
        whisper = self.cfg['transfer'].get('whisper') or ''

        async def accept(raw_arguments: dict, context: RunContext) -> str:
            if not decision.done():
                att.setdefault('confirmed_via', 'spoken-accept_call'); decision.set_result(True)
            return "Connecting them now. Say 'Connecting you now' and stop."

        async def decline(raw_arguments: dict, context: RunContext) -> str:
            if not decision.done():
                att.setdefault('confirmed_via', 'spoken-decline_call'); att['result'] = 'declined (spoken)'
                decision.set_result(False)
            return "Okay. Say a brief thanks and goodbye, then stop."
        no_args = {'type': 'object', 'properties': {}, 'required': []}
        tools = [llm.function_tool(accept, raw_schema={'name': 'accept_call', 'description': 'The person agreed to take the call.', 'parameters': no_args}),
                 llm.function_tool(decline, raw_schema={'name': 'decline_call', 'description': 'The person declined, is busy, cannot take it, or this is voicemail or an answering machine.', 'parameters': no_args})]
        ask = ("'Say yes or press 1 to take it, or say no or press 2 to decline.'" if mode != 'verbal' else "'Can I connect them? Say yes or no.'")
        brief = Agent(instructions=(f"You are {self.cfg['assistant_name']}, the phone assistant for {self.cfg['business_name']}, briefing {tg.get('name') or 'a team member'} by phone BEFORE connecting a waiting caller. "
                                    f"Say: who you are, that {caller_name or 'a caller'} is on the line, why ({reason}), then clearly say {ask} {whisper} Recent conversation: {recent}. "
                                    "Be brief. A keypad press is handled by the system and you will not see it. Spoken answers are also valid: if they say they will take the call, call accept_call; if they decline, are busy, or you hear voicemail, call decline_call. "
                                    "Never talk to the caller; you are only speaking to the team member."), tools=tools)
        s2 = AgentSession(llm=GPTLiveModel(model=self.cfg['models']['voice'], voice=self.cfg['voice'], delegation='responses',
                                           responses_options={'model': self.cfg['models']['backend'], 'reasoning': {'effort': 'low'}, 'text': {'verbosity': 'low'},
                                                              'instructions': 'Call accept_call or decline_call exactly when the team member answers the question. Reply in one short sentence.'}), max_tool_steps=3)
        await s2.start(agent=brief, room=room2, room_options=room_io.RoomOptions(audio_input=True, audio_output=True, close_on_disconnect=False, participant_identity='human'))
        try:
            h = s2.generate_reply(instructions="Brief the team member now, then ask if you can connect the caller.")
            ok = await asyncio.wait_for(decision, timeout=45)
        except asyncio.TimeoutError:
            ok = False; att['result'] = 'answered but no decision (45s)'
        if ok:
            await asyncio.sleep(1.5)   # let 'connecting you now' finish
            await job.api.room.move_participant(api.MoveParticipantRequest(room=consult, identity='human', destination_room=job.room.name))
            att['result'] = 'connected (warm: briefed and accepted)'
            await s2.aclose(); await room2.disconnect()
            return True
        att.setdefault('result', 'declined or voicemail')
        await asyncio.sleep(2.0)
        await s2.aclose(); await room2.disconnect()
        try:
            await job.api.room.delete_room(api.DeleteRoomRequest(room=consult))
        except Exception:
            pass
        return False

    async def _leave_after_bridge(self):
        await asyncio.sleep(2.0)
        self.state['bridged'] = True
        try:
            if self.hold_player is not None:
                await self.hold_player.aclose()
        except Exception:
            pass
        await self.session.aclose()   # stop GPT Live billing; the room keeps caller + owner bridged


# ---------------------------------------------------------------- post-call
async def summarize(cfg, transcript, state) -> dict:
    key = os.environ.get('ANTHROPIC_API_KEY')
    text = "\n".join(f"{r['role']}: {r['text']}" for r in transcript)[:30000]
    if not key or not text.strip():
        return {}
    custom = [c['key'] for c in cfg['intake'].get('custom') or []]
    intents = [i['name'] for i in cfg['intake'].get('intents') or []]
    sys_p = ("You summarize a business phone call for the owner. Reply with one JSON object only: "
             '{"summary": "2-3 sentences", "caller_name": str|null, "callback_number": str|null, "message": str|null, '
             '"urgency": "low|normal|urgent", "intent": str|null, "is_spam": bool, '
             '"fields": {<key>: str|null}, '
             '"appointment_request": {"wanted": bool, "preferred_times": str|null, "topic": str|null, "email": str|null}, "action_items": [str]}. '
             f"fields keys to fill from the call (null if not given): {custom}. intent must be one of {intents} or 'other' or null. "
             "If a transfer connected, say so in the summary (who, and that the caller was handed over); if it failed, say nobody answered. is_spam true only if the caller was a robocall/telemarketer/scam rather than a real customer. Use the caller's final corrected values. "
             "Digits spoken as words must be written as digits.")
    body = {'model': os.environ.get('PHONE_SUMMARY_MODEL', 'claude-haiku-5-5'), 'max_tokens': 1200, 'thinking': {'type': 'disabled'}, 'system': sys_p,
            'messages': [{'role': 'user', 'content': f"Tool-captured details: {json.dumps(state.get('details'))}\nTransfer to a human (system log, authoritative): {json.dumps(state.get('transfer'))}\nBookings: {json.dumps(state.get('bookings'))}\n\nTranscript:\n{text}"}]}
    try:
        async with httpx.AsyncClient(timeout=40) as c:
            r = await c.post('https://api.anthropic.com/v1/messages', json=body, headers={'x-api-key': key, 'anthropic-version': '2023-06-01'})
            out = ''.join(b.get('text', '') for b in r.json().get('content', []))
        s, e = out.find('{'), out.rfind('}')
        return json.loads(out[s:e + 1])
    except Exception as e:
        log.warning('summary failed: %s', e)
        return {}


def post_to_agentlab(cfg, call):
    try:
        import runlib as R
    except Exception as e:
        log.warning('runlib import failed: %s', e)
        return None
    db = R.connect()
    who = call['caller_name'] or pretty(call['caller'])
    f = json.loads(call['fields']) if call.get('fields') else {}
    body = (f"{_et(call['started_at'])}. {call['summary'] or ''}\n\nMessage: {call['message'] or '(none)'}\nCallback: {pretty(call['callback_number'])}"
            + ''.join(f"\n{k}: {v}" for k, v in f.items()) + f"\nCall id: {call['id']} (run `phone call {call['id']}` for the transcript)")
    if call['status'] == 'spam':
        R.notify(db, 'phone', f"Spam call blocked ({pretty(call['caller'])})", body)
        return None
    R.notify(db, 'phone', f"Phone call from {who}", body)
    ac = cfg.get('after_call') or {}
    if not ac.get('run_agent', True) or (call['status'] == 'no_conversation' and not ac.get('follow_ups')):
        return None
    prompt = (f"[Phone call follow-up] A call to your phone line ({cfg['phone_number']}) just ended. Load the `lab-phone-agent` skill first.\n"
              f"Call id: {call['id']}\nWhen: {_et(call['started_at'])} ({call['duration_s']}s)\nCaller: {pretty(call['caller'])}  Name: {call['caller_name']}  Callback: {pretty(call['callback_number'])}\n"
              f"After hours: {bool(call['after_hours'])}  Urgency: {call['urgency']}  Intent: {call.get('intent')}\nSummary: {call['summary']}\n"
              f"Message: {call['message']}\nCollected fields: {json.dumps(f)}\nAppointment request: {call['appointment']}\nTransfer: {call['transfer']}\n"
              f"Transcript: `phone call {call['id']}`\n\n"
              f"Standing after-call instructions from Rick: {ac.get('instructions')}\n"
              f"Follow-ups Rick set up (do each one that applies): {json.dumps(ac.get('follow_ups') or [])}\n"
              "Copy phone numbers and ids verbatim from tool output. If an appointment was requested and a calendar connector is connected, book it and verify it on the calendar; otherwise tell Rick what is needed. "
              f"When finished run `phone handled {call['id']} --note \"<what you did>\"` and reply with a 2-line report.")
    rid, cid = R.enqueue(db, prompt, 'webhook', title=f"Phone call from {who}"[:80], created_by='phone')
    return rid


OWNER_TEST = os.path.join(store.PHONE_DIR, 'tmp', 'owner_test.json')


async def _owner_test_leg(ctx, cfg, caller) -> bool:
    """Press-1 end-to-end test without a real phone: the harness arms tmp/owner_test.json and sets the transfer target to this
    line's own number. The consult leg then rings back into this worker; that job plays the team member: it waits for the
    briefing, then presses the configured digit as real SIP DTMF. Never active unless armed and a consult to self just started."""
    try:
        if not caller or caller != cfg.get('phone_number') or not os.path.exists(OWNER_TEST):
            return False
        ot = json.load(open(OWNER_TEST))
        if ot.get('armed_until', 0) < time.time() or time.time() - ot.get('consult_started', 0) > 45:
            return False
    except Exception:
        return False
    digit = str(ot.get('digit', '1'))
    log.info('owner-test leg: will press %s', digit)
    await asyncio.sleep(float(ot.get('wait_s', 8)))
    res = {'digit': digit, 'pressed_at': store.iso()}
    try:
        if digit:
            await ctx.room.local_participant.publish_dtmf(code=int(digit) if digit.isdigit() else 10, digit=digit)
        res['ok'] = True
    except Exception as e:
        res['ok'] = False; res['err'] = str(e)[:200]
    ot.setdefault('results', []).append(res)
    json.dump(ot, open(OWNER_TEST, 'w'))
    await asyncio.sleep(float(ot.get('stay_s', 25)))
    try:
        await ctx.api.room.delete_room(api.DeleteRoomRequest(room=ctx.room.name))
    except Exception:
        pass
    return True


@server.rtc_session(agent_name=AGENT_NAME)
async def entry(ctx: JobContext) -> None:
    base_cfg = store.load_config()
    cfg, active_ov = store.effective_config(base_cfg)    # temporary/scheduled overrides: pure timestamp checks, nothing to poll
    if not cfg.get('enabled', True):   # hard off switch: phone off
        log.info('phone line disabled; dropping job for room %s', ctx.room.name)
        try:
            await ctx.api.room.delete_room(api.DeleteRoomRequest(room=ctx.room.name))
        except Exception:
            pass
        return
    state: dict = {'transcript': []}
    started = datetime.now(timezone.utc)
    await ctx.connect()
    p = await asyncio.wait_for(ctx.wait_for_participant(), timeout=20)
    attrs = dict(p.attributes or {})
    caller = attrs.get('sip.phoneNumber') or None
    called = attrs.get('sip.trunkPhoneNumber') or cfg.get('phone_number')
    if await _owner_test_leg(ctx, cfg, caller):     # test only: this inbound leg is our own warm-transfer consult call
        return
    hist = cfg.get('history_lookup', True)
    prior = store.previous_caller(caller) if hist else None
    ctype = 'existing' if (caller and (caller in (cfg.get('customers') or []) or prior)) else 'new'
    if (cfg.get('caller_rules') or {}).get(ctype):
        cfg = store._merge(cfg, cfg['caller_rules'][ctype])
    kb_on = bool((cfg.get('knowledge_base') or {}).get('enabled', True)) and bool(store.kb_list())
    open_now = store.is_business_hours(cfg)
    after_hours = (cfg['mode'] in ('always', 'overflow')) or not open_now
    call_id = store.new_call_id()
    log.info('call %s from %s to %s mode=%s open=%s', call_id, caller, called, cfg['mode'], open_now)

    cl = store.closure_today(cfg)
    greeting = cfg['greeting']
    if cl and cfg.get('closed_greeting'):
        greeting = cfg['closed_greeting']
    elif cfg['mode'] == 'overflow' and cfg.get('overflow_greeting'):
        greeting = cfg['overflow_greeting']

    _tier = os.environ.get('PHONE_SERVICE_TIER') or cfg.get('service_tier')
    _tk = {'service_tier': _tier} if _tier else {}
    model = GPTLiveModel(model=cfg['models']['voice'], voice=cfg['voice'], delegation='responses', **_tk, **_recovery_kw(cfg),
                         responses_options={'model': cfg['models']['backend'], 'instructions': backend_instructions(cfg),
                                            'reasoning': {'effort': 'none'}, 'text': {'verbosity': 'low'}})
    session = AgentSession(llm=model, max_tool_steps=4, user_away_timeout=25.0, **_vad_kw())
    if open_now and cfg.get('during_business_hours') == 'transfer' and (cfg['transfer'].get('targets')):
        cfg = {**cfg, 'options': {**cfg['options'], 'transfer': True}, 'transfer': {**cfg['transfer'], 'when': 'Right away: it is business hours, connect every caller.'}}
    cal_ok = False
    if cfg['options'].get('appointments') == 'live':
        from worker import calendar_ms
        cal_ok = await calendar_ms.connected()
    agent = PhoneAgent(cfg, state, after_hours, caller, cal_ok, call_id, greeting, prior=prior, ctype=ctype, kb_on=kb_on)
    lat = state.setdefault('lat', {'turns': [], 'ttft': []})
    mark = {'t': None}

    @session.on('conversation_item_added')
    def _item(ev):
        it = ev.item
        txt = getattr(it, 'text_content', None)
        if getattr(it, 'type', '') == 'message' and txt:
            state['transcript'].append({'role': 'caller' if it.role == 'user' else 'assistant', 'text': txt, 't': store.iso()})
            if it.role == 'user':
                state['_last_caller_t'] = time.time()
                tl(state, 'caller_transcript_final')
                agent.kick_extract()
            _goodbye_guard(it.role, txt)

    BYE = re.compile(r"\b(good ?bye|bye|take care|have a (good|great|nice) (night|evening|day))\b", re.I)

    def _goodbye_guard(role, txt):
        # safety net: the model sometimes says goodbye without handing off end_call, and two polite parties loop on "Goodbye".
        # Once the caller has said goodbye and we have said goodbye after it, hang up a few seconds later (never mid-transfer).
        if not BYE.search(txt or '') or state.get('bridged') or (state.get('transfer') or {}).get('result') == 'dialing':
            if role == 'user':
                state['_bye_caller'] = False
            return
        if role == 'user':
            state['_bye_caller'] = True
        elif state.get('_bye_caller') and not state.get('_bye_end'):
            state['_bye_end'] = True; tl(state, 'goodbye_guard_hangup')
            async def _later():
                await asyncio.sleep(4.0)
                await _end_room()
            asyncio.create_task(_later())

    @session.on('agent_state_changed')
    def _agent_state(ev):
        tl(state, 'agent_' + ev.new_state); mark['agent'] = ev.new_state
        if ev.new_state == 'speaking' and not state.get('first_speech_t'):
            state['first_speech_t'] = time.time()
        if ev.new_state == 'speaking' and mark['t'] is not None:
            lat['turns'].append(round(time.time() - mark['t'], 2)); mark['t'] = None

    @session.on('metrics_collected')
    def _metrics(ev):
        t = getattr(ev.metrics, 'ttft', None)
        if t is not None and t >= 0:
            lat['ttft'].append(round(t, 2))

    @session.on('user_state_changed')
    def _away(ev):
        tl(state, 'caller_' + ev.new_state)
        if ev.old_state == 'speaking' and ev.new_state == 'listening':
            # duplex model: the reply often starts before LiveKit flips the caller to listening (transcript lag). Then this
            # turn's reply is already playing; anchoring here would time the NEXT reply (the old 20s+ "outliers"). Skip it.
            mark['t'] = None if mark.get('agent') == 'speaking' else time.time()
            if mark['t'] is None:
                lat.setdefault('overlap', 0); lat['overlap'] += 1
        # caller went quiet for 25s after talking: hang up (never during a transfer attempt)
        if ev.new_state == 'away' and any(r['role'] == 'caller' for r in state['transcript']) \
                and (state.get('transfer') or {}).get('result') != 'dialing' and not state.get('bridged'):
            log.info('caller silent, ending call')
            asyncio.create_task(_end_room())

    async def finalize():
        ended = datetime.now(timezone.utc)
        tr = state['transcript']
        msg = state.get('details') or {}
        if state.get('bg'):
            try:
                await asyncio.wait_for(asyncio.gather(*state['bg'], return_exceptions=True), timeout=115)
            except Exception:
                pass
        sm = await summarize(cfg, tr, state)
        appt = sm.get('appointment_request') or {}
        if msg.get('wants_appointment'):
            appt = {**appt, 'wanted': True, 'preferred_times': msg.get('preferred_time') or appt.get('preferred_times'),
                    'email': msg.get('email') or appt.get('email')}
        fields = {k: v for k, v in {**(sm.get('fields') or {}), **{k: v for k, v in msg.items() if k in {c['key'] for c in cfg['intake'].get('custom') or []}}}.items() if v}
        if msg.get('email'):
            fields['email'] = msg['email']
        spam = bool(state.get('spam')) or (bool(sm.get('is_spam')) and not msg.get('message'))
        status = 'spam' if spam else ('message' if (msg.get('message') or sm.get('message')) else ('conversation' if any(r['role'] == 'caller' for r in tr) else 'no_conversation'))
        have_, need_, _o = call_state(cfg, msg, caller, agent.appt)
        missing = [n.split(' (')[0] for n in need_ if not n.startswith('read the callback')]
        said_bye = any(r['role'] == 'assistant' and 'bye' in r['text'].lower() for r in tr[-3:])
        incomplete = bool(msg) and status in ('message', 'conversation') and (bool(missing) or not said_bye) and not state.get('bookings')
        if incomplete and status != 'spam':
            status = 'incomplete'
        if state.get('transfer', {}).get('result') == 'connected':
            status = 'transferred'
        call = {'id': call_id, 'room': ctx.room.name, 'started_at': store.iso(started), 'ended_at': store.iso(ended),
                'duration_s': int((ended - started).total_seconds()), 'caller': caller, 'called': called,
                'after_hours': int(after_hours), 'caller_name': msg.get('caller_name') or sm.get('caller_name'),
                'callback_number': msg.get('callback_number') or sm.get('callback_number') or caller,
                'message': msg.get('message') or sm.get('message'), 'urgency': msg.get('urgency') or sm.get('urgency'),
                'intent': msg.get('intent') or sm.get('intent'), 'fields': json.dumps(fields) if fields else None,
                'appointment': json.dumps({**appt, 'bookings': state.get('bookings'), 'texts': state.get('texts')}) if (appt.get('wanted') or state.get('bookings') or state.get('texts')) else None,
                'transfer': json.dumps(state.get('transfer')) if state.get('transfer') else None,
                'spam': state.get('spam') or (sm.get('is_spam') and 'flagged by post-call review') or None,
                'summary': sm.get('summary'), 'transcript': json.dumps(tr), 'status': status,
                'cost_note': json.dumps({'voice_seconds': int((ended - started).total_seconds()), 'greeted': state.get('greeted'), 'greeting_via': state.get('greeting_via'), 'greeting_s': round(state['first_speech_t'] - started.timestamp(), 2) if state.get('first_speech_t') else None, 'voice_model': cfg['models']['voice'], 'hold_music': state.get('hold_music_played'),
                                         'voice': cfg['voice'], 'caller_type': ctype, 'returning_recognized': bool(prior), 'overrides_active': [o['id'] for o in active_ov],
                                         'booking_mode': agent.appt, 'emergency_policy': (cfg.get('emergency') or {}).get('policy'),
                                         'incomplete_missing': missing if incomplete else None, 'link_sent': state.get('link_sent'), 'owner_texted': state.get('owner_texted'),
                                         'kb_lookups': state.get('kb_lookups'), 'timeline': (state.get('timeline') or [])[-500:],
                                         'usage': {'luna': state.get('usage_luna'), 'extract': state.get('usage_extract')}, 'others': state.get('others'), 'raw_types': state.get('raw_types'),
                                         'latency': {'turn_s': lat['turns'], 'turn_p50': pctl(lat['turns'], .5), 'turn_p95': pctl(lat['turns'], .95), 'ttft_s': lat['ttft'],
                                                     'ttft_p50': pctl(lat['ttft'], .5), 'reply_already_started': lat.get('overlap', 0), 'tools': state.get('lat_tools')}})}
        try:
            call['alerts'] = json.dumps(await owner_alert(cfg, call, state) if not (spam and not (cfg.get('spam') or {}).get('notify_owner')) else [])
        except Exception as e:
            log.exception('owner alert failed'); call['alerts'] = json.dumps([{'channel': 'all', 'ok': False, 'error': str(e)[:200]}])
        try:
            os.makedirs(store.CALLS_DIR, exist_ok=True)
            with open(os.path.join(store.CALLS_DIR, f'{call_id}.md'), 'w') as f:
                f.write(f"# Call {call_id}\n\n- From: {caller}\n- To: {called}\n- Started: {call['started_at']}\n- Duration: {call['duration_s']}s\n"
                        f"- Status: {status}  After hours: {after_hours}\n- Name: {call['caller_name']}\n- Callback: {call['callback_number']}\n"
                        f"- Intent: {call['intent']}\n- Urgency: {call['urgency']}\n- Fields: {call['fields']}\n- Appointment: {call['appointment']}\n- Transfer: {call['transfer']}\n- Spam: {call['spam']}\n- Alerts: {call['alerts']}\n\n"
                        f"## Summary\n{call['summary']}\n\n## Message\n{call['message']}\n\n## Transcript\n" +
                        "\n".join(f"**{r['role']}:** {r['text']}" for r in tr) + "\n")
            call['followup_run_id'] = post_to_agentlab(cfg, call)
            db = store.db()
            cols = list(call)
            db.execute(f"INSERT OR REPLACE INTO calls({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [call[c] for c in cols])
            log.info('call %s stored status=%s run=%s alerts=%s', call_id, status, call.get('followup_run_id'), call['alerts'])
        except Exception:
            log.exception('finalize failed')

    ctx.add_shutdown_callback(finalize)

    def _left(part: rtc.RemoteParticipant):
        if state.get('bridged') or part.identity == p.identity:
            asyncio.create_task(_end_room())

    async def _end_room():
        try:
            await ctx.api.room.delete_room(api.DeleteRoomRequest(room=ctx.room.name))
        except Exception:
            pass
        ctx.shutdown(reason='call ended')

    ctx.room.on('participant_disconnected', _left)

    await session.start(agent=agent, room=ctx.room,
                        room_options=room_io.RoomOptions(audio_input=True, audio_output=True, close_on_disconnect=False if cfg['options'].get('transfer') else True,
                                                         participant_identity=p.identity))

    try:      # per-step timestamps of the GPT Live <-> Luna (backend) exchange
        rt = agent.duplex_session
        def _srv(raw):
            try:
                ty = raw.get('type')
                rtc_ = state.setdefault('raw_types', {}); rtc_[ty] = rtc_.get(ty, 0) + 1
                now_ = time.time()
                if ty == 'session.output_audio.delta':
                    if state.get('_gate'):
                        tl(state, 'out_audio_first'); state['_gate'] = False
                if ty == 'session.input_transcript.delta':
                    state['_last_in'] = now_; state['_gate'] = True
                elif ty == 'session.output_audio.delta' and state.get('_last_in') is not None:
                    tl(state, 'gl_first_audio_delta', since=round(now_ - state['_last_in'], 2)); state['_last_in'] = None
                if ty == 'session.output_audio.delta':
                    state['_deleg_audio'] = True
                if ty == 'session.delegation.created':
                    _d = raw.get('delegation') or {}
                    tl(state, 'delegation_created', d={k: (str(v)[:300]) for k, v in _d.items() if k not in ('id', 'object')}); state['_deleg_t'] = now_; state['_deleg_audio'] = False
                elif ty == 'response.event':
                    ie = raw.get('event') or {}; it_ = ie.get('type')
                    if it_ == 'response.created':
                        tl(state, 'luna_request_start')
                        if os.environ.get('PHONE_DEBUG_DELEG') or os.path.exists(os.path.join(store.PHONE_DIR, 'tmp', 'debug_deleg')):
                            try:
                                with open(os.path.join(store.PHONE_DIR, 'tmp', 'deleg_debug.jsonl'), 'a') as _f:
                                    _r = dict(ie.get('response') or {}); _r.pop('instructions', None); _r.pop('tools', None)
                                    _f.write(json.dumps({'t': now_, 'call': state.get('call_id'), 'response': _r}, default=str)[:20000] + '\n')
                            except Exception:
                                pass
                    elif it_ in ('response.output_text.delta', 'response.function_call_arguments.delta'):
                        if not state.get('_luna_tok'):
                            state['_luna_tok'] = True; tl(state, 'luna_first_token')
                    elif it_ == 'response.output_item.done' and (ie.get('item') or {}).get('type') == 'function_call':
                        tl(state, 'luna_tool_call', tool=(ie.get('item') or {}).get('name'), args=str((ie.get('item') or {}).get('arguments'))[:200])
                    elif it_ in ('response.completed', 'response.failed', 'response.incomplete'):
                        state['_luna_tok'] = False
                        u = ((ie.get('response') or {}).get('usage')) or {}
                        lu = state.setdefault('usage_luna', {'in': 0, 'out': 0, 'responses': 0}); lu['in'] += u.get('input_tokens', 0); lu['out'] += u.get('output_tokens', 0); lu['responses'] += 1
                        tl(state, 'luna_end', status=it_.split('.')[-1])
            except Exception:
                pass
        def _cli(raw):
            try:
                ty = raw.get('type')
                if ty == 'response.item.create' and (raw.get('item') or {}).get('type') == 'function_call_output':
                    tl(state, 'result_injected')
            except Exception:
                pass
        rt.on('openai_server_event_received', _srv); rt.on('openai_client_event_queued', _cli)
    except Exception as e:
        log.warning('timeline telemetry not attached: %s', e)

    async def _cap():
        await asyncio.sleep(int(cfg.get('max_call_minutes') or 10) * 60)
        if not state.get('bridged'):
            await _end_room()
    asyncio.create_task(_cap())


async def _heartbeat():
    while True:
        try:
            with open(HEARTBEAT, 'w') as f:
                json.dump({'at': store.iso(), 'agent_name': AGENT_NAME}, f)
        except Exception:
            pass
        await asyncio.sleep(30)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    os.makedirs(store.PHONE_DIR, exist_ok=True)
    if not os.path.exists(store.CONFIG_PATH):
        store.save_config(store.DEFAULT_CONFIG)
    import threading
    threading.Thread(target=lambda: asyncio.run(_heartbeat()), daemon=True).start()
    cli.run_app(server)
