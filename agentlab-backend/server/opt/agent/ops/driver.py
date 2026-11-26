"""Run the 18 tests, max 4 at a time, 15-minute cap each; writes /opt/agent/ops/pt_state.json. No model calls of its own."""
import json, os, sys, time, sqlite3
sys.path.insert(0, '/opt/agent/tools'); sys.path.insert(0, '/opt/agent/runner')
os.environ.setdefault('RUNS_DB', '/opt/agent/workspace/runs/runs.db')
import runlib as R
import agentd as A
db = R.connect()
T = json.load(open('/opt/agent/ops/tests18.json'))
ST = '/opt/agent/ops/pt_state.json'
state = json.load(open(ST)) if os.path.exists(ST) else {}
CAP, CONC = 15 * 60, 4
def tree(fid):
    fr = db.execute('SELECT * FROM runs WHERE id=?', (fid,)).fetchone(); root = fr['working_dir']
    return fr, db.execute('SELECT * FROM runs WHERE working_dir=? OR working_dir LIKE ?', (root, root + '/%')).fetchall()
def launch(t):
    if t['mode'] == 'job':
        q = t['prompt'].replace("'", "'\\''")
        p = ("[Routing test from the operator] Start exactly one background job by running this command in the terminal, "
             "unchanged, then reply in one short line and end your turn. When its result arrives, reply with it.\n\n"
             f"job start '{q}' --name '{t['name']}'")
    else:
        p = t['prompt']
    rid, cid = R.enqueue(db, p, 'user', title=t['id'] + ' ' + t['name'], model='lab-anthropic')
    return rid
def stop(rows):
    for r in rows:
        if r['status'] in ('running', 'queued'):
            try: A.api('POST', f"/api/conversations/{r['conversation_id']}/pause", {}, timeout=30)
            except Exception: pass
            db.execute("UPDATE runs SET status='stopped', finished_at=?, error='stopped: 15-minute test cap' WHERE id=?", (R.iso(R.now()), r['id']))
while True:
    now = time.time()
    active = [k for k, v in state.items() if v.get('end') is None]
    for k in active:
        v = state[k]; fr, rows = tree(v['front'])
        busy = any(r['status'] in ('running', 'queued') for r in rows)
        if now - v['start'] > CAP:
            stop(rows); v['end'] = now; v['capped'] = True; continue
        if not busy and now - v['start'] > 45:
            v['idle'] = v.get('idle', 0) + 1
            if v['idle'] >= 3:  # idle for 3 checks (~60 s): the front desk has replied to the delivered result
                v['end'] = now
        else:
            v['idle'] = 0
    pending = [t for t in T if t['id'] not in state]
    active = [k for k, v in state.items() if v.get('end') is None]
    while pending and len(active) < CONC:
        t = pending.pop(0); rid = launch(t)
        state[t['id']] = {'front': rid, 'start': time.time(), 'end': None}; active.append(t['id']); time.sleep(4)
    json.dump(state, open(ST, 'w'), indent=1)
    if not pending and not active:
        break
    time.sleep(20)
print('ALL DONE')
