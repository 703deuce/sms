"""Completion gate for jobs with visual work (model ownership, 2026-11-24).

A job classified visual or mixed may only finish if every visual file it delivers came from a visual-owner
conversation (kind='visual-owner', run on the configured owner model). Provenance is checked with conversation
ids, the per-conversation cost snapshot (which model actually spent tokens), content hashes, the owner run's time
window and the owner's own event log. File extensions only decide which delivered files need checking.

check(db, run) -> {'verdict': 'pass' | 'wait' | 'reject', 'reason': str, ...evidence}
"""
import glob, hashlib, json, os, re, subprocess, sys
from datetime import timedelta

sys.path.insert(0, '/opt/agent/tools')
import runlib as R  # noqa: E402

HOST_WS = '/opt/agent/workspace'
COST_DIR = HOST_WS + '/runs/cost'
CONV_DIR = HOST_WS + '/conversations'
VISUAL_EXT = ('mp4', 'mov', 'webm', 'mkv', 'gif', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'html')
VIDEO_EXT = ('mp4', 'mov', 'webm', 'mkv')
PATH_RE = re.compile(r'(/workspace/[^\s`\'"<>()\[\]]+?\.(?:' + '|'.join(VISUAL_EXT) + r'))(?![\w])', re.I)


def host(p):
    return str(p).replace('/workspace/', HOST_WS + '/', 1) if str(p).startswith('/workspace/') else str(p)


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def video_stream_hash(path):
    """Hash of the first video stream's packets (stream copy). Equal hashes = same encoded frames, so a file that
    only had audio muxed in (mechanical assembly) still matches the owner's render; any redraw or re-encode does not."""
    try:
        p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-c', 'copy', '-f', 'hash',
                            '-hash', 'sha256', '-'], capture_output=True, text=True, timeout=120)
        out = (p.stdout or '').strip()
        return out.split('=', 1)[-1] if p.returncode == 0 and out else None
    except Exception:
        return None


def deliverables(result):
    seen, out = set(), []
    for m in PATH_RE.findall(result or ''):
        m = m.rstrip('.,;:')
        working_still = m.lower().rsplit('.', 1)[-1] in ('png', 'jpg', 'jpeg', 'webp', 'gif') and '/out/' not in m
        if working_still:
            continue  # QC stills / contact sheets outside out/ are working files, not deliverables
        if m not in seen and os.path.isfile(host(m)):
            seen.add(m)
            out.append(m)
    return out


def cost_models(cid):
    try:
        rec = json.load(open(os.path.join(COST_DIR, f'{cid}.json')))
    except Exception:
        return {}, None
    return {k: v for k, v in (rec.get('cost_by_model') or {}).items() if (v or 0) > 0}, rec.get('model')


def events_text(cid):
    d = os.path.join(CONV_DIR, str(cid).replace('-', ''), 'events')
    parts = []
    for f in sorted(glob.glob(d + '/event-*.json')):
        try:
            parts.append(open(f, errors='replace').read())
        except OSError:
            pass
    return '\n'.join(parts)


def owner_runs(db, r):
    wd = (r['working_dir'] or '').rstrip('/')
    rows = []
    if (r['kind'] if 'kind' in r.keys() else '') == 'visual-owner':
        rows.append(r)
    rows += db.execute("SELECT * FROM runs WHERE kind='visual-owner' AND working_dir LIKE ? ORDER BY created_at",
                       (wd + '/helpers/%',)).fetchall()
    return rows


def owner_ok(o):
    """The owner conversation must have spent tokens only on the visual-owner model."""
    by, model = cost_models(o['conversation_id'])
    models = sorted(by) or ([model] if model else [])
    good = bool(models) and all(R.is_visual_owner_model(m) for m in models)
    return good, {'conversation_id': o['conversation_id'], 'run_id': o['id'], 'runs_model': o['model'],
                  'cost_by_model': by, 'status': o['status'], 'started_at': o['started_at'], 'finished_at': o['finished_at']}


def owner_files(o):
    root = host(o['working_dir'])
    start = R.parse_iso(o['started_at']) - timedelta(seconds=5) if o['started_at'] else None
    end = (R.parse_iso(o['finished_at']) if o['finished_at'] else R.now()) + timedelta(seconds=30)
    files = []
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d != 'helpers']  # nested helpers are not the owner
        for f in fn:
            if f.lower().rsplit('.', 1)[-1] in VISUAL_EXT:
                p = os.path.join(dp, f)
                from datetime import datetime, timezone
                mt = datetime.fromtimestamp(os.path.getmtime(p), timezone.utc)
                files.append((p, mt, start is None or start <= mt <= end))
    return files


def check(db, r):
    result = r['result'] or ''
    owners = owner_runs(db, r)
    pending = [o['id'] for o in owners if o['status'] in ('queued', 'running') and o['id'] != r['id']]
    ev = {'run_id': r['id'], 'conversation_id': r['conversation_id'], 'checked_at': R.iso(R.now()),
          'visual_owner_profile': R.visual_owner_profile(), 'owners': [], 'deliverables': []}
    if pending:
        return {**ev, 'verdict': 'wait', 'reason': f'visual owner still running: {pending}'}
    dels = deliverables(result)
    if not dels:
        return {**ev, 'verdict': 'pass', 'reason': 'no visual files delivered'}
    good_owners = []
    for o in owners:
        ok, info = owner_ok(o)
        ev['owners'].append({**info, 'model_ok': ok})
        if ok and (o['status'] == 'done' or o['id'] == r['id']):
            good_owners.append(o)
    index = []  # (path, sha, vhash-lazy, owner, in_window, named_in_owner_events)
    for o in good_owners:
        text = events_text(o['conversation_id'])
        for p, mt, inwin in owner_files(o):
            index.append({'path': p, 'owner': o, 'in_window': inwin, 'in_events': os.path.basename(p) in text})
    bad = []
    for d in dels:
        hp = host(d)
        rec = {'path': d, 'sha256': sha(hp)}
        match = None
        for it in index:
            it.setdefault('sha256', sha(it['path']))
            if it['sha256'] == rec['sha256'] and it['in_window'] and it['in_events']:
                match = it, 'sha256'
                break
        if not match and hp.lower().rsplit('.', 1)[-1] in VIDEO_EXT:
            vh = video_stream_hash(hp)
            rec['video_stream_sha256'] = vh
            for it in index:
                if vh and it['path'].lower().rsplit('.', 1)[-1] in VIDEO_EXT and it['in_window'] and it['in_events']:
                    if 'vhash' not in it:
                        it['vhash'] = video_stream_hash(it['path'])
                    if it['vhash'] == vh:
                        match = it, 'video_stream_sha256 (audio muxed after)'
                        break
        if match:
            it, how = match
            rec.update(ok=True, matched=it['path'], how=how, owner_conversation=it['owner']['conversation_id'],
                       owner_model=it['owner']['model'])
        else:
            rec['ok'] = False
            bad.append(d)
        ev['deliverables'].append(rec)
    if bad:
        why = ('no visual-owner conversation for this job' if not owners else
               'no visual-owner conversation ran only on the owner model' if not good_owners else
               'not produced by the visual-owner conversation')
        return {**ev, 'verdict': 'reject', 'reason': f'{len(bad)} visual file(s) {why}: ' + ', '.join(bad)}
    return {**ev, 'verdict': 'pass', 'reason': f'{len(dels)} visual file(s) traced to the visual owner'}


def write_log(r, ev):
    d = os.path.join(host(r['working_dir'] or f"/workspace/jobs/{r['conversation_id']}"), 'log')
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, 'visual-gate.json')
    hist = []
    try:
        hist = json.load(open(path)).get('history', [])
    except Exception:
        pass
    hist.append({k: ev[k] for k in ('checked_at', 'verdict', 'reason')})
    json.dump({**ev, 'history': hist}, open(path, 'w'), indent=2, default=str)
    return sum(1 for h in hist if h['verdict'] == 'reject')
