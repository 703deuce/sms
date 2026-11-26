"""Evidence screenshots of key browser steps, saved with the job's results in <job>/evidence/ (JPEG, small), plus
evidence/index.jsonl (time, label, url, title). Capped at 40 per job. Used by browser-run, browser-shot --evidence and
the post-navigate hook (evidence-shot). Off switch: /opt/tools/flags/EVIDENCE_OFF."""
import json, os, re, time

CAP = 40
UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'


def job_root(path=None):
    for cand in (path, os.environ.get('AGENT_SANDBOX'), os.getcwd()):
        if not cand:
            continue
        m = re.match(rf'^(/workspace/jobs/{UUID}(?:/helpers/{UUID})*)', os.path.realpath(cand))
        if m:
            return m.group(1)
    return None


def _next(d, label):
    os.makedirs(d, exist_ok=True)
    n = len([f for f in os.listdir(d) if f.endswith('.jpg')])
    if n >= CAP:
        return None
    safe = re.sub(r'[^a-z0-9]+', '-', (label or 'step').lower()).strip('-')[:40] or 'step'
    return os.path.join(d, f'{n + 1:02d}-{safe}.jpg')


def save_page(page, label='step', root=None):
    if os.path.exists('/opt/tools/flags/EVIDENCE_OFF'):
        return None
    d = os.path.join(root or job_root() or os.getcwd(), 'evidence')
    fp = _next(d, label)
    if not fp:
        return None
    page.screenshot(path=fp, type='jpeg', quality=55, timeout=10000)
    try:
        title = page.title()
    except Exception:
        title = ''
    with open(os.path.join(d, 'index.jsonl'), 'a') as f:
        f.write(json.dumps({'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'file': os.path.basename(fp), 'label': label,
                            'url': page.url, 'title': title[:200]}) + '\n')
    return fp
