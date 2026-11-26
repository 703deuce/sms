"""Owner-opt-in extras for the phone line: website watch (G), quality review (H), outcomes briefing (I), proposals / self-tuning (J).
Everything is plain code over the real logs; nothing here runs on a timer. Schedules are AgentLab routines the owner asked for."""
import hashlib, json, os, re, difflib, urllib.request, urllib.parse
from collections import Counter
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

import store

EXTRAS = os.path.join(store.PHONE_DIR, 'extras.json')
WATCH_DIR = os.path.join(store.PHONE_DIR, 'watch')


def _load():
    try:
        with open(EXTRAS) as f:
            d = json.load(f)
    except Exception:
        d = {}
    d.setdefault('watch', {'enabled': False, 'urls': []})
    d.setdefault('briefing', {'enabled': False, 'at': '08:00'})
    d.setdefault('proposals', [])
    return d


def _save(d):
    os.makedirs(store.PHONE_DIR, exist_ok=True)
    tmp = EXTRAS + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(d, f, indent=1)
    os.replace(tmp, EXTRAS)


# ---------------------------------------------------------------- G) website watch
class _Text(HTMLParser):
    SKIP = {'script', 'style', 'noscript', 'svg', 'head', 'nav', 'footer'}

    def __init__(self):
        super().__init__(); self.out = []; self.skip = 0

    def handle_starttag(self, t, a):
        if t in self.SKIP:
            self.skip += 1
        if t in ('p', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'tr', 'div', 'section'):
            self.out.append('\n')

    def handle_endtag(self, t):
        if t in self.SKIP and self.skip:
            self.skip -= 1

    def handle_data(self, d):
        if not self.skip and d.strip():
            self.out.append(d.strip() + ' ')


def fetch_text(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'AgentLab-SiteWatch/1.0 (owner-enabled; low frequency)'})
    with urllib.request.urlopen(req, timeout=15) as r:
        raw = r.read(1_500_000).decode(r.headers.get_content_charset() or 'utf-8', 'replace')
    p = _Text(); p.feed(raw)
    lines = [re.sub(r'\s+', ' ', x).strip() for x in ''.join(p.out).split('\n')]
    return '\n'.join(x for x in lines if len(x) > 2)


def watch(a, say):
    d = _load(); w = d['watch']; sub = a.arg
    if sub == 'enable':
        w['enabled'] = True; _save(d)
        say('Website watch is ON. It only runs when you (or a routine you asked for) run `phone watch check`. For a schedule, create a low-frequency routine, e.g. weekly: '
            'routine add --cron "0 9 * * 1" --script <script that runs `phone watch check --quiet`> --then run "propose KB/FAQ updates from the site changes". Nothing is scheduled by this command.')
    elif sub == 'disable':
        w['enabled'] = False; _save(d); say('Website watch is OFF (remove any routine you created for it).')
    elif sub == 'add' and a.arg2:
        u = a.arg2 if a.arg2.startswith('http') else 'https://' + a.arg2
        if not urllib.parse.urlparse(u).netloc:
            raise SystemExit('Give a full site URL.')
        if any(x['url'] == u for x in w['urls']):
            raise SystemExit('Already watching that URL.')
        w['urls'].append({'url': u, 'every_days': max(1, int(a.every or 7)), 'last_checked': None, 'hash': None})
        _save(d); say(f'Watching {u} every {a.every or 7} days (once enabled with `phone watch enable`).')
    elif sub == 'rm' and a.arg2:
        w['urls'] = [x for x in w['urls'] if x['url'] != a.arg2]; _save(d); say('Removed.')
    elif sub == 'list' or not sub:
        say(f"Website watch: {'ON' if w['enabled'] else 'OFF'}")
        for x in w['urls']:
            say(f"  {x['url']}  every {x['every_days']} days  last checked {x['last_checked'] or 'never'}")
    elif sub == 'check':
        if not w['enabled']:
            if not a.quiet:
                say('Website watch is OFF. The owner has to turn it on first (phone watch enable).')
            return
        os.makedirs(WATCH_DIR, exist_ok=True); changed = False
        for x in w['urls']:
            now = datetime.now(timezone.utc)
            if x['last_checked'] and not a.force and now - datetime.fromisoformat(x['last_checked']) < timedelta(days=x['every_days']) - timedelta(hours=1):
                continue
            key = hashlib.sha1(x['url'].encode()).hexdigest()[:10]; path = os.path.join(WATCH_DIR, key + '.txt')
            try:
                new = fetch_text(x['url'])
            except Exception as e:
                say(f"[{x['url']}] could not fetch: {e}"); continue
            x['last_checked'] = now.isoformat()
            h = hashlib.sha1(new.encode()).hexdigest()
            old = open(path).read() if os.path.exists(path) else None
            open(path, 'w').write(new)
            if old is None:
                x['hash'] = h; say(f"[{x['url']}] baseline saved ({len(new)} chars). Future checks report changes."); continue
            if h == x['hash']:
                if not a.quiet:
                    say(f"[{x['url']}] no change.")
                continue
            x['hash'] = h; changed = True
            diff = [l for l in difflib.unified_diff(old.split('\n'), new.split('\n'), lineterm='', n=0) if not l.startswith(('---', '+++', '@@'))]
            say(f"[{x['url']}] CHANGED: {sum(1 for l in diff if l[0]=='+')} lines added, {sum(1 for l in diff if l[0]=='-')} removed. Diff (first 60):")
            for l in diff[:60]:
                say('  ' + l[:300])
            say('Next: decide which of these should be a FAQ/KB/info update and file each with `phone proposal add ... --why "site changed: ..."`. Do not apply anything without the owner approving.')
        _save(d)
    else:
        raise SystemExit('usage: phone watch enable|disable|add <url> [--every DAYS]|rm <url>|list|check [--force] [--quiet]')


# ---------------------------------------------------------------- calls helpers
def _calls(days):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
    out = []
    for r in store.db().execute('SELECT * FROM calls WHERE started_at >= ? ORDER BY started_at', (since,)):
        r = dict(r)
        for k in ('appointment', 'transfer', 'cost_note', 'alerts', 'fields', 'transcript'):
            try:
                r[k] = json.loads(r[k]) if r.get(k) else None
            except Exception:
                r[k] = None
        out.append(r)
    return [c for c in out if c['id'] != 'call_seed_prior']


def _bookings(c):
    return (c.get('appointment') or {}).get('bookings') or []


def _spam(c):
    return bool(c.get('spam'))


# ---------------------------------------------------------------- H) quality review
def review(a, say):
    days = int(a.days or 30); cs = _calls(days)
    say(f'QUALITY REVIEW EVIDENCE, last {days} days, {len(cs)} calls (computed from the call log; you write the recommendations, the owner approves any change)')
    if not cs:
        return
    real = [c for c in cs if not _spam(c)]
    abandoned = [c for c in real if (c.get('cost_note') or {}).get('incomplete_missing')]
    failed = [(c, b) for c in real for b in _bookings(c) if not b.get('ok') or not b.get('verified')]
    wanted_no_book = [c for c in real if (c.get('appointment') or {}).get('wanted') and not any(b.get('ok') for b in _bookings(c)) and not (c.get('appointment') or {}).get('texts') and (c.get('cost_note') or {}).get('booking_mode', 'live') == 'live']
    transfers = [c for c in real if c.get('transfer')]
    unneeded = [c for c in transfers if (c.get('urgency') or '') not in ('urgent', 'high', 'emergency') and 'urgent' not in json.dumps(c['transfer']).lower()]
    unanswered = []
    for c in real:
        for l in (c.get('cost_note') or {}).get('kb_lookups') or []:
            if not l.get('hits'):
                unanswered.append((c, l['q']))
        for t in c.get('transcript') or []:
            if t.get('role') == 'assistant' and re.search(r"(don't|do not) (have|know) (that|the) (information|answer)|not sure|I can('| no)t say", t.get('text', ''), re.I):
                unanswered.append((c, '(agent unsure) ' + t['text'].strip()[:160])); break
    say(f"- Calls: {len(cs)} total, {len(cs)-len(real)} spam, {len(abandoned)} abandoned/incomplete, {len(transfers)} transfers ({len(unneeded)} without an urgent reason), bookings made: {sum(1 for c in real for b in _bookings(c) if b.get('ok'))}, failed or unverified bookings: {len(failed)}, wanted-to-book-but-not-booked: {len(wanted_no_book)}")
    for c in abandoned[:8]:
        say(f"  ABANDONED {c['id']} ({c['duration_s']}s) missing {(c['cost_note'] or {}).get('incomplete_missing')}")
    for c, b in failed[:8]:
        say(f"  FAILED BOOKING {c['id']}: {json.dumps({k: b.get(k) for k in ('ok','verified','error','spoken')})}")
    for c in wanted_no_book[:8]:
        say(f"  WANTED BOOKING, NONE MADE {c['id']}: {(c.get('summary') or '')[:200]}")
    for c in unneeded[:8]:
        say(f"  TRANSFER WITHOUT URGENCY {c['id']}: {(c['transfer'] or {}).get('reason')}")
    for c, q in unanswered[:12]:
        say(f"  UNANSWERED {c['id']}: {q}")
    # wrong-capture signals: details contradict each other or repeated correction in the transcript
    for c in real:
        n = sum(1 for t in c.get('transcript') or [] if t.get('role') == 'caller' and re.search(r"\b(no,? that'?s (not|wrong)|not right|incorrect|I said|spelled|that is wrong|sorry,? it'?s)\b", t.get('text', ''), re.I))
        if n >= 2:
            say(f"  POSSIBLE WRONG CAPTURE {c['id']}: caller corrected the agent {n} times (name={c.get('caller_name')}, callback={c.get('callback_number')}); read: phone call {c['id']}")
    services = Counter()
    for c in real:
        k = (c.get('intent') or '').strip() or ((c.get('appointment') or {}).get('topic') or '').strip().lower()
        if k and k != 'other':
            services[k[:60]] += 1
    say('- Top requested (intent/topic): ' + (', '.join(f'{k} x{v}' for k, v in services.most_common(8)) or 'n/a'))
    lat = [t for c in real for t in ((c.get('cost_note') or {}).get('latency') or {}).get('turn_s') or []]
    if lat:
        lat.sort(); say(f"- Turn latency over these calls: p50 {lat[len(lat)//2]:.2f}s, p95 {lat[min(len(lat)-1,int(len(lat)*.95))]:.2f}s ({len(lat)} turns)")
    say('Now: write 3-6 concrete recommendations with the call ids as evidence. File each one as `phone proposal add ...` (FAQ, KB, info, instructions); never apply without the owner saying yes.')


# ---------------------------------------------------------------- I) briefing
def briefing(a, say):
    d = _load(); b = d['briefing']; sub = a.arg
    if sub == 'enable':
        b['enabled'] = True; b['at'] = a.at or b.get('at') or '08:00'; _save(d)
        say(f"Daily briefing is ON for {b['at']}. This only records your choice. Create the schedule yourself: routine add --cron \"{int(b['at'][3:5])} {int(b['at'][:2])} * * *\" --tz <business tz> --name phone-briefing \"Run `phone briefing` and send me the result.\" (the routine tool is how it actually runs).")
        return
    if sub == 'disable':
        b['enabled'] = False; _save(d); say('Daily briefing is OFF (remove its routine: routine rm).'); return
    cfg = store.load_config(); tz = ZoneInfo(cfg['timezone'])
    day = datetime.strptime(a.day, '%Y-%m-%d').date() if a.day else datetime.now(tz).date() - (timedelta(days=1) if (datetime.now(tz).hour < 12 and not a.today) else timedelta(0))
    start = datetime(day.year, day.month, day.day, tzinfo=tz); end = start + timedelta(days=1)
    cs = [c for c in _calls(40) if start <= datetime.strptime(c['started_at'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc).astimezone(tz) < end]
    real = [c for c in cs if not _spam(c)]
    books = [bk for c in real for bk in _bookings(c) if bk.get('ok')]
    cancelled = sum(1 for c in real if (c.get('appointment') or {}).get('cancelled'))
    leads = [c for c in real if (c.get('message') or (c.get('appointment') or {}).get('wanted')) and (c.get('callback_number') or c.get('caller'))]
    emails = sum(1 for c in cs for x in (c.get('alerts') or []) if x.get('channel') == 'email' and x.get('ok'))
    sms = sum(1 for c in cs for x in (c.get('alerts') or []) if x.get('channel') == 'sms' and x.get('ok')) + sum(1 for c in real if (c.get('appointment') or {}).get('texts'))
    pend = [p for p in d['proposals'] if p['status'] == 'pending']
    made = [p for p in d['proposals'] if start <= datetime.fromisoformat(p['created']).astimezone(tz) < end]
    unhandled = [c for c in real if c.get('message') and not c.get('handled_at')]
    say(f"PHONE BRIEFING for {day.strftime('%A %b %d')} ({cfg['timezone']}), computed from the call log")
    say(f"- Calls: {len(cs)} ({len(real)} real, {len(cs)-len(real)} spam blocked)")
    say(f"- Messages taken: {sum(1 for c in real if c.get('message'))}, still unhandled: {len(unhandled)}")
    say(f"- Bookings made: {len(books)} (read-back verified: {sum(1 for x in books if x.get('verified'))}), cancelled: {cancelled}")
    say(f"- Qualified leads (message or booking intent with a way to reach them): {len(leads)}")
    say(f"- Transfers: {sum(1 for c in real if c.get('transfer'))}; owner alerts sent: {emails} emails, {sms} texts")
    say(f"- Proposals: {len(made)} created today, {len(pend)} awaiting your approval")
    for p in pend[:6]:
        say(f"    #{p['id']} {p['kind']}: {p['title']}")
    for c in unhandled[:5]:
        say(f"- Open message {c['id']}: {c.get('caller_name')} {c.get('callback_number')}: {(c.get('message') or '')[:140]}")
    if not cs:
        say('- Quiet day, nothing came in.')


# ---------------------------------------------------------------- J) proposals / self-tuning
KINDS = ('faq_add', 'faq_rm', 'info_set', 'instructions_add', 'greeting_set', 'kb_add')


def _desc(p):
    x = p['change']
    return {'faq_add': lambda: f"FAQ add  Q: {x['q']}  A: {x['a']}", 'faq_rm': lambda: f"FAQ remove  Q: {x['q']}",
            'info_set': lambda: f"Business info becomes: {x['text']}", 'instructions_add': lambda: f"Add to extra instructions: {x['text']}",
            'greeting_set': lambda: f"Greeting becomes: {x['text']}", 'kb_add': lambda: f"Knowledge base doc \"{x['title']}\" ({len(x['text'])} chars): {x['text'][:200]}"}[p['kind']]()


def proposal(a, say):
    d = _load(); ps = d['proposals']; sub = a.arg
    if sub == 'add':
        kind = a.arg2; title = a.arg3 or ''
        if kind not in KINDS:
            raise SystemExit('kind must be one of ' + ', '.join(KINDS) + '. usage: phone proposal add <kind> "<question|title>" --text "<answer|text>" --why "evidence"')
        text = open(a.file).read() if a.file else a.text
        if kind in ('faq_add',) and not (title and text):
            raise SystemExit('faq_add needs "Question" --text "Answer"')
        if kind == 'faq_rm' and not title:
            raise SystemExit('faq_rm needs "Question"')
        if kind in ('info_set', 'instructions_add', 'greeting_set') and not text:
            raise SystemExit(f'{kind} needs --text')
        if kind == 'kb_add' and not (title and text):
            raise SystemExit('kb_add needs "Title" --text/--file')
        change = {'faq_add': {'q': title, 'a': text}, 'faq_rm': {'q': title}, 'kb_add': {'title': title, 'text': text}}.get(kind, {'text': text})
        p = {'id': max([x['id'] for x in ps] or [0]) + 1, 'kind': kind, 'title': (title or text or '')[:80], 'change': change, 'why': a.why or '',
             'status': 'pending', 'created': datetime.now(timezone.utc).isoformat(), 'decided': None}
        ps.append(p); _save(d)
        say(f"Proposal #{p['id']} saved (PENDING, nothing changed yet): {_desc(p)}\nShow the owner and apply only after they approve: phone proposal approve {p['id']}"); return
    if sub in (None, 'list'):
        shown = [p for p in ps if a.all or p['status'] == 'pending']
        for p in shown:
            say(f"#{p['id']} [{p['status']}] {_desc(p)}\n     why: {p['why']}")
        if not shown:
            say('No pending proposals.')
        return
    pid = int(a.arg2 or 0); p = next((x for x in ps if x['id'] == pid), None)
    if not p:
        raise SystemExit('No such proposal.')
    if sub == 'show':
        say(json.dumps(p, indent=1)); return
    if p['status'] != 'pending':
        raise SystemExit(f"Proposal #{pid} is already {p['status']}.")
    if sub == 'reject':
        p['status'] = 'rejected'; p['decided'] = datetime.now(timezone.utc).isoformat(); _save(d); say(f'Rejected #{pid}. Nothing changed.'); return
    if sub == 'approve':
        cfg = store.load_config(); x = p['change']
        if p['kind'] == 'faq_add':
            cfg['faq'] = [f for f in cfg.get('faq') or [] if f['q'] != x['q']] + [{'q': x['q'], 'a': x['a']}]
        elif p['kind'] == 'faq_rm':
            cfg['faq'] = [f for f in cfg.get('faq') or [] if f['q'] != x['q']]
        elif p['kind'] == 'info_set':
            cfg['business_info'] = x['text']
        elif p['kind'] == 'instructions_add':
            cfg['extra_instructions'] = (cfg.get('extra_instructions') + '\n' if cfg.get('extra_instructions') else '') + x['text']
        elif p['kind'] == 'greeting_set':
            cfg['greeting'] = x['text']
        if p['kind'] != 'kb_add':
            errs = store.validate(cfg)
            if errs:
                raise SystemExit('Not applied: ' + '; '.join(errs))
            store.save_config(cfg, note=f"proposal #{pid} approved: {p['kind']} {p['title']}"[:200], who='owner-approved')
            undo = 'Undo with `phone undo` (config history).'
        else:
            n = store.kb_add(x['title'], x['text']); undo = f'Undo with `phone kb rm "{x["title"]}"` ({n} chunks added).'
        p['status'] = 'approved'; p['decided'] = datetime.now(timezone.utc).isoformat(); _save(d)
        say(f'Applied proposal #{pid}. The next call uses it. {undo}'); return
    raise SystemExit('usage: phone proposal add|list [--all]|show <id>|approve <id>|reject <id>')


# ---------------------------------------------------------------- first-time setup checklist
SETUP = os.path.join(store.PHONE_DIR, 'setup.json')


def setup(a, say):
    """Checklist for the guided first-time setup: what is still NEEDED. The agent asks only for those, then configures everything itself."""
    cfg = store.load_config()
    if a.arg == 'done':
        os.makedirs(store.PHONE_DIR, exist_ok=True)
        with open(SETUP, 'w') as f:
            json.dump({'done': datetime.now(timezone.utc).isoformat()}, f)
        say('Setup marked complete. Anything can still be changed by asking.'); return
    try:
        done = json.load(open(SETUP)).get('done')
    except Exception:
        done = None
    if done:
        say(f'Setup was completed {done[:10]}. Change anything by asking; run `phone status` for the current setup. (To redo the guided questions, delete nothing: just ask what to change.)'); return
    o = cfg.get('options') or {}; t = cfg.get('transfer') or {}; n = cfg.get('notify') or {}
    hrs = cfg.get('business_hours') or {}
    items = [
        ('business_name', 'Business name', cfg.get('business_name') or '', not cfg.get('business_name'), 'phone set \'{"business_name":"..."}\''),
        ('owner_name', 'Who messages are for (owner name)', cfg.get('owner_name') or '', not cfg.get('owner_name'), 'phone set \'{"owner_name":"..."}\''),
        ('timezone', 'Business timezone (IANA)', cfg.get('timezone'), cfg.get('timezone') in (None, '', 'UTC'), 'phone set \'{"timezone":"America/New_York"}\''),
        ('hours', 'Business hours (the AI answers outside them in after_hours mode)', json.dumps(hrs), not any(hrs.values()), 'phone set \'{"business_hours":{...all 7 days; null = closed},"mode":"after_hours"}\''),
        ('greeting', 'Assistant name + greeting + short business info', f"{cfg.get('assistant_name')}: {cfg.get('greeting')} | info: {cfg.get('business_info')}", not (cfg.get('greeting') and cfg.get('business_info')), 'phone set \'{"assistant_name":"..","greeting":"..","business_info":".."}\''),
        ('call_handling', 'What callers can do: message / book / transfer', f"message={o.get('take_message')} booking={o.get('appointments')} transfer={o.get('transfer')}", True, 'phone booking live|request|link <url>|off ; phone emergency transfer|text|message ; phone set \'{"options":{"take_message":true,"transfer":true}}\''),
        ('transfer_number', 'Transfer number (only if transfers are wanted)', json.dumps(t.get('targets') or t.get('number') or ''), bool(o.get('transfer')) and not (t.get('targets') or t.get('number')), 'phone target add \'{"name":"..","number":"+1.."}\''),
        ('calendar', 'Calendar connected (only if live booking is wanted)', 'check `connector status`', False, 'connector link microsoft calendar  (send the owner the link)'),
        ('alerts', 'Where call alerts go (email / text) and when', f"email={n.get('email')} {n.get('owner_email')} sms={n.get('sms')} {n.get('owner_sms')} when={n.get('when')}", not (n.get('owner_email') or n.get('owner_sms')) or n.get('when') == 'off' and False, 'phone set \'{"notify":{"email":true,"owner_email":["a@b.c"],"sms":true,"owner_sms":["+1.."],"when":"messages"}}\''),
    ]
    say('FIRST-TIME SETUP CHECKLIST (ask the owner ONLY for lines marked NEEDED or ASK, in plain conversation, a few at a time; then configure it yourself with the command shown and finish with `phone setup done` and `phone on`)')
    for k, label, val, needed, how in items:
        mark = 'NEEDED' if needed else ('ASK' if k in ('call_handling', 'calendar', 'alerts') else 'ok')
        say(f"[{mark}] {label}: {val}\n        set with: {how}")


# ---------------------------------------------------------------- after-call standing instructions (follow-ups) + local contacts
def followup(a, say):
    cfg = store.load_config(); fl = list((cfg.get('after_call') or {}).get('follow_ups') or []); sub = a.arg
    if sub in (None, 'list'):
        say('\n'.join(f'{i}. {f}' for i, f in enumerate(fl, 1)) or 'No standing after-call instructions (the default is just to post the message to the owner).'); return
    if sub == 'add' and a.arg2:
        fl.append(a.arg2.strip()); note = 'followup add'
    elif sub == 'rm' and a.arg2 and a.arg2.isdigit() and 1 <= int(a.arg2) <= len(fl):
        removed = fl.pop(int(a.arg2) - 1); note = 'followup rm'
    else:
        raise SystemExit('usage: phone followup add "plain-language instruction" | rm <number> | list')
    cfg.setdefault('after_call', {})['follow_ups'] = fl
    errs = store.validate(cfg)
    if errs:
        raise SystemExit('Not saved: ' + '; '.join(errs))
    store.save_config(cfg, note=f'{note}: {a.arg2}'[:200]); say(f'Saved. {len(fl)} standing after-call instruction(s); the follow-up run after every call does them in order.')


CONTACTS = os.path.join(store.PHONE_DIR, 'contacts.json')


def contact(a, say):
    try:
        cs = json.load(open(CONTACTS))
    except Exception:
        cs = []
    sub = a.arg
    if sub in (None, 'list'):
        for c in cs:
            say(f"{c['name']}  {c.get('phone') or ''}  {c.get('email') or ''}  {c.get('note') or ''}  (first call {c.get('first_call','')[:10]}, calls {c.get('calls',1)})")
        if not cs:
            say('No local contacts yet.')
        return
    if sub == 'search' and a.arg2:
        for c in cs:
            if a.arg2.lower() in json.dumps(c).lower():
                say(json.dumps(c))
        return
    if sub == 'add':
        phone = (a.phone or '').strip(); name = (a.arg2 or '').strip()
        if not (name or phone):
            raise SystemExit('usage: phone contact add "Name" --phone +1703... [--email x] [--note "..."] [--call <call_id>]')
        ex = next((c for c in cs if phone and c.get('phone') == phone), None)
        if ex:
            ex['calls'] = ex.get('calls', 1) + 1
            for k, v in (('name', name), ('email', a.email), ('note', a.note)):
                if v:
                    ex[k] = (ex.get(k, '') + '; ' + v) if k == 'note' and ex.get(k) and v not in ex[k] else v
            say(f"Updated existing contact {ex['name']} (now {ex['calls']} calls).")
        else:
            cs.append({'name': name, 'phone': phone, 'email': a.email or '', 'note': a.note or '', 'call_id': a.call or '', 'first_call': datetime.now(timezone.utc).isoformat(), 'calls': 1})
            say(f'Added contact {name} {phone}.')
        os.makedirs(store.PHONE_DIR, exist_ok=True)
        json.dump(cs, open(CONTACTS, 'w'), indent=1); return
    raise SystemExit('usage: phone contact add|list|search')


# ---------------------------------------------------------------- latency timeline + cost
def _turns(tlv):
    """Per-turn table. One row per caller utterance (provider transcript final). Anchor t0 = the delegation (if one fires within 2s of the transcript)
    or the transcript final: the end-of-turn the worker can observe. Provider-side end-of-turn detection happens before this and is not visible here;
    the caller-side measurement (aicaller CALLER_SIDE_LATENCY_S) is the full end-of-speech -> audible-reply number."""
    ev = sorted(tlv, key=lambda e: e['t'])
    tf = [e for e in ev if e['ev'] == 'caller_transcript_final']
    dg = [e for e in ev if e['ev'] == 'delegation_created']
    rows = []
    for n, f in enumerate(tf):
        d = next((x for x in dg if abs(x['t'] - f['t']) <= 2.0), None)
        t0 = min(f['t'], d['t']) if d else f['t']
        end = (min(tf[n + 1]['t'], next((x['t'] for x in dg if x['t'] > t0 + 2.0), 1e18)) - 2.0) if n + 1 < len(tf) else ev[-1]['t'] + 1
        end = max(end, t0 + 1)
        seg = [e for e in ev if t0 - 0.3 <= e['t'] < end]
        first = lambda key, after=None: next((x for x in seg if x['ev'] == key and (after is None or x['t'] >= after)), None)
        rel = lambda x: round(x['t'] - t0, 2) if x else None
        fa = first('agent_speaking'); ri = first('result_injected')
        ans = first('agent_speaking', ri['t']) if ri else None
        ts, te = first('tool_start'), first('tool_end')
        xs, xe = first('extract_start'), first('extract_end')
        rows.append({'turn': n + 1, 'transcript': rel(f), 'first_audio': rel(fa), 'delegation': rel(d), 'luna_start': rel(first('luna_request_start')),
                     'luna_first_token': rel(first('luna_first_token')), 'tool_start': rel(ts), 'tool_end': rel(te), 'luna_end': rel(first('luna_end')),
                     'result_injected': rel(ri), 'answer_after_result': rel(ans), 'extract_s': round(xe['t'] - xs['t'], 2) if xs and xe else None,
                     'tool': (te or {}).get('tool'), 'delegated': bool(d or first('luna_request_start'))})
    return rows


def timing(a, say):
    r = store.db().execute('SELECT * FROM calls WHERE id=?', (a.arg,)).fetchone() if a.arg else store.db().execute('SELECT * FROM calls ORDER BY started_at DESC LIMIT 1').fetchone()
    if not r:
        raise SystemExit('No such call.')
    tlv = (json.loads(r['cost_note'] or '{}')).get('timeline') or []
    rows = _turns(tlv)
    say(f"Per-turn timing for {r['id']} (seconds from the turn anchor = delegation or caller-transcript-final; '-' = did not happen; first_audio can be negative when the model started answering before the transcript was final)")
    cols = [('turn', 'turn'), ('transcript', 'transcr'), ('first_audio', '1st_audio'), ('delegation', 'deleg'), ('luna_start', 'luna_req'), ('luna_first_token', 'luna_1tok'), ('tool_start', 'tool_st'),
            ('tool_end', 'tool_end'), ('luna_end', 'luna_end'), ('result_injected', 'injected'), ('answer_after_result', 'answer'), ('extract_s', 'extract_s'), ('tool', 'tool')]
    say(' '.join(f'{h:>9}' for _, h in cols))
    for w in rows:
        say(' '.join(f"{('-' if w[k] is None else (w[k] if isinstance(w[k], str) else (f'{w[k]:.2f}' if k != 'turn' else w[k]))):>9}" for k, _ in cols))
    return rows


PRICE = {'gptlive_min': float(os.environ.get('PHONE_PRICE_GPTLIVE_MIN', 0.05)), 'telnyx_min': float(os.environ.get('PHONE_PRICE_TELNYX_MIN', 0.01)),
         'livekit_min': float(os.environ.get('PHONE_PRICE_LIVEKIT_MIN', 0.01)), 'luna_in': float(os.environ.get('PHONE_PRICE_LUNA_IN', 1.25)), 'luna_out': float(os.environ.get('PHONE_PRICE_LUNA_OUT', 10.0)),
         'haiku_in': float(os.environ.get('PHONE_PRICE_HAIKU_IN', 1.0)), 'haiku_out': float(os.environ.get('PHONE_PRICE_HAIKU_OUT', 5.0))}


def cost(a, say):
    n = int(a.n or 10)
    rows = store.db().execute('SELECT * FROM calls ORDER BY started_at DESC LIMIT ?', (n,)).fetchall()
    say('Per-call cost. Minutes and tokens are measured; $/unit are ASSUMED list prices (override with PHONE_PRICE_* env): '
        + ', '.join(f'{k}={v}' for k, v in PRICE.items()) + ' (luna/haiku per million tokens). Summary + extraction use Haiku.')
    tot = []
    for r in rows:
        cn = json.loads(r['cost_note'] or '{}'); mins = (r['duration_s'] or 0) / 60
        us = cn.get('usage') or {}; lu = us.get('luna') or {}; ex = us.get('extract') or {}
        c_live = mins * PRICE['gptlive_min']; c_tel = mins * (PRICE['telnyx_min'] + PRICE['livekit_min'])
        c_luna = (lu.get('in', 0) * PRICE['luna_in'] + lu.get('out', 0) * PRICE['luna_out']) / 1e6
        c_ex = (ex.get('in', 0) * PRICE['haiku_in'] + ex.get('out', 0) * PRICE['haiku_out']) / 1e6
        total = c_live + c_tel + c_luna + c_ex; tot.append(total)
        say(f"{r['id']}  {mins:4.1f} min  GPT Live ${c_live:.3f}  Luna ${c_luna:.3f} ({lu.get('in',0)}/{lu.get('out',0)} tok, {lu.get('responses',0)} resp)  extraction ${c_ex:.4f} ({ex.get('calls',0)} calls)  Telnyx+LiveKit ${c_tel:.3f}  = ${total:.3f}")
    if tot:
        say(f'average ${sum(tot)/len(tot):.3f} per call over {len(tot)} calls')
