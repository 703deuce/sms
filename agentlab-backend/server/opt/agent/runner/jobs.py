"""Front desk support inside the runner (agentd): job progress lines, the front-desk guard, Stop = cancel all jobs,
job result wording, and the /jobs HTTP routes. agentd calls init() once, tick() every loop, http_* from its Handler."""
import json, logging, re, time
from datetime import timedelta
import runlib as R
import joblib as J

log = logging.getLogger('agentd.jobs')
_api = _send = _event_time = None
GUARD_SECS = 75        # a front desk turn running longer than this without starting a job gets nudged
GUARD_ACTIONS = 6      # ... or with this many tool steps
PROGRESS_EVERY = 10    # seconds between progress-line refreshes per running job
_state = {'nudged': {}, 'conv_status': {}, 'progress_t': {}}


def init(api, send, event_time):
    global _api, _send, _event_time
    _api, _send, _event_time = api, send, event_time
    db = J.connect()
    if not db.execute("SELECT value FROM config WHERE key='frontdesk_since'").fetchone():
        db.execute("INSERT INTO config(key, value) VALUES ('frontdesk_since', ?)", (R.iso(R.now()),))


def since(db):
    r = db.execute("SELECT value FROM config WHERE key='frontdesk_since'").fetchone()
    return r[0] if r else '9999'


def front_desks(db):
    """User chats (page or POST /runs) started after the front desk went live. Older chats keep their old behavior."""
    return db.execute("SELECT * FROM runs WHERE source='user' AND parent_conversation_id IS NULL AND created_at>=?",
                      (since(db),)).fetchall()


def is_job(db, run_id):
    try:
        return J.is_job(db, run_id)
    except Exception:
        return False


def job_number(db, r):
    row = db.execute('SELECT front_cid FROM jobs WHERE run_id=?', (r['id'],)).fetchone()
    if not row:
        return None, None
    rows = J.jobs_of(db, row['front_cid'])
    for i, x in enumerate(rows, 1):
        if x['run_id'] == r['id']:
            return i, x
    return None, None


def delivery_text(db, r, result_text):
    n, j = job_number(db, r)
    name = (j['name'] if j else None) or r['title'] or 'job'
    took = J.elapsed(j) if j else ''
    if r['status'] == 'failed':
        head = f'[Background job {n} failed: {name}] after {took}. Reason: {r["error"] or "unknown"}'
        tail = 'Tell Rick briefly what failed and offer to retry. Do not retry on your own unless he asked for it.'
    else:
        head = f'[Background job {n} finished: {name}] in {took}.'
        tail = ('Relay this result to Rick now in plain words, as the answer to what he asked (no job numbers, run ids '
                'or folder names unless he needs a file path), then end your turn. Do not redo the work.')
    return f'{head}\n{result_text}\n\n({tail})'


# ---------- tick ----------
def tick(db, convs):
    by_id = {c['id']: c for c in convs or []}
    progress(db)
    for r in front_desks(db):
        c = by_id.get(r['conversation_id'])
        st = (c or {}).get('execution_status')
        prev = _state['conv_status'].get(r['conversation_id'])
        _state['conv_status'][r['conversation_id']] = st
        if prev is not None and prev != 'paused' and st == 'paused':  # Stop button = cancel all jobs
            stop_all(db, r['conversation_id'], 'stop button')
        if st == 'running':
            guard(db, r)


def progress(db):
    rows = db.execute("SELECT j.run_id, r.conversation_id FROM jobs j JOIN runs r ON r.id=j.run_id "
                      "WHERE r.status='running'").fetchall()
    now = time.time()
    for row in rows:
        if now - _state['progress_t'].get(row['run_id'], 0) < PROGRESS_EVERY:
            continue
        _state['progress_t'][row['run_id']] = now
        try:
            d = _api('GET', f"/api/conversations/{row['conversation_id']}/events/search?kind=ActionEvent"
                     '&sort_order=TIMESTAMP_DESC&limit=1', timeout=15)
        except Exception:
            continue
        items = d.get('items') or []
        if not items:
            continue
        e = items[0]
        text = (e.get('summary') or '').strip()
        if not text or re.match(r'^[\w.-]+: [\[{]', text):  # no real summary, just "tool: {raw args}"
            text = describe(e)
        db.execute('UPDATE jobs SET progress=?, progress_at=? WHERE run_id=?',
                   (text[:300], R.iso(_event_time(e.get('timestamp')) or R.now()), row['run_id']))


def describe(e):
    """Short progress line for an action that has no summary: tool plus its main argument."""
    act = e.get('action') or {}
    tool = e.get('tool_name') or act.get('kind') or 'working'
    args = act.get('data') if isinstance(act.get('data'), dict) else act
    for k in ('query', 'url', 'path', 'paths', 'goal', 'question', 'command'):
        v = args.get(k) if isinstance(args, dict) else None
        if v:
            v = ' '.join(map(str, v)) if isinstance(v, list) else str(v)
            if k == 'command':
                v = v.split('&&')[-1].strip()
            return f'{tool}: {v[:160]}'
    return tool


def raw_task(prompt):
    """The task text a front desk gave `job start`, without the worker wrapper (for routing decisions)."""
    t = str(prompt or '')
    if t.startswith(J.WORKER_MARK):
        t = t.split('\n', 1)[1] if '\n' in t else ''
    return t.split('\n\n(You are a background worker.')[0].strip()


def guard(db, r):
    """Server-side enforcement of 'the front desk never does long work itself': if a turn runs too long or takes too
    many tool steps without handing off, tell it (once per turn) to delegate the rest with `job start`."""
    cid = r['conversation_id']
    try:
        d = _api('GET', f'/api/conversations/{cid}/events/search?sort_order=TIMESTAMP_DESC&limit=60', timeout=15)
    except Exception:
        return
    t_msg, actions = None, 0
    for e in d.get('items') or []:
        if e.get('kind') == 'MessageEvent' and e.get('source') == 'user':
            t_msg = _event_time(e.get('timestamp'))
            key = e.get('id')
            try:
                first = ((e.get('llm_message') or {}).get('content') or [{}])[0].get('text') or ''
            except Exception:
                first = ''
            if first.startswith('[Front desk]'):
                return  # our own nudge is the latest message: one nudge per turn
            break
        if e.get('kind') == 'ActionEvent':
            actions += 1
    if not t_msg or _state['nudged'].get(cid) == key:
        return
    if db.execute('SELECT 1 FROM jobs WHERE front_cid=? AND created_at>=?', (cid, R.iso(t_msg - timedelta(seconds=2)))).fetchone():
        return
    secs = (R.now() - t_msg).total_seconds()
    if secs < GUARD_SECS and actions < GUARD_ACTIONS:
        return
    _state['nudged'][cid] = key
    try:
        _send(cid, f'[Front desk] This turn has run {int(secs)} s / {actions} tool steps without a handoff. You are the '
                   'front desk: do not continue this work here. Hand the remaining work to a background job now with '
                   '`job start "complete, self-contained task (include what you already found)" --name "short name"`, '
                   'tell Rick in one short line that it is running, and end your turn. (If you are already writing your '
                   'final answer, finish it instead.)')
        log.warning('front desk guard nudged %s (%ds, %d steps)', cid, secs, actions)
    except Exception as e:
        log.warning('front desk guard send failed %s: %s', cid, str(e)[:200])


def stop_all(db, front_cid, who):
    db.execute('''CREATE TABLE IF NOT EXISTS helper_ctl(id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, action TEXT,
                  text TEXT, created_by TEXT, created_at TEXT, done_at TEXT, note TEXT)''')
    n = 0
    for j in J.jobs_of(db, front_cid, active_only=True):
        db.execute('UPDATE jobs SET cancelled_by=? WHERE run_id=?', (who, j['run_id']))
        db.execute('INSERT INTO helper_ctl(run_id, action, text, created_by, created_at) VALUES (?,?,?,?,?)',
                   (j['run_id'], 'stop', None, who, R.iso(R.now())))
        n += 1
    if n:
        log.info('stop all: %d job(s) of %s cancelled (%s)', n, front_cid, who)
    return n


# ---------- HTTP (agentd Handler, after its token check) ----------
def http_get(path, qs, db):
    if path != '/jobs':
        return None
    cid = qs.get('conversation_id') or ''
    rows = J.jobs_of(J.connect(), cid) if cid else []
    items = []
    for i, r in enumerate(rows, 1):
        items.append({'n': i, 'name': r['name'], 'status': 'cancelled' if r['status'] == 'stopped' else r['status'],
                      'progress': r['progress'] or r['last_checkpoint'], 'progress_at': r['progress_at'],
                      'started_at': r['started_at'] or r['queued_at'], 'finished_at': r['finished_at'],
                      'elapsed': J.elapsed(r), 'cost': r['cost']})
    return 200, {'items': items, 'active': sum(1 for x in items if x['status'] in J.ACTIVE)}


def http_post(path, body, db):
    if path != '/jobs/cancel':
        return None
    cid = str((body or {}).get('conversation_id') or '')
    if not cid:
        return 400, {'error': 'conversation_id required'}
    return 200, {'cancelled': stop_all(J.connect(), cid, 'api')}
