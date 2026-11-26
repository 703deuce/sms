"""Before/after per test: status, true cost, wall time, front-desk start prompt tokens, final reply. No model calls."""
import json, os, sys, sqlite3
from datetime import datetime
db = sqlite3.connect('/opt/agent/workspace/runs/runs.db'); db.row_factory = sqlite3.Row
T = json.load(open('/opt/agent/ops/tests18.json'))
ST = json.load(open(sys.argv[1]))
RATES = {'opus': (4, 20, 0.4, 5), 'fable': (8, 40, 0.8, 10), 'haiku': (0.10, 0.50, 0.01, 0.125)}
def fam(m):
    m = (m or '').lower()
    return 'opus' if 'opus' in m else 'fable' if 'fable' in m else 'haiku'
def usage(cid):
    try:
        s = json.load(open('/opt/agent/workspace/conversations/%s/base_state.json' % cid.replace('-', '')))
    except Exception:
        return None
    out = []
    for u, m in (s.get('stats') or {}).get('usage_to_metrics', {}).items():
        a = m.get('accumulated_token_usage') or {}
        tu = [t for t in m.get('token_usages', []) if t.get('prompt_tokens', 0) > 3000]
        out.append((u, a, tu[0]['prompt_tokens'] if tu else None, m.get('model_name') or ''))
    return out
def cost(model, a):
    i, o, cr, cw = RATES[fam(model)]
    p, c, r, w = a.get('prompt_tokens', 0), a.get('completion_tokens', 0), a.get('cache_read_tokens', 0), a.get('cache_write_tokens', 0)
    unc = max(p - r - w, 0)
    return (unc * i + r * cr + w * cw + c * o) / 1e6, dict(input=unc, cache_write=w, cache_read=r, output=c)
def ts(x):
    return datetime.fromisoformat(x.replace('Z', '+00:00')).timestamp() if x else None
def tree(fid):
    fr = db.execute('SELECT * FROM runs WHERE id=?', (fid,)).fetchone(); root = fr['working_dir']
    return fr, db.execute('SELECT * FROM runs WHERE working_dir=? OR working_dir LIKE ? ORDER BY created_at', (root, root + '/%')).fetchall()
def summarize(fid):
    fr, rows = tree(fid)
    tot, tok, models, start, sts = 0, {'input': 0, 'cache_write': 0, 'cache_read': 0, 'output': 0}, [], None, []
    for r in rows:
        models.append(f"{r['kind'] or 'agent'}:{r['model']}:{r['status']}")
        u = usage(r['conversation_id']) if r['conversation_id'] else None
        for name, a, st, mn in (u or []):
            c, t = cost(mn or r['model'], a)
            tot += c
            for k in tok: tok[k] += t[k]
            if r['id'] == fid and name != 'condenser' and start is None:
                start = st
    t0 = min(ts(r['created_at']) for r in rows); t1 = max((ts(r['finished_at']) or t0) for r in rows)
    res = (fr['result'] or '')
    return dict(cost=round(tot, 4), tokens=tok, minutes=round((t1 - t0) / 60, 1), start_tokens=start, runs=models,
                status=fr['status'], result=res[:1500])
out = {}
for t in T:
    if t['id'] not in ST:
        continue
    out[t['id']] = {'name': t['name'], 'before': summarize(t['before_run']), 'after': summarize(ST[t['id']]['front'])}
print(json.dumps(out, indent=1))
