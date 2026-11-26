"""Shared task-state record for one job: <job>/log/task.json.

The record is the authority on what is done. It holds the goal, size, success criteria (each with a verification status
PASS / FAIL / UNABLE_TO_VERIFY / pending, evidence and findings), the plan's milestones and the skills loaded. Only the
verification tools write a criterion's status, so a passing check is recorded by the harness, not remembered by the
model. Summaries (the runner's [Context restored] note), helpers and the Stop hook all read this file.
Stdlib only; used by agent-mcp (container), agent-complete (Stop hook) and the runner (host).
"""
import json, os, re, tempfile, time
from datetime import datetime
from zoneinfo import ZoneInfo

STATUSES = ('pending', 'PASS', 'FAIL', 'UNABLE_TO_VERIFY')
ET = ZoneInfo('America/New_York')


def now_et():
    return datetime.now(ET).isoformat(timespec='seconds')


def path(job):
    return os.path.join(job, 'log', 'task.json')


def load(job):
    try:
        with open(path(job)) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def save(job, rec):
    rec['updated_at'] = now_et()
    os.makedirs(os.path.join(job, 'log'), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.join(job, 'log'), prefix='.task-')
    with os.fdopen(fd, 'w') as f:
        json.dump(rec, f, indent=1)
    os.chmod(tmp, 0o664)
    os.replace(tmp, path(job))


def new(goal, size='medium', criteria=(), milestones=(), notes=''):
    return {'goal': goal, 'size': size, 'phase': 'working', 'created_at': now_et(), 'notes': notes,
            'criteria': [{'id': f'C{i + 1}', 'text': str(c), 'status': 'pending', 'evidence': '', 'findings': '',
                          'checked_at': None, 'check': None, 'fingerprint': None} for i, c in enumerate(criteria)],
            'milestones': [milestone(i, m) for i, m in enumerate(milestones)],
            'completed': [], 'history': []}


def milestone(i, m):
    """A milestone from a string or {"text", "criteria"}; criterion ids written in the text (e.g. "(C2, C3)") link too."""
    text = str(m.get('text') if isinstance(m, dict) else m)
    crit = [str(x).upper() for x in (m.get('criteria') or [])] if isinstance(m, dict) else []
    crit += [x.upper() for x in re.findall(r'\bC\d+\b', text, re.I) if x.upper() not in crit]
    return {'id': f'M{i + 1}', 'text': text, 'status': 'todo', 'done_at': None, 'criteria': crit}


def auto_milestones(rec):
    """Mark milestones done from verification results (the harness, not the model, locks finished work in):
    a milestone is done when every criterion linked to it (C ids in its text, or verify(milestone=...)) has PASSed.
    Milestones with no linked criterion (e.g. "report") stay for task_update. Returns the milestones newly marked."""
    passed = {c['id'].upper() for c in rec.get('criteria') or [] if c['status'] == 'PASS'}
    newly = []
    for m in rec.get('milestones') or []:
        if m.get('status') == 'done':
            continue
        linked = [x.upper() for x in m.get('criteria') or []]
        if linked and all(x in passed for x in linked):
            m.update(status='done', done_at=now_et(), auto=True)
            rec.setdefault('completed', []).append(f"{m['id']} {m['text']} (verified)")
            newly.append(m)
    return newly


def find(rec, cid):
    key = str(cid or '').strip().upper()
    for c in rec.get('criteria') or []:
        if c['id'].upper() == key:
            return c
    raise KeyError(f'no criterion {cid}; have ' + ', '.join(c['id'] for c in rec.get('criteria') or []))


def open_criteria(rec):
    return [c for c in rec.get('criteria') or [] if c['status'] != 'PASS']


def all_pass(rec):
    cs = rec.get('criteria') or []
    return bool(cs) and not open_criteria(rec)


def render(rec, skills=None):
    """The record as plain text (for summaries and tool replies). Nothing is trimmed."""
    if not rec:
        return '(no task record yet)'
    lines = [f"Goal: {rec.get('goal')}", f"Size: {rec.get('size')}   Phase: {rec.get('phase')}"]
    if skills:
        lines.append('Skills/files loaded: ' + ', '.join(skills))
    if rec.get('criteria'):
        lines.append('Success criteria (status set only by verification checks):')
        for c in rec['criteria']:
            ev = f" | evidence: {c['evidence']}" if c.get('evidence') else ''
            fi = f" | findings: {c['findings']}" if c.get('findings') and c['status'] != 'PASS' else ''
            at = f" ({c['checked_at'][11:16]} ET)" if c.get('checked_at') else ''
            lines.append(f"  [{c['status']}] {c['id']} {c['text']}{at}{ev}{fi}")
    if rec.get('milestones'):
        lines.append('Plan:')
        for m in rec['milestones']:
            box = {'done': 'x', 'doing': '>'}.get(m['status'], ' ')
            lines.append(f"  [{box}] {m['id']} {m['text']}")
    if rec.get('completed'):
        lines.append('Completed: ' + '; '.join(rec['completed']))
    if rec.get('notes'):
        lines.append('Notes: ' + rec['notes'])
    return '\n'.join(lines)
