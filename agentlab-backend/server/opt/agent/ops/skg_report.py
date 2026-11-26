"""Per test: runs in the tree + skill-gate record (attached / read / final / engines)."""
import json, os, sys, sqlite3
db = sqlite3.connect('/opt/agent/workspace/runs/runs.db'); db.row_factory = sqlite3.Row
ST = sys.argv[1] if len(sys.argv) > 1 else '/opt/agent/ops/pt_state.json'
state = json.load(open(ST)); sk = json.load(open('/opt/agent/runner/state/skill-gate.json')) if os.path.exists('/opt/agent/runner/state/skill-gate.json') else {}
out = {}
for tid, v in state.items():
    fr = db.execute('SELECT * FROM runs WHERE id=?', (v['front'],)).fetchone(); root = fr['working_dir']
    rows = db.execute('SELECT id,status,source,kind,model,cost,started_at,finished_at FROM runs WHERE working_dir=? OR working_dir LIKE ? ORDER BY created_at', (root, root + '/%')).fetchall()
    runs = []
    for r in rows:
        g = sk.get(r['id'])
        e = {'id': r['id'], 'status': r['status'], 'kind': r['kind'], 'source': r['source'], 'model': r['model']}
        if g:
            last = (g.get('checks') or [{}])[-1]
            e['skills'] = [f"{s['slug']}({s['attached']}{', must ' + str(len(s['must'])) if s['must'] else ''})" for s in g['skills']]
            e['read'] = last.get('read'); e['missing'] = last.get('missing'); e['deliver_failed'] = last.get('deliver_failed')
            e['gate'] = g.get('final'); e['sent_back'] = g.get('sent_back'); e['engines'] = g.get('engines')
        runs.append(e)
    out[tid] = {'done': v.get('end') is not None, 'capped': v.get('capped'), 'runs': runs}
print(json.dumps(out, indent=1))
