import json, glob, sys, sqlite3
d = sqlite3.connect('/opt/agent/workspace/runs/runs.db')
rid = sys.argv[1]
cid = d.execute('select conversation_id from runs where id=?', (rid,)).fetchone()[0]
base = '/opt/agent/workspace/conversations/%s' % cid.replace('-', '')
for f in sorted(glob.glob(base + '/events/*.json'))[:10]:
    e = json.load(open(f))
    if e.get('kind') == 'SystemPromptEvent':
        print('tool0 keys', list(e['tools'][0].keys()), json.dumps(e['tools'][0])[:300])
        dc = e.get('dynamic_context'); print('dynamic_context type', type(dc).__name__, len(json.dumps(dc)))
        if isinstance(dc, dict): print(list(dc.keys()), {k: len(str(v)) for k, v in dc.items()})
        names = []
        for t in e['tools']:
            n = t.get('name') or (t.get('function') or {}).get('name') or t.get('title') or (t.get('spec') or {}).get('name')
            names.append((len(json.dumps(t)), n))
        print(sorted(names, reverse=True))
        break
s = json.load(open(base + '/base_state.json'))
for u, m in s['stats']['usage_to_metrics'].items():
    print(u, [(t['prompt_tokens'], t['cache_read_tokens'], t['cache_write_tokens']) for t in m['token_usages'][:4]])
