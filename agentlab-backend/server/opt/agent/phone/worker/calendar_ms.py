"""Live booking against Microsoft 365 (Graph) through the AgentLab connector broker, with slot holds so two
concurrent callers cannot take the same slot: free/busy -> hold (DB lock, TTL) -> re-check -> create -> re-check."""
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import httpx
from worker import store

BROKER = 'http://127.0.0.1:6081'


async def graph(method, path, query=None, body=None, tz=None):
    """Graph call via the broker. Retries Microsoft throttling (429/503/504) with short backoff (POSTs carry a transactionId, so retries can't double-book)."""
    import asyncio
    hdr = {'Prefer': f'outlook.timezone="{tz}"'} if tz else {}
    delay = 1.0
    for attempt in range(4):
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f'{BROKER}/call/microsoft', json={'method': method, 'path': path, 'query': query, 'body': body, 'headers': hdr})
            j = r.json()
        if r.status_code != 200:
            raise RuntimeError(j.get('error') or 'calendar not connected')
        if j['status'] in (429, 503, 504) and attempt < 3:
            await asyncio.sleep(delay); delay *= 2
            continue
        return j['status'], j['data']


async def connected():
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            return bool((await c.get(f'{BROKER}/status')).json().get('microsoft', {}).get('connected'))
    except Exception:
        return False


def _cal_path(cfg):
    cid = (cfg.get('booking') or {}).get('calendar_id')
    return f'/me/calendars/{cid}' if cid else '/me'


async def busy(cfg, start, end):
    tz = cfg['timezone']
    st, d = await graph('GET', f"{_cal_path(cfg)}/calendarView",
                        {'startDateTime': start.isoformat(), 'endDateTime': end.isoformat(), '$select': 'id,subject,start,end,showAs,isCancelled', '$top': '200'}, tz=tz)
    if st != 200:
        raise RuntimeError(f'calendar read failed ({st})')
    out = []
    for e in d.get('value', []):
        if e.get('isCancelled') or e.get('showAs') == 'free':
            continue
        s = datetime.fromisoformat(e['start']['dateTime'][:19]).replace(tzinfo=ZoneInfo(tz))
        en = datetime.fromisoformat(e['end']['dateTime'][:19]).replace(tzinfo=ZoneInfo(tz))
        out.append((s, en, e['id']))
    return out


def _windows(cfg, day):
    if store.booking_blocked(cfg, day):
        return None
    hours = (cfg['booking'].get('booking_hours') or cfg['business_hours'])
    span = hours.get(('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')[day.weekday()])
    if not span:
        return None
    tz = ZoneInfo(cfg['timezone'])
    a = datetime.combine(day, datetime.strptime(span[0], '%H:%M').time(), tz)
    b = datetime.combine(day, datetime.strptime(span[1], '%H:%M').time(), tz)
    return a, b


async def free_slots(cfg, from_date, to_date, call_id, limit=6, after_time='', before_time='', spread_min=45):
    b = cfg['booking']; tz = ZoneInfo(cfg['timezone'])
    dur = timedelta(minutes=int(b['appointment_minutes'])); buf = timedelta(minutes=int(b.get('buffer_minutes') or 0))
    now = datetime.now(tz); earliest = now + timedelta(hours=float(b.get('min_notice_hours') or 0))
    d0 = datetime.strptime(from_date, '%Y-%m-%d').date(); d1 = datetime.strptime(to_date or from_date, '%Y-%m-%d').date()
    d1 = min(d1, (now + timedelta(days=int(b['days_ahead']))).date())
    if d1 < d0:
        return []
    start = datetime.combine(d0, datetime.min.time(), tz); end = datetime.combine(d1 + timedelta(days=1), datetime.min.time(), tz)
    events = await busy(cfg, start, end)
    holds = [(datetime.fromisoformat(s), datetime.fromisoformat(e)) for s, e in store.held_by_others(_cal_path(cfg), call_id)]
    out = []
    day = d0
    while day <= d1 and len(out) < limit:
        w = _windows(cfg, day)
        if w:
            t = w[0]
            while t + dur <= w[1] and len(out) < limit:
                tl = t.strftime('%H:%M')
                if after_time and tl < after_time or before_time and tl >= before_time:
                    t += timedelta(minutes=15); continue
                if out and out[-1].date() == t.date() and t - out[-1] < timedelta(minutes=spread_min):
                    t += timedelta(minutes=15); continue   # spread offers across the day, not 3 slots in a row
                if t >= earliest and not any(s < t + dur + buf and e > t - buf for s, e, *_ in events) and not any(s < t + dur and e > t for s, e in holds):
                    out.append(t)
                t += timedelta(minutes=15 if dur >= timedelta(minutes=15) else int(dur.total_seconds() // 60))
        day += timedelta(days=1)
    return out


async def hold_and_book(cfg, slot_iso, call_id, caller_name, callback_number, email, topic):
    b = cfg['booking']; tz = ZoneInfo(cfg['timezone'])
    s = datetime.fromisoformat(slot_iso)
    s = s.replace(tzinfo=tz) if s.tzinfo is None else s.astimezone(tz)
    e = s + timedelta(minutes=int(b['appointment_minutes']))
    cal = _cal_path(cfg)
    w = _windows(cfg, s.date()); now = datetime.now(tz)
    if not w or s < w[0] or e > w[1] or s < now + timedelta(hours=float(b.get('min_notice_hours') or 0)) or s > now + timedelta(days=int(b['days_ahead'])):
        return {'ok': False, 'reason': 'That time is outside booking hours, on a closed day, or too soon. Offer one of the times from check_availability.'}
    # 1) hold: one caller per slot, short TTL
    if not store.hold_slot(cal, s.isoformat(), e.isoformat(), call_id, int(b.get('slot_hold_minutes') or 5) * 60):
        return {'ok': False, 'reason': 'Another caller is booking that time right now. Offer the next free time.'}
    try:
        # 2) live re-check before writing
        if any(bs < e and be > s for bs, be, *_ in await busy(cfg, s, e)):
            store.set_hold(cal, s.isoformat(), call_id, 'released')
            return {'ok': False, 'reason': 'That time was just taken. Offer another free time.'}
        body = {'subject': b['title'].format(caller_name=caller_name or 'caller'),
                'body': {'contentType': 'text', 'content': f'Booked by the AgentLab phone agent.\nCaller: {caller_name}\nPhone: {callback_number}\nEmail: {email}\nAbout: {topic}'},
                'start': {'dateTime': s.strftime('%Y-%m-%dT%H:%M:%S'), 'timeZone': cfg['timezone']},
                'end': {'dateTime': e.strftime('%Y-%m-%dT%H:%M:%S'), 'timeZone': cfg['timezone']},
                'transactionId': f'{call_id}-{s.strftime("%Y%m%d%H%M")}', 'showAs': 'busy'}
        if email and not re.search(r'@([\w.-]+\.)?(example\.(com|org|net)|[\w-]+\.(test|invalid|example|localhost))$', email.strip().lower()):   # no invites to reserved test domains
            body['attendees'] = [{'emailAddress': {'address': email, 'name': caller_name or email}, 'type': 'required'}]
        st, ev = await graph('POST', f'{cal}/events', body=body)
        if st not in (200, 201):
            store.set_hold(cal, s.isoformat(), call_id, 'released')
            return {'ok': False, 'reason': f'Calendar write failed ({st}). Take a booking request instead.'}
        # 3) post-write conflict check: if someone else landed in the same slot, back ours out
        others = [x for x in await busy(cfg, s, e) if x[2] != ev['id'] and x[0] < e and x[1] > s]   # calendarView also returns events that only touch the edges
        if others:
            await graph('DELETE', f"/me/events/{ev['id']}")
            store.set_hold(cal, s.isoformat(), call_id, 'released')
            return {'ok': False, 'reason': 'That time was just taken. Offer another free time.'}
        store.set_hold(cal, s.isoformat(), call_id, 'booked', ev['id'])
        # 4) read-back: never tell the caller "booked" until the event is independently visible
        vr = await verify_readback(cfg, ev['id'], s, e, max_s=12)
        return {'ok': True, 'event_id': ev['id'], 'start': s.isoformat(), 'end': e.isoformat(), 'verified': bool(vr.get('verified')),
                'readback': vr, 'spoken': spoken(cfg, s), '_s': s, '_e': e}
    except Exception as ex:
        store.set_hold(cal, s.isoformat(), call_id, 'released')
        return {'ok': False, 'reason': f'Calendar error: {str(ex)[:120]}. Take a booking request instead.'}


async def verify_readback(cfg, event_id, s, e, max_s=12, tries_log=None):
    """Independent read-back: GET event by id AND find it in calendarView for its window, retrying with backoff
    (Outlook can lag). Returns evidence dict; verified only when BOTH reads see the event with the right times."""
    import asyncio, time
    tz = cfg['timezone']; cal = _cal_path(cfg)
    t0 = time.time(); delay = 1.0; ev = {'checks': []}
    got_id = got_view = False
    while True:
        rec = {'t': round(time.time() - t0, 1)}
        try:
            st, d = await graph('GET', f'/me/events/{event_id}', query={'$select': 'id,subject,start,end,isCancelled'}, tz=tz)
            got_id = st == 200 and d.get('id') == event_id and not d.get('isCancelled') and (d.get('start') or {}).get('dateTime', '')[:16] == s.strftime('%Y-%m-%dT%H:%M')
            rec['get_by_id'] = st if not got_id else 'ok'
        except Exception as x:
            rec['get_by_id'] = f'err {str(x)[:60]}'
        try:
            st, d = await graph('GET', f'{cal}/calendarView', query={'startDateTime': (s - timedelta(minutes=1)).isoformat(),
                                'endDateTime': (e + timedelta(minutes=1)).isoformat(), '$select': 'id,subject,start,end'}, tz=tz)
            got_view = st == 200 and any(x.get('id') == event_id for x in (d.get('value') or []))
            rec['calendarView'] = st if not got_view else 'ok'
        except Exception as x:
            rec['calendarView'] = f'err {str(x)[:60]}'
        ev['checks'].append(rec)
        if got_id and got_view:
            ev['verified'] = True; break
        if time.time() - t0 + delay > max_s:
            ev['verified'] = False; break
        await asyncio.sleep(delay); delay = min(delay * 2, 16)
    ev['seconds'] = round(time.time() - t0, 1)
    return ev


# ---- deterministic request resolution + spoken labels (no LLM arithmetic anywhere) ----
PART_OF_DAY = {'morning': ('06:00', '12:00'), 'afternoon': ('12:00', '17:00'), 'evening': ('17:00', '21:00'), 'any': ('', '')}
TZ_SPOKEN = {'America/New_York': 'Eastern', 'America/Chicago': 'Central', 'America/Denver': 'Mountain', 'America/Phoenix': 'Mountain',
             'America/Los_Angeles': 'Pacific', 'America/Anchorage': 'Alaska', 'Pacific/Honolulu': 'Hawaii'}
WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']


def _hhmm(v):
    v = (v or '').strip()
    if not v:
        return ''
    datetime.strptime(v, '%H:%M')
    return v


def resolve_day(cfg, day='', date='', now=None):
    """Structured day -> a date in the business timezone. day: today|tomorrow|monday..sunday (next one, today counts) ; date: YYYY-MM-DD wins."""
    tz = ZoneInfo(cfg['timezone']); today = (now or datetime.now(tz)).astimezone(tz).date()
    if date:
        return datetime.strptime(date.strip(), '%Y-%m-%d').date()
    d = (day or 'today').strip().lower()
    if d == 'today':
        return today
    if d == 'tomorrow':
        return today + timedelta(days=1)
    if d in WEEKDAYS:
        return today + timedelta(days=(WEEKDAYS.index(d) - today.weekday()) % 7)
    raise ValueError(f'unknown day {day!r}')


def spoken(cfg, t):
    """'Thursday November 26 at 1:30 PM Eastern' in the business timezone."""
    t = t.astimezone(ZoneInfo(cfg['timezone']))
    return t.strftime('%A %B %-d at %-I:%M %p ') + TZ_SPOKEN.get(cfg['timezone'], t.strftime('%Z'))


async def find_slots(cfg, call_id, day='', date='', part_of_day='any', not_before='', not_after='', limit=3):
    """Returns (note, [datetime]). Searches the requested day first; if nothing, the next open days (code decides, not the model)."""
    d = resolve_day(cfg, day, date)
    pod = PART_OF_DAY.get((part_of_day or 'any').lower())
    if pod is None:
        raise ValueError(f'unknown part_of_day {part_of_day!r}')
    after = _hhmm(not_before) or pod[0]; before = _hhmm(not_after) or pod[1]
    blocked = store.booking_blocked(cfg, d)
    sl = await free_slots(cfg, d.isoformat(), d.isoformat(), call_id, limit=limit, after_time=after, before_time=before)
    if sl:
        return f'Free on {d.strftime("%A %B %-d")}:', sl
    why = f' ({blocked})' if blocked else ''
    # nothing that day/window: next days with the same time-of-day window, then any time
    tz = ZoneInfo(cfg['timezone']); horizon = (datetime.now(tz) + timedelta(days=int(cfg['booking']['days_ahead']))).date()
    for a2, b2, label in ((after, before, 'same time of day'), ('', '', 'any time')):
        nxt = await free_slots(cfg, (d + timedelta(days=1)).isoformat(), min(d + timedelta(days=14), horizon).isoformat(), call_id, limit=limit, after_time=a2, before_time=b2, spread_min=45)
        if nxt:
            return f'Nothing open on {d.strftime("%A %B %-d")} at that time{why}. Next available ({label}):', nxt
    return f'Nothing open on {d.strftime("%A %B %-d")}{why} or in the next two weeks.', []
