import json, os, sys, sqlite3, time
from datetime import datetime
db = sqlite3.connect('/opt/agent/workspace/runs/runs.db'); db.row_factory = sqlite3.Row
fid = sys.argv[1]
sk = json.load(open('/opt/agent/runner/state/skill-gate.json'))
fr = db.execute('SELECT * FROM runs WHERE id=?', (fid,)).fetchone(); root = fr['working_dir']
t0 = datetime.fromisoformat(fr['created_at'].replace('Z', '+00:00')).timestamp()
print('elapsed min', round((time.time() - t0) / 60, 1))
for r in db.execute('SELECT * FROM runs WHERE working_dir=? OR working_dir LIKE ? ORDER BY created_at', (root, root + '/%')):
    g = sk.get(r['id']) or {}
    last = (g.get('checks') or [{}])[-1]
    print(r['id'], r['kind'], r['model'], r['status'], r['last_event_at'], 'skills', [f"{x['slug']}:{x.get('path')}:{len(x['must'])}" for x in g.get('skills', [])],
          'gate', g.get('final'), 'sent_back', g.get('sent_back'), 'missing', len(last.get('missing') or []), 'failed', len(last.get('deliver_failed') or []), 'engines', g.get('engines'))
    host = (r['working_dir'] or '').replace('/workspace/', '/opt/agent/workspace/', 1)
    try:
        print('   out:', sorted(os.listdir(host + '/out'))[:12])
    except OSError:
        pass
