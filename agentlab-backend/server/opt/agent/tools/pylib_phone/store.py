"""AgentLab phone: config + call log store (shared with the AgentLab `phone` CLI)."""
import json, os, sqlite3, time, uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

PHONE_DIR = os.environ.get('PHONE_DIR', '/workspace/runs/phone')
CONFIG_PATH = os.path.join(PHONE_DIR, 'config.json')
CALLS_DB = os.path.join(PHONE_DIR, 'calls.db')
CALLS_DIR = os.path.join(PHONE_DIR, 'calls')

DEFAULT_CONFIG = {
    "enabled": True,
    "phone_number": "+15715474814",
    "mode": "after_hours",            # after_hours | always | overflow (answers calls your own phone forwarded on busy/no-answer)
    "timezone": "America/New_York",
    "business_hours": {"mon": ["09:00", "17:00"], "tue": ["09:00", "17:00"], "wed": ["09:00", "17:00"],
                        "thu": ["09:00", "17:00"], "fri": ["09:00", "17:00"], "sat": None, "sun": None},
    # Holidays / closures. Each: {"date":"2026-12-25"} or {"start":"2026-12-24","end":"2026-12-26"}, "name", optional "hours":["10:00","14:00"]
    # (special hours; omit for closed all day), optional "message" (what to tell callers).
    "closures": [],
    "business_name": "Transovo",
    "owner_name": "Rick",
    "business_info": "Transovo (transovo.ai) makes AI video tools: an AI video editor, an AI clipper and YouTube video tools.",
    "assistant_name": "Ava",
    "voice": "marin",
    "greeting": "Thanks for calling Transovo. This is Ava, the after-hours assistant. How can I help you?",
    "overflow_greeting": "Thanks for calling Transovo. This is Ava; the team is tied up right now. How can I help you?",
    "closed_greeting": "",     # optional greeting on closure days; empty = default greeting plus the closure note
    "extra_instructions": "",
    # What the agent may do on a call (any combination; mirrors the old wizard's after-hours choices)
    "options": {
        "take_message": True,          # callback message
        "appointments": "request",     # off | request (just collect preferred time) | live (check + book on the calendar during the call) | link (text the owner's booking link)
        "transfer": False              # transfer to the transfer targets when transfer.when is true
    },
    "during_business_hours": "answer",   # answer | transfer
    # What the agent asks callers. Owners switch standard fields on/off and add their own (chat: phone field / phone standard).
    "intake": {
        "standard": {
            "name": {"on": True, "required": True, "ask": "May I have your name?"},
            "callback_number": {"on": True, "required": True, "ask": "What's the best number to reach you at? Confirm the number they're calling from."},
            "email": {"on": False, "required": False, "ask": "What's your email address?"},
            "reason": {"on": True, "required": True, "ask": "What is your message, or what is this about?"}
        },
        # custom fields: {"key":"budget","label":"Budget","ask":"What budget do you have in mind?","required":false,"intents":[]}
        # intents:[] = ask everyone; otherwise only when the caller's reason matches one of those intent names
        "custom": [],
        # intents: {"name":"new customer","description":"someone interested in buying","fields":["budget"],"questions":["..."],"urgent":false}
        "intents": []
    },
    # Urgent/emergency calls: "transfer" | "text" (text the owner right away) | "email" (email the owner right away) | "message" (no urgent handling: take a message for the next business day)
    "emergency": {"policy": "transfer"},
    # Short facts the agent always knows (set by chat: phone info / phone faq). Long documents go to the knowledge base (phone kb ...), searched on demand.
    "faq": [],                          # [{"q": "Where are you located?", "a": "123 Main St"}]
    "knowledge_base": {"enabled": True},
    # Temporary / scheduled changes (code applies them at call time; nothing to poll or restore):
    # [{"id","set":{config patch},"from":iso|null,"until":iso|null,"note"}]  until passes -> back to normal automatically
    "overrides": [],
    "history_lookup": True,             # recognize returning callers / existing customers by caller ID from the call history
    # Per caller type rules (patches): existing = caller ID found in call history or in "customers"; new = everyone else
    "caller_rules": {"existing": {}, "new": {}},
    "customers": [],                    # extra numbers to treat as existing customers (E.164)
    "transfer": {
        "number": "",                  # legacy single number (used if targets is empty)
        "targets": [],                 # ordered fallback list: [{"name":"Rick","number":"+1..."}, ...]
        "mode": "warm",                # warm = brief the person first and they accept; cold = connect straight away
        "confirm": "press1",           # warm only: press1 = they press 1 to accept / 2 to decline (saying yes/no also works); verbal = yes/no only
        "ring_seconds": 25,            # how long each number rings before moving to the next
        "when": "Only if the caller says it is an emergency or urgent and asks for a person.",
        "whisper": ""                  # extra words for the briefing, optional
    },
    "hold_music": {"enabled": True, "path": "/workspace/runs/phone/hold.ogg", "volume": 0.35},
    "booking": {
        "provider": "microsoft",       # microsoft (Graph calendar via AgentLab connector)
        "calendar_id": "",             # empty = the signed-in user's default calendar
        "appointment_minutes": 30, "buffer_minutes": 0, "days_ahead": 14, "min_notice_hours": 2,
        "slot_hold_minutes": 5, "booking_hours": None,   # None = business_hours; or {"mon":["09:00","17:00"],...,"sat":null} (give every day)
        # appointment_minutes must be 15, 30 or 60; buffer_minutes 0-120 between meetings; min_notice_hours 0-168; days_ahead 1-180.
        # Times are always in the business "timezone" above (IANA) -- never naive/UTC.
        "blackout_dates": [],          # no bookings on these: "2026-12-24" or {"start":"2026-12-24","end":"2026-12-26","name":"Vacation"}
        "holidays": {"closed": ["new_year", "mlk", "presidents", "memorial", "juneteenth", "independence", "labor", "columbus", "veterans", "thanksgiving", "christmas"]},   # US holidays listed here are not bookable; remove one to work that day
        "title": "Call with {caller_name}", "booking_link": ""
    },
    "sms": {
        "enabled": True, "from": "+18666020680",        # platform toll-free sender for ALL texts (alerts, confirmations, links)
        "text_caller_confirmation": False, "text_booking_link": False
    },
    "notify": {                       # instant owner alerts after each call
        "email": True, "owner_email": ["anthony@transovo.ai"],
        "sms": True, "owner_sms": ["+17038166017"],
        "when": "every_call"           # every_call | messages (message/appointment/transfer only) | urgent | off
    },
    "spam": {"enabled": True, "notify_owner": False},   # the model judges robocalls/telemarketers from how the call goes
    "after_call": {
        "run_agent": True,
        "instructions": "Post the message for Rick. Do nothing else unless a follow-up below says so.",
        "follow_ups": []
    },
    "models": {"voice": "gpt-live-1", "backend": "gpt-6-luna"},
    "max_call_minutes": 10
}

ALLOWED_TOP = set(DEFAULT_CONFIG)
VOICES = ["marin", "cedar", "beacon", "cinder", "stone", "vesper"]


def _merge(base, over):
    out = dict(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load_config():
    try:
        with open(CONFIG_PATH) as f:
            raw = json.load(f)
    except Exception:
        raw = {}
    # migrate first-version keys (Nov 25 v1) to options.*
    o = raw.setdefault('options', {})
    if 'take_messages' in raw:
        o.setdefault('take_message', bool(raw.pop('take_messages')))
    if 'collect_appointment_requests' in raw:
        o.setdefault('appointments', 'request' if raw.pop('collect_appointment_requests') else 'off')
    if isinstance(raw.get('transfer'), dict) and 'enabled' in raw['transfer']:
        o.setdefault('transfer', bool(raw['transfer'].pop('enabled')))
    if isinstance(raw.get('transfer'), dict):
        raw['transfer'].pop('enabled', None)
    if (raw.get('options') or {}).get('appointments') == 'send_link':
        raw['options']['appointments'] = 'link'
    cfg = _merge(DEFAULT_CONFIG, raw)
    t = cfg['transfer']
    if not t.get('targets') and t.get('number'):
        t['targets'] = [{'name': cfg.get('owner_name') or 'owner', 'number': t['number']}]
    return cfg


def validate(cfg):
    errs = []
    unknown = set(cfg) - ALLOWED_TOP
    if unknown:
        errs.append(f"unknown keys: {sorted(unknown)}")
    if cfg.get('mode') not in ('after_hours', 'always', 'overflow'):
        errs.append("mode must be after_hours, always or overflow")
    if cfg.get('voice') not in VOICES:
        errs.append(f"voice must be one of {VOICES}")
    try:
        ZoneInfo(cfg.get('timezone') or '')
    except Exception:
        errs.append("timezone must be an IANA name like America/New_York")
    bh = cfg.get('business_hours') or {}
    for d in bh:
        if d not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'):
            errs.append(f"business_hours day {d!r} invalid")
        v = bh[d]
        if v is not None:
            try:
                for t in v:
                    datetime.strptime(t, '%H:%M')
                assert len(v) == 2
            except Exception:
                errs.append(f"business_hours.{d} must be null or [\"HH:MM\",\"HH:MM\"]")
    o = cfg.get('options') or {}
    if set(o) - {'take_message', 'appointments', 'transfer'}:
        errs.append("options keys: take_message, appointments, transfer")
    if o.get('appointments') not in ('off', 'request', 'live', 'link'):
        errs.append("options.appointments must be off, request, live or link")
    t = cfg.get('transfer') or {}
    tg = t.get('targets') or []
    if t.get('confirm', 'press1') not in ('press1', 'verbal'):
        errs.append("transfer.confirm must be press1 or verbal")
    if t.get('mode') not in ('warm', 'cold'):
        errs.append("transfer.mode must be warm or cold")
    try:
        if not 5 <= int(t.get('ring_seconds')) <= 60:
            errs.append("transfer.ring_seconds must be 5-60")
    except Exception:
        errs.append("transfer.ring_seconds must be a number")
    for x in tg:
        if not (isinstance(x, dict) and str(x.get('number') or '').startswith('+')):
            errs.append("transfer.targets items need {name, number} with number in E.164")
    if (o.get('transfer') or cfg.get('during_business_hours') == 'transfer') and not (tg or str(t.get('number') or '').startswith('+')):
        errs.append("a transfer number is needed when transfers are on")
    for c in cfg.get('closures') or []:
        try:
            for k in ('date', 'start', 'end'):
                if c.get(k):
                    datetime.strptime(c[k], '%Y-%m-%d')
            assert c.get('date') or (c.get('start') and c.get('end'))
            if c.get('hours'):
                assert len(c['hours']) == 2 and all(datetime.strptime(h, '%H:%M') for h in c['hours'])
        except Exception:
            errs.append(f"closure {c!r} invalid: use date or start+end (YYYY-MM-DD) and optional hours [\"HH:MM\",\"HH:MM\"]")
    it = cfg.get('intake') or {}
    keys = set()
    for c in it.get('custom') or []:
        k = str(c.get('key') or '')
        if not k or not k.replace('_', '').isalnum() or k in keys or k in ('name', 'callback_number', 'email', 'reason', 'message', 'intent', 'urgency'):
            errs.append(f"custom field key {k!r} must be unique letters/digits/underscore and not a standard name")
        keys.add(k)
        if not str(c.get('ask') or '').strip():
            errs.append(f"custom field {k} needs an 'ask' wording")
    inames = {i.get('name') for i in it.get('intents') or []}
    for c in it.get('custom') or []:
        for n in c.get('intents') or []:
            if n not in inames:
                errs.append(f"field {c.get('key')} refers to unknown intent {n!r}")
    for i in it.get('intents') or []:
        for k in i.get('fields') or []:
            if k not in keys and k not in (it.get('standard') or {}):
                errs.append(f"intent {i.get('name')} lists unknown field {k!r}")
    if set((it.get('standard') or {})) - {'name', 'callback_number', 'email', 'reason'}:
        errs.append("intake.standard keys: name, callback_number, email, reason")
    if o.get('appointments') == 'link' and not (cfg.get('booking') or {}).get('booking_link'):
        errs.append("booking.booking_link is needed for appointments=link")
    sms = cfg.get('sms') or {}
    if sms.get('enabled') and not str(sms.get('from') or '').startswith('+'):
        errs.append("sms.from must be an E.164 number")
    nt = cfg.get('notify') or {}
    if nt.get('when') not in ('every_call', 'messages', 'urgent', 'off'):
        errs.append("notify.when must be every_call, messages, urgent or off")
    for n in nt.get('owner_sms') or []:
        if not str(n).startswith('+'):
            errs.append("notify.owner_sms numbers must be E.164")
    for e in nt.get('owner_email') or []:
        if '@' not in str(e):
            errs.append("notify.owner_email must be email addresses")
    for o in cfg.get('overrides') or []:
        try:
            assert isinstance(o.get('set'), dict) and not (set(o['set']) - (ALLOWED_TOP - {'overrides'}))
            for k in ('from', 'until'):
                if o.get(k):
                    datetime.fromisoformat(o[k])
        except Exception:
            errs.append(f"override {o.get('id')} invalid (needs a config patch in 'set' and ISO times)")
    cr = cfg.get('caller_rules') or {}
    if set(cr) - {'existing', 'new'}:
        errs.append("caller_rules keys: existing, new")
    for n in cfg.get('customers') or []:
        if not str(n).startswith('+'):
            errs.append("customers numbers must be E.164")
    pol = (cfg.get('emergency') or {}).get('policy')
    if pol not in ('transfer', 'text', 'email', 'message'):
        errs.append("emergency.policy must be transfer, text, email or message")
    if pol == 'email' and not ((cfg.get('notify') or {}).get('owner_email')):
        errs.append("emergency email needs an owner email (notify.owner_email)")
    if pol == 'text' and not ((cfg.get('notify') or {}).get('owner_sms')):
        errs.append("emergency text needs an owner mobile number (notify.owner_sms)")
    for f in cfg.get('faq') or []:
        if not (isinstance(f, dict) and str(f.get('q') or '').strip() and str(f.get('a') or '').strip()):
            errs.append("faq items need {q, a}")
    if len(json.dumps(cfg.get('faq') or [])) + len(cfg.get('business_info') or '') > 6000:
        errs.append("business_info + faq are too long for the prompt (6000 chars): move long material into the knowledge base (phone kb add)")
    b = cfg.get('booking') or {}
    if b.get('appointment_minutes') not in (15, 30, 60):
        errs.append("booking.appointment_minutes must be 15, 30 or 60")
    try:
        assert 0 <= int(b.get('buffer_minutes')) <= 120
    except Exception:
        errs.append("booking.buffer_minutes must be 0-120")
    try:
        assert 0 <= float(b.get('min_notice_hours')) <= 168
    except Exception:
        errs.append("booking.min_notice_hours must be 0-168")
    try:
        assert 1 <= int(b.get('days_ahead')) <= 180
    except Exception:
        errs.append("booking.days_ahead must be 1-180")
    bhh = b.get('booking_hours')
    if bhh is not None:
        for d, v in bhh.items():
            try:
                assert d in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') and (v is None or (len(v) == 2 and all(datetime.strptime(t, '%H:%M') for t in v) and v[0] < v[1]))
            except Exception:
                errs.append(f"booking.booking_hours.{d} must be null or [\"HH:MM\",\"HH:MM\"] with start before end")
    for c in b.get('blackout_dates') or []:
        try:
            for k in ([c] if isinstance(c, str) else [x for x in (c.get('date'), c.get('start'), c.get('end')) if x]):
                datetime.strptime(k, '%Y-%m-%d')
            assert isinstance(c, str) or c.get('date') or (c.get('start') and c.get('end'))
        except Exception:
            errs.append(f"blackout date {c!r} invalid: use \"YYYY-MM-DD\" or {{start,end}}")
    for k in (b.get('holidays') or {}).get('closed') or []:
        if k not in US_HOLIDAYS:
            errs.append(f"unknown holiday {k!r}; valid: {sorted(US_HOLIDAYS)}")
    if cfg.get('during_business_hours') not in ('answer', 'transfer'):
        errs.append("during_business_hours must be answer or transfer")
    if not isinstance((cfg.get('after_call') or {}).get('follow_ups', []), list):
        errs.append("after_call.follow_ups must be a list of plain-language instructions")
    return errs


def _flat(d, p=''):
    out = {}
    if isinstance(d, dict):
        for k, v in d.items():
            out.update(_flat(v, f'{p}{k}.'))
    else:
        out[p[:-1]] = json.dumps(d, ensure_ascii=False)[:120]
    return out


def config_diff(old, new):
    a, b = _flat(old or {}), _flat(new or {})
    return [f"{k}: {a.get(k, '-')} -> {b.get(k, '-')}" for k in sorted(set(a) | set(b)) if a.get(k) != b.get(k)]


HISTORY_PATH = os.path.join(PHONE_DIR, 'config-history.jsonl')


def _history():
    try:
        return [json.loads(l) for l in open(HISTORY_PATH) if l.strip()]
    except Exception:
        return []


def save_config(cfg, note=None, who='cli', kind='change'):
    os.makedirs(PHONE_DIR, exist_ok=True)
    old = None
    try:
        with open(CONFIG_PATH) as f:
            old = json.load(f)
    except Exception:
        pass
    tmp = CONFIG_PATH + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(cfg, f, indent=2)
    os.replace(tmp, CONFIG_PATH)
    if old is not None and old != cfg:
        h = _history()
        ent = {'id': len(h) + 1, 'ts': iso(), 'who': who, 'kind': kind, 'note': note, 'diff': config_diff(old, cfg)[:60], 'before': old, 'undone': False}
        with open(HISTORY_PATH, 'a') as f:
            f.write(json.dumps(ent) + '\n')


def history(n=10):
    return [{k: v for k, v in e.items() if k != 'before'} for e in _history()[-n:]]


def undo():
    """Restore the config as it was before the latest change that has not been undone. Returns (entry, diff) or None."""
    h = _history()
    for i in range(len(h) - 1, -1, -1):
        if h[i]['kind'] == 'change' and not h[i]['undone']:
            cur = load_config_raw()
            h[i]['undone'] = True
            tmp = CONFIG_PATH + '.tmp'
            with open(tmp, 'w') as f:
                json.dump(h[i]['before'], f, indent=2)
            os.replace(tmp, CONFIG_PATH)
            h.append({'id': len(h) + 1, 'ts': iso(), 'who': 'cli', 'kind': 'undo', 'note': f'undo of change {h[i]["id"]}', 'diff': config_diff(cur, h[i]['before'])[:60], 'before': cur, 'undone': False})
            with open(HISTORY_PATH, 'w') as f:
                f.write(''.join(json.dumps(e) + '\n' for e in h))
            return h[i], config_diff(cur, h[i]['before'])
    return None


def load_config_raw():
    try:
        return json.load(open(CONFIG_PATH))
    except Exception:
        return {}


def _dt(s):
    return datetime.fromisoformat(s) if s else None


def effective_config(cfg, now=None):
    """Apply overrides active right now (deterministic; expiry is just a timestamp comparison). Returns (cfg, [active overrides])."""
    now = now or datetime.now(timezone.utc)
    out, active = cfg, []
    for o in cfg.get('overrides') or []:
        f, u = _dt(o.get('from')), _dt(o.get('until'))
        if (f is None or now >= f) and (u is None or now < u):
            out = _merge(out, o.get('set') or {}); active.append(o)
    return out, active


def previous_caller(caller):
    """Latest earlier call from this caller ID (for returning-caller recognition). Code only; the agent must still confirm."""
    if not caller:
        return None
    try:
        r = db().execute("SELECT id, started_at, caller_name, callback_number, fields, status FROM calls WHERE caller=? AND status NOT IN ('spam') "
                         "AND caller_name IS NOT NULL ORDER BY started_at DESC LIMIT 1", (caller,)).fetchone()
        n = db().execute("SELECT COUNT(*) FROM calls WHERE caller=? AND status NOT IN ('spam')", (caller,)).fetchone()[0]
    except Exception:
        return None
    return {**dict(r), 'calls': n} if r else None


def is_existing_customer(cfg, caller):
    return bool(caller) and (caller in (cfg.get('customers') or []) or previous_caller(caller) is not None)


def resolve_when(spec, cfg, role='from', now=None):
    """Deterministic time words -> ISO with the business-timezone offset. spec: 'now' | 'tomorrow' | 'monday'..'sunday' (that day, at opening time
    for 'until', midnight for 'from') | 'next-open' (when business hours next start) | 'YYYY-MM-DD' | 'YYYY-MM-DD HH:MM'."""
    tz = ZoneInfo(cfg.get('timezone') or 'America/New_York'); n = (now or datetime.now(timezone.utc)).astimezone(tz)
    sp = (spec or '').strip().lower()
    days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    keys = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')

    def open_time(d):
        span = (cfg.get('business_hours') or {}).get(keys[d.weekday()]) or ['09:00', '17:00']
        return datetime.combine(d, datetime.strptime(span[0], '%H:%M').time(), tz)
    if sp == 'now':
        return n.isoformat()
    if sp == 'tomorrow':
        d = (n + timedelta(days=1)).date()
        return (datetime.combine(d, datetime.min.time(), tz) if role == 'from' else open_time(d)).isoformat()
    if sp in days:
        d = n.date() + timedelta(days=(days.index(sp) - n.weekday()) % 7 or 7)
        return (datetime.combine(d, datetime.min.time(), tz) if role == 'from' else open_time(d)).isoformat()
    if sp == 'next-open':
        for i in range(0, 15):
            d = (n + timedelta(days=i)).date()
            t = open_time(d)
            span = (cfg.get('business_hours') or {}).get(keys[d.weekday()])
            if span and not (closure_today(cfg, t) and not closure_today(cfg, t).get('hours')) and not booking_blocked(cfg, d) and t > n:
                return t.isoformat()
    for fmt in ('%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            t = datetime.strptime(spec.strip(), fmt)
            if fmt == '%Y-%m-%d' and role == 'until':
                t = datetime.combine(t.date(), datetime.min.time()) + timedelta(hours=0)
            return t.replace(tzinfo=tz).isoformat()
        except ValueError:
            pass
    raise ValueError(f"can't read time {spec!r}: use now, tomorrow, a weekday name, next-open, YYYY-MM-DD or 'YYYY-MM-DD HH:MM' (business timezone)")


US_HOLIDAYS = {"new_year": "New Year's Day", "mlk": "Martin Luther King Jr. Day", "presidents": "Presidents' Day", "memorial": "Memorial Day",
               "juneteenth": "Juneteenth", "independence": "Independence Day", "labor": "Labor Day", "columbus": "Columbus Day",
               "veterans": "Veterans Day", "thanksgiving": "Thanksgiving", "christmas": "Christmas Day"}


def _nth_weekday(y, m, wd, n):
    d = datetime(y, m, 1).date()
    d += timedelta(days=(wd - d.weekday()) % 7)
    return d + timedelta(weeks=n - 1)


def us_holidays(year):
    """US federal holidays for a year: {key: date}. Fixed-date ones use their actual calendar date."""
    from datetime import date
    last_mon_may = max(d for d in (date(year, 5, i) for i in range(25, 32)) if d.weekday() == 0)
    return {"new_year": date(year, 1, 1), "mlk": _nth_weekday(year, 1, 0, 3), "presidents": _nth_weekday(year, 2, 0, 3), "memorial": last_mon_may,
            "juneteenth": date(year, 6, 19), "independence": date(year, 7, 4), "labor": _nth_weekday(year, 9, 0, 1),
            "columbus": _nth_weekday(year, 10, 0, 2), "veterans": date(year, 11, 11), "thanksgiving": _nth_weekday(year, 11, 3, 4),
            "christmas": date(year, 12, 25)}


def booking_blocked(cfg, day):
    """Why a date can't be booked (None if it can): owner closure, blackout date, or a US holiday marked closed."""
    d = day.strftime('%Y-%m-%d')
    for c in cfg.get('closures') or []:
        lo, hi = (c.get('date') or c.get('start')), (c.get('date') or c.get('end'))
        if lo <= d <= hi and not c.get('hours'):
            return c.get('name') or 'closed'
    for c in (cfg.get('booking') or {}).get('blackout_dates') or []:
        lo, hi = (c, c) if isinstance(c, str) else ((c.get('date') or c.get('start')), (c.get('date') or c.get('end')))
        if lo <= d <= hi:
            return (c.get('name') if isinstance(c, dict) else None) or 'blackout date'
    closed = set(((cfg.get('booking') or {}).get('holidays') or {}).get('closed') or [])
    for k, hd in us_holidays(day.year).items():
        if k in closed and hd == day:
            return US_HOLIDAYS[k]
    return None


def closure_today(cfg, now=None):
    tz = ZoneInfo(cfg.get('timezone') or 'America/New_York')
    d = (now or datetime.now(timezone.utc)).astimezone(tz).strftime('%Y-%m-%d')
    for c in cfg.get('closures') or []:
        lo, hi = (c.get('date') or c.get('start')), (c.get('date') or c.get('end'))
        if lo <= d <= hi:
            return c
    why = booking_blocked(cfg, datetime.strptime(d, '%Y-%m-%d').date())      # blackout day off or a US holiday marked closed: closed all day
    if why:
        return {'date': d, 'name': why, 'source': 'holiday_or_blackout'}
    return None


def next_open_day(cfg, now=None):
    """Plain description of when business hours next start (skips weekends, closures, blackout dates and closed US holidays,
    same days booking refuses). Includes later today if today's hours haven't started yet."""
    tz = ZoneInfo(cfg.get('timezone') or 'America/New_York')
    base = (now or datetime.now(timezone.utc)).astimezone(tz)
    for i in range(0, 15):
        d = base + timedelta(days=i)
        if (closure_today(cfg, d) and not closure_today(cfg, d).get('hours')) or booking_blocked(cfg, d.date()):
            continue      # same closed days as booking: owner closures, blackout dates, US holidays marked closed
        span = (closure_today(cfg, d) or {}).get('hours') or (cfg.get('business_hours') or {}).get(('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')[d.weekday()])
        if span:
            st = d.replace(hour=int(span[0][:2]), minute=int(span[0][3:5]), second=0, microsecond=0)
            if st <= base:
                continue
            return f"{'today' if i == 0 else d.strftime('%A %B %-d')} at {st.strftime('%-I:%M %p')}"
    return None

def is_business_hours(cfg, now=None):
    tz = ZoneInfo(cfg.get('timezone') or 'America/New_York')
    now = (now or datetime.now(timezone.utc)).astimezone(tz)
    c = closure_today(cfg, now)
    if c is not None:
        span = c.get('hours')
    else:
        span = (cfg.get('business_hours') or {}).get(('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')[now.weekday()])
    if not span:
        return False
    hm = now.strftime('%H:%M')
    return span[0] <= hm < span[1]


SCHEMA = '''CREATE TABLE IF NOT EXISTS calls(
 id TEXT PRIMARY KEY, room TEXT, started_at TEXT, ended_at TEXT, duration_s INTEGER,
 caller TEXT, called TEXT, after_hours INTEGER, caller_name TEXT, callback_number TEXT,
 message TEXT, urgency TEXT, appointment TEXT, transfer TEXT, summary TEXT, transcript TEXT,
 status TEXT, followup_run_id TEXT, handled_at TEXT, handled_note TEXT, cost_note TEXT)'''


def db():
    os.makedirs(PHONE_DIR, exist_ok=True)
    c = sqlite3.connect(CALLS_DB, timeout=30, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA journal_mode=WAL')
    c.execute(SCHEMA)
    have = {r[1] for r in c.execute('PRAGMA table_info(calls)')}
    for col in ('intent', 'fields', 'alerts', 'spam'):
        if col not in have:
            try:
                c.execute(f'ALTER TABLE calls ADD COLUMN {col} TEXT')
            except sqlite3.OperationalError:
                pass
    return c


def iso(dt=None):
    return (dt or datetime.now(timezone.utc)).strftime('%Y-%m-%dT%H:%M:%SZ')


def new_call_id():
    return 'call_' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S') + '_' + uuid.uuid4().hex[:6]


HOLDS_SCHEMA = """CREATE TABLE IF NOT EXISTS slot_holds(
 calendar TEXT, slot_start TEXT, slot_end TEXT, call_id TEXT, status TEXT, expires_at REAL, event_id TEXT,
 PRIMARY KEY(calendar, slot_start))"""


def hold_slot(calendar, start_iso, end_iso, call_id, ttl_s):
    """Atomic slot hold: one caller per slot. Returns True if this call holds it."""
    c = db(); c.execute(HOLDS_SCHEMA)
    c.execute('BEGIN IMMEDIATE')
    try:
        now = time.time()
        c.execute("DELETE FROM slot_holds WHERE expires_at < ?", (now,))   # booked rows only shield the Outlook-lag window; the calendar is the source of truth
        clash = c.execute("SELECT call_id FROM slot_holds WHERE calendar=? AND slot_start < ? AND slot_end > ? AND call_id != ?",
                          (calendar, end_iso, start_iso, call_id)).fetchone()
        if clash:
            c.execute('ROLLBACK'); return False
        c.execute("INSERT OR REPLACE INTO slot_holds VALUES (?,?,?,?,?,?,?)", (calendar, start_iso, end_iso, call_id, 'held', now + ttl_s, None))
        c.execute('COMMIT'); return True
    except Exception:
        c.execute('ROLLBACK'); raise


def held_by_others(calendar, call_id):
    c = db(); c.execute(HOLDS_SCHEMA)
    return [(r[0], r[1]) for r in c.execute("SELECT slot_start, slot_end FROM slot_holds WHERE calendar=? AND call_id != ? AND expires_at > ?",
                                             (calendar, call_id, time.time()))]


def set_hold(calendar, start_iso, call_id, status, event_id=None):
    c = db(); c.execute(HOLDS_SCHEMA)
    if status == 'released':
        c.execute("DELETE FROM slot_holds WHERE calendar=? AND slot_start=? AND call_id=?", (calendar, start_iso, call_id))
    else:
        c.execute("UPDATE slot_holds SET status=?, event_id=?, expires_at=? WHERE calendar=? AND slot_start=? AND call_id=?",
                  (status, event_id, time.time() + (600 if status == 'booked' else 0), calendar, start_iso, call_id))


# ---------------- knowledge base (long documents): local SQLite FTS5, zero cost, no network on the call's hot path ----------------
KB_DB = os.path.join(PHONE_DIR, 'kb.db')


def kb():
    os.makedirs(PHONE_DIR, exist_ok=True)
    c = sqlite3.connect(KB_DB, timeout=30, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(title, body, tokenize='porter unicode61')")
    c.execute("CREATE TABLE IF NOT EXISTS docs(title TEXT PRIMARY KEY, added_at TEXT, chars INTEGER, chunks INTEGER)")
    return c


def _chunks(text, size=900, overlap=150):
    text = ' '.join(text.split()) if '\n' not in text else text
    paras = [p.strip() for p in text.replace('\r', '').split('\n\n') if p.strip()]
    out, cur = [], ''
    for p in paras:
        while len(p) > size:                       # long paragraph: split at a sentence-ish boundary
            cut = p.rfind('. ', 0, size)
            cut = cut + 1 if cut > size // 2 else size
            if cur:
                out.append(cur); cur = ''
            out.append(p[:cut].strip()); p = p[max(cut - overlap, 1):].strip() if len(p) - cut > overlap else p[cut:].strip()
        if len(cur) + len(p) + 2 > size and cur:
            out.append(cur); cur = ''
        cur = (cur + '\n\n' + p).strip()
    if cur:
        out.append(cur)
    return [c for c in out if c.strip()]


def kb_add(title, text):
    c = kb(); title = title.strip()
    c.execute('BEGIN')
    c.execute('DELETE FROM chunks WHERE title=?', (title,))
    ch = _chunks(text)
    for x in ch:
        c.execute('INSERT INTO chunks(title, body) VALUES (?,?)', (title, x))
    c.execute('INSERT OR REPLACE INTO docs VALUES (?,?,?,?)', (title, iso(), len(text), len(ch)))
    c.execute('COMMIT')
    return len(ch)


def kb_rm(title):
    c = kb(); c.execute('DELETE FROM chunks WHERE title=?', (title,))
    return c.execute('DELETE FROM docs WHERE title=?', (title,)).rowcount


def kb_list():
    return [dict(r) for r in kb().execute('SELECT * FROM docs ORDER BY added_at')]


def kb_search(query, k=3):
    """BM25 over chunks. `query` is a list/space-separated set of terms written by the model (synonyms welcome); OR-matched."""
    terms = [t for t in ''.join(ch if ch.isalnum() else ' ' for ch in query).split() if len(t) > 1][:24]
    if not terms:
        return []
    q = ' OR '.join(f'"{t}"' for t in terms)
    try:
        rows = kb().execute("SELECT title, body, bm25(chunks) r FROM chunks WHERE chunks MATCH ? ORDER BY r LIMIT ?", (q, k)).fetchall()
    except sqlite3.OperationalError:
        return []
    return [{'title': r['title'], 'text': r['body']} for r in rows]
