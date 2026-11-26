"""Routing-test helper (operator side, no model calls). launch NAME TASK | status FRONT_RUN_ID | stop FRONT_RUN_ID"""
import sys, os, json, sqlite3, urllib.request, time
from datetime import datetime, timezone
sys.path.insert(0, '/opt/agent/tools'); os.environ.setdefault('RUNS_DB', '/opt/agent/workspace/runs/runs.db')
import runlib as R
db = R.connect()
P = {'opus': (4e-6, 20e-6), 'haiku': (1e-7, 5e-7), 'fable': (8e-6, 40e-6)}
def fam(m):
    m = (m or '').lower()
    return next((k for k in P if k in m), None)
def true_cost(cid):
    p = f"/opt/agent/workspace/conversations/{cid.replace('-', '')}/base_state.json"
    if not os.path.exists(p):
        return None, {}
    s = json.load(open(p)); model = s['agent']['llm'].get('model'); f = fam(model)
    tot = {'in': 0, 'cw': 0, 'cr': 0, 'out': 0}
    for u, m in (s.get('stats', {}).get('usage_to_metrics') or {}).items():
        t = m['accumulated_token_usage']
        tot['in'] += t['prompt_tokens'] - t['cache_read_tokens'] - t['cache_write_tokens']
        tot['cw'] += t['cache_write_tokens']; tot['cr'] += t['cache_read_tokens']; tot['out'] += t['completion_tokens']
    i, o = P.get(f, (0, 0))
    tot['usd'] = tot['in'] * i + tot['cw'] * i * 1.25 + tot['cr'] * i * 0.1 + tot['out'] * o
    tot['model'] = model
    return f, tot
def tree(front):
    fr = db.execute('SELECT * FROM runs WHERE id=?', (front,)).fetchone()
    root = fr['working_dir']
    rows = db.execute('SELECT * FROM runs WHERE working_dir=? OR working_dir LIKE ? ORDER BY created_at', (root, root + '/%')).fetchall()
    return fr, rows
cmd = sys.argv[1]
if cmd == 'launch':
    name, task = sys.argv[2], sys.argv[3]
    q = task.replace("'", "'\\''")
    prompt = ("[Routing test from the operator] Start exactly one background job by running this command in the terminal, "
              f"unchanged, then reply in one short line and end your turn. When its result arrives, reply with it.\n\n"
              f"job start '{q}' --name '{name}'")
    rid, cid = R.enqueue(db, prompt, 'user', title=name, model='lab-anthropic')
    print(rid, cid)
elif cmd == 'status':
    fr, rows = tree(sys.argv[2])
    t0 = R.parse_iso(fr['created_at'])
    allu = 0
    for r in rows:
        f, t = true_cost(r['conversation_id'])
        end = R.parse_iso(r['finished_at']) if r['finished_at'] else datetime.now(timezone.utc)
        wc = db.execute('SELECT work_class FROM jobs WHERE run_id=?', (r['id'],)).fetchone()
        allu += t.get('usd', 0) if t else 0
        print(f"{r['id']} {r['kind'] or 'agent':12} {r['status']:8} {f or r['model']:6} wc={wc[0] if wc else '-':6} "
              f"min={(end - R.parse_iso(r['created_at'])).total_seconds()/60:5.1f} "
              + (f"in={t['in']} cw={t['cw']} cr={t['cr']} out={t['out']} true=${t['usd']:.4f} " if t else '')
              + f"{(r['title'] or '')[:50]!r} fail={r['failures']} err={(r['error'] or '')[:80]!r}")
    print(f"TOTAL true=${allu:.4f}; elapsed since launch {(datetime.now(timezone.utc)-t0).total_seconds()/60:.1f} min")
    for n in db.execute("SELECT kind,title,substr(body,1,200) b,created_at FROM notifications WHERE created_at>=? AND "
                        "(lower(title) LIKE '%gate%' OR lower(body) LIKE '%gate%' OR kind='alert') ORDER BY id", (fr['created_at'],)):
        print('NOTE', n['created_at'], n['kind'], n['title'][:80], '|', n['b'].replace('\n', ' ')[:160])
elif cmd == 'stop':
    sys.path.insert(0, '/opt/agent/runner'); import agentd as A
    fr, rows = tree(sys.argv[2])
    for r in rows:
        try:
            st = A.api('GET', f"/api/conversations/{r['conversation_id']}", timeout=20).get('execution_status')
        except Exception as e:
            st = f'? {str(e)[:60]}'
        if st in ('running', 'idle') or r['status'] in ('running', 'queued'):
            try:
                A.api('POST', f"/api/conversations/{r['conversation_id']}/pause", {}, timeout=30); print('paused', r['id'], st)
            except Exception as e:
                print('pause failed', r['id'], str(e)[:80])
            if r['status'] in ('running', 'queued'):
                db.execute("UPDATE runs SET status='stopped', finished_at=?, error=COALESCE(error,'stopped by operator (test cap)') WHERE id=?", (R.iso(R.now()), r['id']))
        else:
            print('idle/finished', r['id'], r['status'], st)
