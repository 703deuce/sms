"""Front desk job registry (shared by the `job` CLI in the container and the runner's runner/jobs.py).

A job is a background worker: its own OpenHands conversation, started by the runner queue as a `helper` run whose
parent is the user's front-desk chat. This table adds what the front desk needs on top of the runs row: a name,
the latest progress line, and which front desk owns it."""
import runlib as R

SCHEMA = '''CREATE TABLE IF NOT EXISTS jobs(
  run_id TEXT PRIMARY KEY, front_cid TEXT NOT NULL, name TEXT, created_at TEXT NOT NULL,
  progress TEXT, progress_at TEXT, steer_count INTEGER NOT NULL DEFAULT 0, cancelled_by TEXT)'''
ACTIVE = ('queued', 'running')
WORKER_MARK = '[Background job from the front desk]'


def connect():
    db = R.connect()
    db.execute(SCHEMA)
    db.execute('CREATE INDEX IF NOT EXISTS jobs_front ON jobs(front_cid, created_at)')
    cols = {r[1] for r in db.execute('PRAGMA table_info(jobs)')}
    if 'work_class' not in cols:  # model ownership: visual | mixed | mechanical, decided by code at job start
        try:
            db.execute('ALTER TABLE jobs ADD COLUMN work_class TEXT')
        except Exception:
            pass  # another process added it first
    return db


def work_class(db, run_id):
    row = db.execute('SELECT work_class FROM jobs WHERE run_id=?', (run_id,)).fetchone()
    return row['work_class'] if row else None


def is_job(db, run_id):
    return db.execute('SELECT 1 FROM jobs WHERE run_id=?', (run_id,)).fetchone() is not None


def jobs_of(db, front_cid, active_only=False):
    q = ('SELECT j.*, r.status, r.title, r.result, r.error, r.started_at, r.finished_at, r.created_at AS queued_at, '
         'r.conversation_id, r.working_dir, r.last_checkpoint, r.cost, r.model FROM jobs j JOIN runs r ON r.id=j.run_id '
         'WHERE j.front_cid=?')
    if active_only:
        q += " AND r.status IN ('queued','running')"
    return db.execute(q + ' ORDER BY j.created_at', (front_cid,)).fetchall()


def find(db, front_cid, ref):
    """A job of this front desk by run id, conversation id, number (1-based, in start order) or name (prefix ok)."""
    rows = jobs_of(db, front_cid)
    ref = (ref or '').strip()
    if ref.isdigit() and 1 <= int(ref) <= len(rows):
        return rows[int(ref) - 1]
    for r in rows:
        if ref in (r['run_id'], r['conversation_id']):
            return r
    low = ref.lower()
    hits = [r for r in rows if (r['name'] or '').lower() == low] or [r for r in rows if (r['name'] or '').lower().startswith(low)]
    return hits[-1] if hits else None


def elapsed(r):
    start = R.parse_iso(r['started_at'] or r['queued_at'])
    end = R.parse_iso(r['finished_at']) or R.now()
    if not start:
        return ''
    s = int((end - start).total_seconds())
    return f'{s // 60}m{s % 60:02d}s' if s >= 60 else f'{s}s'
