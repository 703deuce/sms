"""Shared queue/routine/notification store for Agent Lab (used by the host daemon and the in-container CLIs).
SQLite at /workspace/runs/runs.db (host: /opt/agent/workspace/runs/runs.db). Times are UTC ISO strings."""
import json, os, re, secrets, sqlite3, hashlib
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

BOT = os.environ.get('BOT_ID') or 'agent-lab'
DEFAULT_TZ = 'America/New_York'
UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'


def db_path():
    if os.environ.get('RUNS_DB'):
        return os.environ['RUNS_DB']
    for root in ('/workspace', '/opt/agent/workspace'):
        if os.path.isdir(os.path.join(root, 'jobs')):
            return os.path.join(root, 'runs', 'runs.db')
    return '/workspace/runs/runs.db'


SCHEMA = '''
CREATE TABLE IF NOT EXISTS runs(
  id TEXT PRIMARY KEY, bot_id TEXT NOT NULL, source TEXT NOT NULL, routine_id TEXT, parent_conversation_id TEXT,
  title TEXT, prompt TEXT NOT NULL, conversation_id TEXT UNIQUE, working_dir TEXT, status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
  started_at TEXT, finished_at TEXT, heartbeat_at TEXT, last_event_at TEXT, resumed_at TEXT, last_checkpoint TEXT,
  result TEXT, result_delivered INTEGER NOT NULL DEFAULT 0, cost REAL, error TEXT, created_by TEXT);
CREATE INDEX IF NOT EXISTS runs_status ON runs(status, created_at);
CREATE TABLE IF NOT EXISTS routines(
  id TEXT PRIMARY KEY, bot_id TEXT NOT NULL, name TEXT, kind TEXT NOT NULL, cron TEXT, tz TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'run', prompt TEXT NOT NULL, webhook INTEGER NOT NULL DEFAULT 0, secret_hash TEXT,
  paused INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, next_run_at TEXT, last_run_at TEXT,
  last_run_id TEXT, created_at TEXT NOT NULL, created_by TEXT);
CREATE TABLE IF NOT EXISTS checkpoints(
  id INTEGER PRIMARY KEY, run_id TEXT, conversation_id TEXT, note TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY, bot_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT,
  run_id TEXT, conversation_id TEXT, files TEXT, created_at TEXT NOT NULL, read_at TEXT);
CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT);
'''


def connect():
    p = db_path()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    db = sqlite3.connect(p, timeout=30, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA busy_timeout=30000')
    db.executescript(SCHEMA)
    cols = {r[1] for r in db.execute('PRAGMA table_info(runs)')}
    for col, decl in (('kind', "TEXT NOT NULL DEFAULT 'agent'"), ('model', 'TEXT')):  # additive only
        if col not in cols:
            try:
                db.execute(f'ALTER TABLE runs ADD COLUMN {col} {decl}')
            except sqlite3.OperationalError:
                pass  # another process added it first
    return db


def now():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None


def parse_iso(s):
    if not s:
        return None
    s = s.replace('Z', '+00:00')
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def local(s, tz=DEFAULT_TZ):
    dt = parse_iso(s) if isinstance(s, str) else s
    return dt.astimezone(ZoneInfo(tz)).strftime('%a %b %-d %-I:%M %p %Z') if dt else '-'


def new_id(prefix):
    return f'{prefix}_{secrets.token_hex(5)}'


def cfg(db, key, default):
    r = db.execute('SELECT value FROM config WHERE key=?', (key,)).fetchone()
    return type(default)(r[0]) if r else default


# ---------- where am I (CLIs run inside a job folder) ----------

def job_from_cwd(cwd=None):
    """Returns (conversation_id, job_dir) for the innermost job or helper folder containing cwd."""
    parts = (cwd or os.getcwd()).rstrip('/').split('/')
    if parts[:3] != ['', 'workspace', 'jobs'] or len(parts) < 4 or not re.fullmatch(UUID, parts[3]):
        return None, None
    end = 4
    i = 4
    while i + 1 < len(parts) and parts[i] == 'helpers' and re.fullmatch(UUID, parts[i + 1]):
        end = i + 2
        i += 2
    return parts[end - 1], '/'.join(parts[:end])


# ---------- cron ----------

def _field(spec, lo, hi):
    vals = set()
    for part in spec.split(','):
        step = 1
        if '/' in part:
            part, st = part.split('/', 1)
            step = int(st)
        if part in ('*', ''):
            a, b = lo, hi
        elif '-' in part:
            a, b = (int(x) for x in part.split('-', 1))
        else:
            a = int(part)
            b = hi if step > 1 else a
        if a < lo or b > hi or a > b:
            raise ValueError(f'cron value out of range: {part}')
        vals.update(range(a, b + 1, step))
    return vals


DOW_NAMES = {n: str(i) for i, n in enumerate(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])}
ALIASES = {'@hourly': '0 * * * *', '@daily': '0 0 * * *', '@weekly': '0 0 * * 0', '@monthly': '0 0 1 * *'}


def parse_cron(expr):
    expr = ALIASES.get(expr.strip(), expr.strip())
    f = expr.split()
    if len(f) != 5:
        raise ValueError('cron needs 5 fields: minute hour day-of-month month day-of-week')
    dow_spec = re.sub(r'[a-z]{3}', lambda m: DOW_NAMES.get(m.group(0), m.group(0)), f[4].lower())
    mins, hours, doms, months = _field(f[0], 0, 59), _field(f[1], 0, 23), _field(f[2], 1, 31), _field(f[3], 1, 12)
    dows = {d % 7 for d in _field(dow_spec, 0, 7)}
    return mins, hours, doms, months, dows, f[2] != '*', f[4] != '*'


def cron_next(expr, tz, after=None):
    """Next fire time (UTC datetime) strictly after `after`, evaluated in time zone tz."""
    mins, hours, doms, months, dows, dom_r, dow_r = parse_cron(expr)
    z = ZoneInfo(tz)
    t = (after or now()).astimezone(z).replace(second=0, microsecond=0) + timedelta(minutes=1)
    for _ in range(400 * 24 * 60):
        if t.month not in months:
            t = (t.replace(day=1, hour=0, minute=0) + timedelta(days=32)).replace(day=1)
            continue
        dom_ok, dow_ok = t.day in doms, ((t.weekday() + 1) % 7) in dows
        day_ok = (dom_ok or dow_ok) if (dom_r and dow_r) else (dom_ok and dow_ok)
        if not day_ok:
            t = t.replace(hour=0, minute=0) + timedelta(days=1)
            continue
        if t.hour not in hours:
            t = t.replace(minute=0) + timedelta(hours=1)
            continue
        if t.minute not in mins:
            t += timedelta(minutes=1)
            continue
        # re-normalise across DST gaps
        return datetime.fromtimestamp(t.timestamp(), timezone.utc)
    raise ValueError('cron never fires')


# ---------- natural times for reminders ----------

WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
PARTS = {'morning': (9, 0), 'noon': (12, 0), 'midday': (12, 0), 'afternoon': (15, 0), 'evening': (18, 0),
         'tonight': (20, 0), 'night': (20, 0), 'midnight': (0, 0), 'eod': (17, 0)}


def parse_when(text, tz=DEFAULT_TZ):
    """Resolve a human time to UTC, reading every relative word in `tz` (default America/New_York):
    'in 10 minutes', '5pm', 'today 17:30', 'tonight', 'tonight 9', 'tomorrow 9am', 'tomorrow morning',
    'day after tomorrow 8am', 'monday 9am', 'next friday at 5pm', 'nov 23 9am', '11/23 9:00', '2026-11-23 09:00'."""
    z = ZoneInfo(tz)
    raw = text.strip()
    s = re.sub(r'\s+', ' ', raw.lower().replace(',', ' ')).strip()
    n = now().astimezone(z)
    m = re.fullmatch(r'in (\d+(?:\.\d+)?) ?(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|weeks?)', s)
    if m:
        v, u = float(m.group(1)), m.group(2)[0]
        return now() + timedelta(seconds=v * {'s': 1, 'm': 60, 'h': 3600, 'd': 86400, 'w': 604800}[u])
    day, explicit_day, part, same_day_ok = n.date(), False, None, False
    s = re.sub(r'^(on|at) ', '', s)
    if s.startswith('day after tomorrow'):
        day, explicit_day, s = day + timedelta(days=2), True, s[len('day after tomorrow'):]
    elif s.startswith('tomorrow'):
        day, explicit_day, s = day + timedelta(days=1), True, s[len('tomorrow'):]
    elif s.startswith('today'):
        explicit_day, s = True, s[len('today'):]
    elif s.startswith('tonight'):
        explicit_day, part, s = True, 'tonight', s[len('tonight'):]
    else:
        m = re.match(r'(next |this )?(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b', s)
        if m:
            wd = [w[:3] for w in WEEKDAYS].index(m.group(2)[:3])
            ahead = (wd - n.weekday()) % 7
            if m.group(1) == 'next ' and ahead == 0:
                ahead = 7
            day, explicit_day, s = day + timedelta(days=ahead), True, s[m.end():]
            same_day_ok = ahead == 0
        else:
            m = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})(?:t| |$)', s) or None
            if m:
                day, explicit_day, s = date(int(m.group(1)), int(m.group(2)), int(m.group(3))), True, s[m.end():]
            else:
                m = re.match(r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?\b', s) \
                    or re.match(r'(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b', s)
                if m:
                    if m.group(1).isdigit():
                        mo, dd = int(m.group(1)), int(m.group(2))
                    else:
                        mo, dd = MONTHS.index(m.group(1)[:3]) + 1, int(m.group(2))
                    yr = int(m.group(3)) if m.group(3) else n.year
                    yr = yr + 2000 if yr < 100 else yr
                    day, explicit_day, s = date(yr, mo, dd), True, s[m.end():]
                    if not m.group(3) and day < n.date():
                        day = date(yr + 1, mo, dd)
    s = re.sub(r'^(at|in the|the) ', '', s.strip()).strip()
    if s in PARTS or (s.split(' ')[0] in PARTS and len(s.split(' ')) == 1):
        part, s = s, ''
    if not s:
        h, mi = PARTS.get(part or ('morning' if explicit_day else ''), (None, None))
        if h is None:
            raise ValueError(f'could not understand time "{raw}"')
    else:
        m = re.fullmatch(r'(\d{1,2})(?::(\d{2}))?(?::\d{2})? ?(am|pm|a\.m\.|p\.m\.)?', s)
        if not m:
            raise ValueError(f'could not understand time "{raw}" (try "5pm", "17:30", "in 10 minutes", "tomorrow 9am", '
                             f'"tonight 9", "monday 9am", "nov 23 9am", "2026-11-23 09:00")')
        h, mi, ap = int(m.group(1)), int(m.group(2) or 0), (m.group(3) or '').replace('.', '')
        if part in ('tonight', 'evening', 'afternoon', 'night') and not ap and h < 12:
            h += 12
        if ap == 'pm' and h < 12:
            h += 12
        if ap == 'am' and h == 12:
            h = 0
    dt = datetime(day.year, day.month, day.day, h, mi, tzinfo=z)
    if dt <= n:
        if not explicit_day:
            dt += timedelta(days=1)       # a bare time that already passed today means tomorrow
        elif same_day_ok:
            dt += timedelta(days=7)       # 'monday 9am' said on a Monday after 9am means next Monday
        else:
            raise ValueError(f'"{raw}" resolves to {dt.strftime("%a %b %-d %Y %-I:%M %p %Z")}, which is in the past '
                             f'(now {n.strftime("%a %b %-d %-I:%M %p %Z")})')
    return dt.astimezone(timezone.utc)


def describe(dt_utc, tz=DEFAULT_TZ):
    """Absolute, unambiguous echo of a resolved time, plus how far away it is."""
    z = ZoneInfo(tz)
    d = dt_utc.astimezone(z)
    n = now().astimezone(z)
    secs = int((dt_utc - now()).total_seconds())
    rel = f'in {secs // 86400}d {secs % 86400 // 3600}h {secs % 3600 // 60}m' if secs >= 86400 else \
        f'in {secs // 3600}h {secs % 3600 // 60}m' if secs >= 3600 else f'in {max(0, secs) // 60}m {max(0, secs) % 60}s'
    return (f'{d.strftime("%A, %B %-d, %Y at %-I:%M %p %Z")} ({tz}; {rel}; now is '
            f'{n.strftime("%a %b %-d %-I:%M %p %Z")})')


# ---------- model routing (Haiku default; Opus is its own profile and never inherits Haiku limits) ----------
MODEL_PROFILES = {
    'haiku': 'lab-anthropic',
    'lab-anthropic': 'lab-anthropic',
    'claude-haiku-5-5': 'lab-anthropic',
    'anthropic/claude-haiku-5-5': 'lab-anthropic',
    'opus': 'lab-opus',
    'lab-opus': 'lab-opus',
    'claude-opus-5-5': 'lab-opus',
    'anthropic/claude-opus-5-5': 'lab-opus',
    'deepseek': 'lab-deepseek',
    'lab-deepseek': 'lab-deepseek',
    'gemini': 'lab-gemini',
    'lab-gemini': 'lab-gemini',
    'fallback-gemini': 'fallback-gemini',
    'luna': 'lab-luna',
    'lab-luna': 'lab-luna',
    'openai': 'lab-openai',
    'lab-openai': 'lab-openai',
    'fable': 'lab-fable',
    'lab-fable': 'lab-fable',
    'claude-fable-5-2': 'lab-fable',
    'anthropic/claude-fable-5-2': 'lab-fable',
}
DEFAULT_PROFILE = 'lab-anthropic'


def resolve_profile(name):
    """Map a user/API model alias to a stored OpenHands profile name, or None if unset/unknown."""
    if not name:
        return None
    key = str(name).strip().lower()
    if not key or key in ('default', 'auto', 'parent'):
        return None
    if key in MODEL_PROFILES:
        return MODEL_PROFILES[key]
    if key.startswith('lab-') or key.startswith('fallback-'):
        return key
    return None


def is_opus_model(name):
    prof = resolve_profile(name) if name else None
    if prof in ('lab-opus', 'lab-fable'):
        return True
    return any(k in str(name or '').lower() for k in ('opus', 'fable'))


# Single source for routing categories. Keep the AGENTS.md "Model routing" section in
# sync by rendering it with routing_section_markdown() (do not fork a second list).
# Update this dict when routing research lands. Categories are general, not product-specific.
# Tight conversation compaction is off; the only automatic summary is the 190K emergency
# backstop, which is not itself a reason to switch models.
ROUTING = {
    'default_profile': 'lab-anthropic',
    'escalate_profile': 'lab-opus',
    'escalate_after': 2,  # same step failed this many times -> Opus helper for that step only
    'opus_for': [
        {
            'id': 'visual',
            'title': 'Visual create or judge',
            'when': 'Creating or judging anything visual: graphics, motion graphics, designs, thumbnails, layouts, typography, image or video prompts, shot or cut choices, chart or slide design, "does this look right?", and reading charts or screenshots when you cannot measure with tools. Haiku may call an image or video API, or run a mechanical recipe (for example ffmpeg), once the prompt or recipe exists.',
        },
        {
            'id': 'code_from_screenshot',
            'title': 'Code or UI from a screenshot',
            'when': 'Implement or fix UI, layout, typography, or CSS from a screenshot, mockup, or capture.',
        },
        {
            'id': 'hard_engineering',
            'title': 'Apps, hard debugging, and refactors',
            'when': 'Multi-file apps and refactors, unfamiliar failing tests, tricky debugging, hard CLI or incident diagnosis, or changes to AgentLab itself. Simple scripts with a clear recipe stay on Haiku.',
        },
        {
            'id': 'complex_planning',
            'title': 'Lead planning on a fuzzy or complex brief',
            'when': 'Lead planning for a large, ambiguous, or "make it good" job. Opus writes the plan and checklist; Haiku executes the steps.',
        },
        {
            'id': 'public_writing',
            'title': 'Customer-facing writing and decks',
            'when': 'Copy that will be shown as finished work: customer emails, public pages, polished decks, announcements. Internal notes stay on Haiku.',
        },
        {
            'id': 'conflict_synthesis',
            'title': 'Conflicting-source synthesis',
            'when': 'Judge what to conclude when sources conflict or the question is expert-level. Ordinary search, fetch, and extract stay on Haiku.',
        },
        {
            'id': 'hard_math_finance',
            'title': 'Hard math and financial models',
            'when': 'Research-level math or a full financial model. Everyday arithmetic, invoices, and simple budgets stay on Haiku (verify in code or a spreadsheet).',
        },
        {
            'id': 'legal',
            'title': 'Legal work product',
            'when': 'A research memo, contract advice, or other legal work product that will be relied on. A first pass can stay on Haiku; a person should still review.',
        },
        {
            'id': 'hard_gui',
            'title': 'Visual captchas and hard GUI recoveries',
            'when': 'A visual captcha, or a long, surprising, or broken desktop or browser flow. Routine form fills and ordinary logins stay on Haiku, with a success check.',
        },
        {
            'id': 'refusal_recovery',
            'title': 'Refusal recovery',
            'when': 'Haiku refuses a legitimate step (for example a look/vision, research, or computer-use action it should do). Retry only that step on Opus.',
        },
        {
            'id': 'stuck_step',
            'title': 'Stuck-step escalation',
            'when': 'The same step has failed twice, the run is stuck or looping, a quality gate fails, or Haiku finishes early after admitting the brief was only partly met. Escalate that step only, then return to Haiku.',
        },
    ],
    'haiku_keeps': [
        'Search, fetch, extract, summarize, invoices, simple spreadsheets, reminders, memory, everyday translation, and simple scripts with tests',
        'Factual questions only with sources open: search; do not answer prices, dates, people, or product facts from memory (then stay on Haiku)',
        'Browser form-fills and routine computer use, with an explicit success check',
        'Mechanical media ops once the recipe exists (trim, export, transcribe, captions, loudness)',
        'Narrow subagent work (pull a line from a document, list matching files, run a test and return the failure)',
    ],
}


def failure_signature(text):
    """Normalize an error string so repeated failures of the same step can be grouped."""
    import re
    s = re.sub(r'\s+', ' ', str(text or '')).strip().lower()
    s = re.sub(r'\b\d+\b', 'N', s)
    return s[:160]


def same_step_should_escalate(signatures, n=None):
    """Return the signature if the last n failures are the same step, else None."""
    n = int(n or ROUTING.get('escalate_after') or 2)
    if len(signatures) < n:
        return None
    sig = signatures[-1]
    if sig and all(x == sig for x in signatures[-n:]):
        return sig
    return None


def routing_section_markdown():
    """AGENTS.md 'Model routing' section (Haiku-only, 2026-11-26)."""
    return OWNERSHIP_SECTION


OWNERSHIP_SECTION = '''## Model routing

AgentLab runs every job and every helper on Haiku (`lab-anthropic`, anthropic/claude-haiku-5-5) for now, including visual work, writing, planning, and debugging. The Opus and Fable profiles stay on disk but are unused: do not call `helper --model opus` or `helper --model fable`, and the runner will not auto-escalate to them. If a tool mentions an owner model (for example `visual-owner`), it also runs on Haiku.

Search instead of answering prices, dates, people, or product facts from memory.

Finish what you start: never stop mid-job to ask Rick whether to continue. If something is missing, choose the best reasonable option, note the assumption in your report, and complete the job.

The 190K emergency context backstop, if it ever fires, is not a reason to change model.
'''


# --- routing enforcement helpers (appended conceptually after routing_section_markdown) ---

PLAN_PREFIX = (
    '[Opus planning pass — this plan is authoritative for structure, design or visual approach, '
    'and the quality bar. Execute it on Haiku. Do not draft Remotion/HyperFrames/UI source; '
    'call visual-build (or let the runner start it) so Opus writes those files from scratch. '
    'For any visual review, call agent_view '
    '(the runner has Opus judge those frames automatically). If a step fails twice, '
    'the runner will escalate just that step.]\n\n'
    '%s\n\n'
    '---\n'
    'Original request:\n'
)


def needs_opus_plan(prompt, source=None, model=None):
    """True when a new Haiku run should get a short Opus planning pass first.

    General, not product-specific: long or ambiguous briefs, or briefs that clearly
    ask to make a substantial artifact (video, app, design, etc.). Tiny mechanical
    jobs stay on Haiku with no planning call. Helpers, reminders, and runs already
    on Opus are skipped.
    """
    if not owner_config().get('legacy_opus_plan'):
        return False  # retired 2026-11-24: visual work is owned end to end by its own Opus conversation instead
    if source in ('helper', 'reminder', 'vision'):
        return False
    if is_opus_model(model):
        return False
    text = str(prompt or '').strip()
    if len(text) < 80:
        return False
    low = text.lower()
    skip = ('reply exactly', 'say only', 'what time is it', 'save this preference',
            'schedule reminder', 'schedule a reminder')
    if any(s in low for s in skip) and len(text) < 800:
        return False
    if len(text) >= 900:
        return True
    markers = (
        'make a ', 'build a ', 'create a ', 'produce ', 'documentary', ' video',
        'film ', 'storyboard', 'premium', 'motion graphic', 'refactor', 'multi-step',
        'implement ', 'design a ', 'full pipeline', 'from a screenshot', 'from this mockup',
        'financial model', 'legal memo', 'contract',
    )
    return any(m in low for m in markers)


def wrap_with_opus_plan(prompt, plan):
    plan = (plan or '').strip()
    if not plan:
        return prompt
    return (PLAN_PREFIX % plan) + prompt


def opus_step_costs(conversation_ids, job_dirs=None, log_path=None):
    """Sum metered opus-step (planning / visual judge) costs for these conversations."""
    ids = set(conversation_ids or [])
    jobs = [j.rstrip('/') for j in (job_dirs or []) if j]
    total, by_purpose, n = 0.0, {}, 0
    path = log_path or os.environ.get('USAGE_LOG')
    if not path:
        path = '/workspace/usage/usage.jsonl' if os.path.isdir('/workspace/usage') or os.path.isdir('/workspace/jobs') else '/opt/agent/workspace/usage/usage.jsonl'
    def consider(d, seen):
        nonlocal total, n
        if d.get('tool') not in (None, 'opus-step') and d.get('tool') != 'opus-step':
            return
        if d.get('tool') and d.get('tool') != 'opus-step':
            return
        if not d.get('estimated_cost_usd') and d.get('purpose') not in ('plan','judge','step'):
            return
        key = (d.get('ts'), d.get('purpose'), d.get('estimated_cost_usd'), d.get('conversation_id'))
        if key in seen:
            return
        j = str(d.get('job') or '')
        if d.get('conversation_id') in ids or any(j == job or j.startswith(job + '/') for job in jobs):
            seen.add(key)
            c = float(d.get('estimated_cost_usd') or 0)
            total += c
            n += 1
            purp = d.get('purpose') or 'step'
            by_purpose[purp] = by_purpose.get(purp, 0.0) + c

    seen = set()
    for candidate in (path, path.replace('/workspace/', '/opt/agent/workspace/', 1)):
        try:
            f = open(candidate)
        except FileNotFoundError:
            continue
        with f:
            for line in f:
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                if d.get('tool') != 'opus-step':
                    continue
                consider(d, seen)
    # also the per-job log (plans started on the host can miss the main usage.jsonl)
    for job in jobs:
        for root in (job, job.replace('/workspace/', '/opt/agent/workspace/', 1)):
            lp = os.path.join(root, 'log', 'opus-steps.jsonl')
            try:
                f = open(lp)
            except FileNotFoundError:
                continue
            with f:
                for line in f:
                    try:
                        d = json.loads(line)
                    except Exception:
                        continue
                    consider(d, seen)
    return round(total, 6), {k: round(v, 6) for k, v in by_purpose.items()}, n


VISUAL_EXTS = {'.tsx', '.jsx', '.vue', '.svelte', '.css', '.scss', '.sass', '.less', '.html', '.htm'}
VISUAL_PATH_RE = re.compile(
    r'(^|/)(remotion|hyperframes?|cinematic|components|pages)/'
    r'|film\.tsx|\.module\.(css|scss)$|three\.js|theatre\.js',
    re.I,
)


def is_visual_source_path(path):
    """True for motion-graphics / front-end / UI source that Opus must write (not ffmpeg scripts, json, md)."""
    p = str(path or '').replace('\\', '/')
    ext = os.path.splitext(p)[1].lower()
    if ext in VISUAL_EXTS:
        return True
    if ext in {'.ts', '.js', '.mjs', '.cjs'} and VISUAL_PATH_RE.search(p):
        return True
    return False


def current_run_is_opus(job):
    ids = re.findall(UUID, job or '')
    if not ids:
        return False
    cid = ids[-1]
    try:
        st = json.load(open(f'/workspace/runs/vision/{cid}.json'))
        if is_opus_model(st.get('model')):
            return True
    except Exception:
        pass
    try:
        row = connect().execute('SELECT model FROM runs WHERE conversation_id=?', (cid,)).fetchone()
        if row and is_opus_model(row['model'] if 'model' in row.keys() else None):
            return True
    except Exception:
        pass
    return False


# ---------- writes ----------


def enqueue(db, prompt, source, title=None, routine_id=None, parent_conversation_id=None, working_dir=None,
            conversation_id=None, created_by=None, bot_id=BOT, model=None):
    import uuid
    rid = new_id('run')
    cid = conversation_id or str(uuid.uuid4())
    if not working_dir:
        working_dir = (f'/workspace/jobs/{parent_conversation_id}/helpers/{cid}' if source == 'helper' and parent_conversation_id
                       else f'/workspace/jobs/{cid}')
    db.execute('''INSERT INTO runs(id, bot_id, source, routine_id, parent_conversation_id, title, prompt, conversation_id,
                  working_dir, status, created_at, created_by, model) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
               (rid, bot_id, source, routine_id, parent_conversation_id, title, prompt, cid, working_dir, 'queued',
                iso(now()), created_by, model))
    return rid, cid


def notify(db, kind, title, body='', run_id=None, conversation_id=None, files=None, bot_id=BOT):
    db.execute('''INSERT INTO notifications(bot_id, kind, title, body, run_id, conversation_id, files, created_at)
                  VALUES (?,?,?,?,?,?,?,?)''', (bot_id, kind, title[:300], (body or '')[:8000], run_id, conversation_id,
                                                json.dumps(files or []), iso(now())))


def make_secret():
    s = secrets.token_urlsafe(24)
    return s, hashlib.sha256(s.encode()).hexdigest()


def check_secret(row, given):
    if not row['secret_hash'] or not given:
        return False
    return secrets.compare_digest(row['secret_hash'], hashlib.sha256(given.encode()).hexdigest())


# ---------------- model ownership (2026-11-24) ----------------
# Code, not the agent, picks the owner model when work starts. Config: model_owners.json next to this file.
OWNER_CONFIG_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'model_owners.json')
_OWNER_DEFAULTS = {'visual_owner': 'lab-opus', 'mechanical_owner': 'lab-anthropic', 'gate_max_rejections': 2,
                   'legacy_opus_plan': False, 'legacy_opus_judge_for_haiku': False, 'legacy_visual_guard': False,
                   'allow_opus': True}


def owner_config():
    try:
        with open(OWNER_CONFIG_PATH) as f:
            return {**_OWNER_DEFAULTS, **{k: v for k, v in json.load(f).items() if not k.startswith('_')}}
    except Exception:
        return dict(_OWNER_DEFAULTS)


def visual_owner_profile():
    return resolve_profile(owner_config()['visual_owner']) or 'lab-opus'


def mechanical_owner_profile():
    return resolve_profile(owner_config()['mechanical_owner']) or DEFAULT_PROFILE


def allow_opus():
    """False during the Haiku-only window (model_owners.json allow_opus: false). Default True."""
    cfg = owner_config()
    if 'allow_opus' in cfg:
        return bool(cfg['allow_opus'])
    return visual_owner_profile() in ('lab-opus', 'lab-fable')


def scheduled_profile(name):
    """Profile to actually start or switch to. Remaps lab-opus and lab-fable to the mechanical
    owner when allow_opus is false. Those profiles stay defined and unused until allow_opus is
    turned back on."""
    prof = resolve_profile(name)
    if prof in ('lab-opus', 'lab-fable') and not allow_opus():
        return mechanical_owner_profile()
    if prof and 'sonnet' in str(prof).lower():
        return mechanical_owner_profile()  # Sonnet is only the code-rescue tool (host key proxy), never a job or helper model
    return prof


def is_visual_owner_model(name):
    """True for the configured visual owner (or any Opus/Fable profile or model id)."""
    n = str(name or '').lower()
    return resolve_profile(name) == visual_owner_profile() or 'opus' in n or 'fable' in n


_VISUAL_PATTERNS = [
    r'motion[- ]?graphic', r'\banimat(ed|ion|e)\b', r'title[- ]card', r'lower[- ]thirds?', r'kinetic (type|typography)',
    r'\bremotion\b', r'hyper ?frames?', r'\bcompositions?\b', r'scene code', r'\bscenes?\b.*\b(code|graphics?)\b',
    r'landing page', r'web ?page', r'\bwebsite\b', r'front[- ]?end', r'\bhtml\b', r'\bcss\b', r'\bui\b', r'\binterface design\b',
    r'thumbnail', r'\bposter\b', r'infographic', r'\blogo\b', r'\bgraphics?\b', r'overlay', r'drawtext', r'text on (screen|the video)',
    r'on-screen text', r'\bslides?\b.*\bdesign', r'chart design', r'\bbanner\b', r'\bintro\b|\boutro\b',
    r'\b(make|create|produce|build|design)\b[^.\n]{0,60}\b(video|reel|short|explainer|promo|trailer|montage|recap|documentary)\b',
]
_MECHANICAL_PATTERNS = [
    r'footage', r'\bclips?\b', r'download', r'\bfetch', r'transcod', r'\bconvert', r'compress', r'voice[- ]?over', r'\bvo\b',
    r'narrat', r'\btts\b', r'transcri', r'\bassembl', r'\bmux', r'\btrim', r'research', r'\bsources?\b', r'\bsearch',
]


def classification_text(task, limit=20000):
    """The task plus any brief it points to (a /workspace/...md or .txt file), so 'read brief.md and make X' is
    classified on the brief itself."""
    text = str(task or '')
    for p in re.findall(r'(/workspace/[^\s`\'"]+?\.(?:md|txt))\b', text)[:3]:
        try:
            with open(p, errors='replace') as f:
                text += '\n' + f.read(limit)
        except OSError:
            pass
    return text


def classify_work(task):
    """('visual' | 'mixed' | 'mechanical', matched cues). Plain rules, readable and testable.
    visual: only visual cues (the whole job goes to the visual owner). mixed: visual + mechanical cues (Haiku does
    the mechanical prep and must hand the visual piece to the visual owner). mechanical: no visual cue."""
    text = str(task or '').lower()
    vis = [p for p in _VISUAL_PATTERNS if re.search(p, text)]
    mech = [p for p in _MECHANICAL_PATTERNS if re.search(p, text)]
    if not vis:
        return 'mechanical', mech
    return ('mixed' if mech else 'visual'), vis + mech


def original_task(prompt):
    """The job's task text exactly as the front desk gave it (without the worker mark and the trailing worker notes)."""
    t = str(prompt or '')
    if t.startswith(WORKER_MARK):
        t = t.split('\n\n', 1)[1] if '\n\n' in t else t
    return t.split('\n\n(You are a background worker', 1)[0].strip()




def visual_owner_prompt(brief, wd, job_name=None, task=None):
    """The owner's first message: the written brief plus its ownership contract. The owner owns the creative
    decisions (sources, facts, script, creative plan, scene design) as well as the build, so the weakest model
    never sets the ceiling. `task` is the job's original request, passed through untouched."""
    orig = ('\n\n--- The job\'s original request (authoritative: its targets, word counts, lengths, sizes and '
            'criteria are yours to meet; if it points to a brief file, read that file first) ---\n' + str(task).strip()
            if task else '')
    return (f'[Visual owner] {job_name or "visual build"}\n\n'
            'You are the owner of this job\'s creative and visual work: a fresh conversation on the strongest model, '
            'started by the runner. A cheaper mechanical helper (Haiku) only prepared files and will afterwards mix '
            'audio and do the final stream-copy assembly. Everything that makes the piece good is yours:\n'
            +
            '1. Read the sources and the original request yourself (not a summary of them). Write the facts file '
            '(every fact with its source), choose the best moments/material, and write the script to the request\'s '
            'own word-count and length targets (do not shorten it to fit a weaker plan; if the request gives no '
            'target, make it as long as the format needs).\n'
            '2. Write a creative plan: scene-by-scene design, pacing, typography, motion, graphics. Save it as '
            'plan.md.\n'
            '3. If the piece has a voiceover: generate it yourself from your script (terminal `tts`, the voice and '
            'model the request names) and get word timings (`transcribe`), then build the visuals to those '
            'timings.\n'
            '4. Write the composition/scene/page code yourself, render the visuals only (silent video, no music), '
            'look at the render (agent_view on frames), fix, and re-render until it is right.\n'
            f'Work and save files only in your own folder {wd}; put finished files in {wd}/out/: the silent visual '
            'render (out/visual.mp4 or the page/image files), plus voiceover audio (out/vo.mp3), word timings '
            '(out/vo_words.json), script.md and plan.md when they exist. Assets named in the brief may live in other '
            'folders: read them there or copy them into your folder.\n'
            'Do NOT mix music, loudnorm or mux final audio, and do not draw on or re-encode the render after you '
            'deliver it: the helper adds audio by stream copy, and a completion gate rejects any visual file that '
            'did not come from this conversation.\n'
            'Complete autonomously: never stop to ask for permission or confirmation. If something is missing or '
            'unclear, make the best reasonable choice, note it, and finish.\n'
            'When done, reply with: the full paths of the final files, the script word count and VO length, what '
            'you built (engine, duration, resolution), and any known issues.'
            + orig + '\n\n--- Brief from the helper (clips and files it prepared; the original request above wins on '
            'any conflict) ---\n' + str(brief).strip())


WORKER_AUTONOMY = ('Complete the job autonomously: never stop mid-job to ask Rick whether to continue or which option '
                   'to take. If something is missing, choose the best reasonable option, note the assumption in your '
                   'result, and finish.')

MIXED_JOB_NOTE = ('Model ownership (set by the runner, not optional): this job has creative and visual work, and that '
                  'belongs to the owner, a separate conversation on the strongest model. The owner reads the sources, '
                  'writes the facts, script and creative plan to the request\'s targets, makes the voiceover, builds and '
                  'renders the visuals. You do NOT write the script, facts, selects or creative plan, and you do not '
                  'draw or render visuals. You do the mechanical parts only: (1) before: copy and verify the input '
                  'files, ffprobe them, make contact-sheet stills, put them in your folder; (2) hand off at once with '
                  '`visual-owner --brief-file <short file listing the exact paths you prepared>` (the runner passes the '
                  'original request to the owner untouched; do not paraphrase or shrink it) and wait; (3) after: take the '
                  'owner\'s files as they are, add music and mix (duck music under the voiceover, loudnorm to the '
                  'request\'s target), mux with the owner\'s video stream copied (`-c:v copy`), trim/pad audio to the '
                  'exact length, run the QC measurements and report. The completion gate rejects visual files that '
                  'did not come from the owner conversation.')


# Fable 5.2 list prices per token: $8 in / $40 out / $0.20 cache read / $10 cache write (write price assumed 1.25x input).
FABLE_PRICES = {'input': 8e-6, 'output': 40e-6, 'cache_read': 0.2e-6, 'cache_write': 10e-6}


def fable_cost(usage, fallback=0.0):
    """Cost of a Fable conversation from its token counts (prompt_tokens includes the cached tokens)."""
    try:
        p, c = int(usage.get('prompt_tokens') or 0), int(usage.get('completion_tokens') or 0)
        rd, wr = int(usage.get('cache_read_tokens') or 0), int(usage.get('cache_write_tokens') or 0)
        if not (p or c):
            return fallback
        f = FABLE_PRICES
        return max(p - rd - wr, 0) * f['input'] + wr * f['cache_write'] + rd * f['cache_read'] + c * f['output']
    except Exception:
        return fallback


# ---------------- Anthropic thinking-block binding (2026-11-25) ----------------
# Fable/Mythos-generation models bind each signed thinking block to the exact conversation prefix it was made in.
# Any history rewrite (condensation, trimming, a model swap and back) changes that prefix, and the API then rejects
# the old blocks ("Invalid `signature` in `thinking` block. The block is bound to a different conversation").
# The API's control is thinking.block_binding.prefix_mismatch_behavior = "drop_block". OpenHands 1.63.1 + litellm
# cannot send it (litellm_extra_body arrives at Anthropic as a literal "extra_body" key), so these profiles talk to
# Anthropic through the local pass-through /opt/agent/ops/anthropic_shim.py, which adds it and, if a block is still
# rejected, retries once with the replayed thinking blocks removed. The shim holds no secrets.
THINKING_BINDING_FAMILIES = ('fable', 'mythos')
THINKING_BINDING_BASE_URL = 'http://127.0.0.1:6074'


def needs_thinking_binding(model):
    m = str(model or '').lower()
    return 'claude' in m and any(f in m for f in THINKING_BINDING_FAMILIES)


def has_thinking_binding(llm):
    return str((llm or {}).get('base_url') or '').rstrip('/') == THINKING_BINDING_BASE_URL


def with_thinking_binding(llm):
    """Copy of an LLM config dict routed through the binding shim (no-op for models that do not bind blocks)."""
    llm = dict(llm or {})
    if needs_thinking_binding(llm.get('model')):
        llm['base_url'] = THINKING_BINDING_BASE_URL
    return llm


def is_thinking_binding_error(text):
    t = str(text or '').lower()
    return 'thinking' in t and ('bound to a different conversation' in t or 'invalid `signature`' in t
                                or 'thinking.signature' in t)


# ---------------- failed-step detection: what is NOT a failed step (2026-11-25) ----------------
_BENIGN_FAILURE_PATTERNS = (
    r'tool call interrupted before completion', r'conversation was paused',
    r'process (was )?killed by (the )?user', r'keyboardinterrupt',
)
_WAIT_COMMAND_RE = re.compile(r'(\b(visual-owner|helper|runs)\s+(result|status|list)\b|--wait\b|^\s*sleep\b|\bwait-for\b)')


def is_benign_failure(text, command=None):
    """Interrupted/paused tool calls and waits on another run are not failed steps (they must never escalate)."""
    t = str(text or '').lower()
    if any(re.search(p, t) for p in _BENIGN_FAILURE_PATTERNS):
        return True
    return bool(command and _WAIT_COMMAND_RE.search(str(command)))


# ---------- crash recovery (one automatic retry, no duplicate owners) ----------
HELPER_MAX_RETRIES = 1  # helper / visual-owner conversations: resume once in the same folder, then stop
CRASH_STOP_NOTE = ('The runner already resumed it once in the same folder and it failed again, so it was stopped to '
                   'avoid more spend. Do not start another visual owner or helper for this, and do not rebuild it '
                   'yourself. Finish now: report this failure (and what is already in the folder) in your result.')


def existing_owner(db, job):
    """The visual-owner run already started for this job folder (newest), or None. One owner per job."""
    return db.execute("SELECT * FROM runs WHERE kind='visual-owner' AND working_dir LIKE ? ORDER BY created_at DESC LIMIT 1",
                      (job.rstrip('/') + '/helpers/%',)).fetchone()


def failed_twin(db, parent_cid, title):
    """A helper with the same title from the same parent that already crashed (and used its one retry)."""
    return db.execute("SELECT * FROM runs WHERE source='helper' AND parent_conversation_id=? AND title=? "
                      "AND status='failed' ORDER BY created_at DESC LIMIT 1", (parent_cid, title)).fetchone()


_SAVED = [('brief.md', 'brief'), ('log/goal.md', 'goal'), ('log/handoff.md', 'handoff'), ('log/checkpoints.md', 'checkpoints'),
          ('log/context-log.md', 'context log'), ('research/facts.md', 'facts'), ('script', 'script'), ('plan.md', 'plan'),
          ('log/plan.md', 'plan'), ('web', 'scene code'), ('src', 'scene code'), ('frames/still', 'stills'),
          ('audio', 'audio'), ('out', 'outputs')]


def saved_files(host_dir):
    """Short list of the durable files a crashed run left in its folder (what a resume should start from)."""
    out = []
    for rel, what in _SAVED:
        path = os.path.join(host_dir, rel)
        if os.path.isdir(path):
            try:
                n = len([f for f in os.listdir(path) if not f.startswith('.')])
            except OSError:
                n = 0
            if n:
                out.append(f'{rel}/ ({what}, {n} files)')
        elif os.path.isfile(path):
            out.append(f'{rel} ({what})')
    return out


def resume_brief(kind, reason, files):
    """The one recovery message: continue from the saved files, do not start over."""
    lst = '\n'.join('- ' + f for f in files) or '- (no saved files found; check the folder)'
    who = 'visual owner' if kind == 'visual-owner' else 'helper'
    return (f'[Recovery] Your run crashed ({reason[:200]}). The runner resumed you ONCE in the same conversation and '
            f'folder; this is the only automatic retry. Your work so far is saved here:\n{lst}\n'
            f'Continue from these files as the {who}: do not reread every source, redo research, or rebuild code or '
            'assets from scratch. Look at out/ and your newest files to see where you stopped, do only the remaining '
            'steps, then deliver. If this run fails again it is stopped and the failure is reported.')
