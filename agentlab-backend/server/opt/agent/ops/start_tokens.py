import json, sys, sqlite3
d = sqlite3.connect('/opt/agent/workspace/runs/runs.db')
for rid in sys.argv[1:]:
    cid, kind, src = d.execute('select conversation_id, kind, source from runs where id=?', (rid,)).fetchone()
    s = json.load(open('/opt/agent/workspace/conversations/%s/base_state.json' % cid.replace('-', '')))
    for u, m in s['stats']['usage_to_metrics'].items():
        if u == 'condenser': continue
        tu = [t for t in m['token_usages'] if t['prompt_tokens'] > 3000]
        print(rid, src, kind, u, 'start_prompt_tokens', tu[0]['prompt_tokens'] if tu else None, 'calls', len(m['token_usages']))
