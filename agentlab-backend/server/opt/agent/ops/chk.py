import sys, sqlite3, json, glob
sys.path.insert(0, '/opt/agent/runner'); import agentd as A
d = sqlite3.connect('/opt/agent/workspace/runs/runs.db')
for rid in sys.argv[1:]:
    cid, st, le = d.execute("select conversation_id,status,last_event_at from runs where id=?", (rid,)).fetchone()
    i = A.api('GET', f'/api/conversations/{cid}', timeout=20)
    fs = sorted(glob.glob('/opt/agent/workspace/conversations/%s/events/*.json' % cid.replace('-', '')))
    last = json.load(open(fs[-1])) if fs else {}
    print(rid, st, 'oh=', i.get('execution_status'), 'events', len(fs), 'last', last.get('timestamp'), last.get('kind'))
