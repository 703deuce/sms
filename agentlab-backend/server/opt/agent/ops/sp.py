import json, glob, sys, sqlite3
d = sqlite3.connect('/opt/agent/workspace/runs/runs.db')
for rid in sys.argv[1:]:
    cid = d.execute('select conversation_id from runs where id=?', (rid,)).fetchone()[0]
    base = '/opt/agent/workspace/conversations/%s' % cid.replace('-', '')
    fs = sorted(glob.glob(base + '/events/*.json'))
    sp = None
    for f in fs[:10]:
        e = json.load(open(f))
        if e.get('kind') == 'SystemPromptEvent':
            sp = e; break
    s = json.load(open(base + '/base_state.json'))
    m = s['stats']['usage_to_metrics']
    u = next(iter(m.values()))
    first = (u.get('token_usages') or [{}])[0]
    print('==', rid, s['agent']['llm'].get('model'), 'first call prompt tokens:', first.get('prompt_tokens'), 'cw', first.get('cache_write_tokens'), 'cr', first.get('cache_read_tokens'))
    if sp:
        txt = sp.get('system_prompt') or {}
        t = txt.get('text') if isinstance(txt, dict) else str(txt)
        print('system prompt chars', len(t or ''), 'keys', list(sp.keys()))
        tools = sp.get('tools') or []
        tot = 0
        rows = []
        for tl in tools:
            n = (tl.get('function') or tl).get('name') if isinstance(tl, dict) else str(tl)[:40]
            c = len(json.dumps(tl)); tot += c; rows.append((c, n))
        print('tools', len(tools), 'schema chars', tot)
        for c, n in sorted(rows, reverse=True): print('   ', c, n)
