import sys, os, json, glob, subprocess, sqlite3, re
W = '/opt/agent/workspace'
db = sqlite3.connect(W + '/runs/runs.db'); db.row_factory = sqlite3.Row
jl = subprocess.run("journalctl -u agent-lab-runner --no-pager --since '-3 hours' | grep 'skill router'", shell=True, capture_output=True, text=True).stdout
for rid in sys.argv[1:]:
    r = db.execute('select * from runs where id=?', (rid,)).fetchone()
    cid = r['conversation_id'].replace('-', '')
    d = f'{W}/conversations/{cid}'
    print('=' * 100); print(rid, r['title'], r['status'], 'started', r['started_at'], 'finished', r['finished_at'])
    for l in jl.splitlines():
        if rid in l: print('ROUTER:', l.split('skill router', 1)[1][:260])
    st = json.load(open(d + '/base_state.json'))
    peak = 0; ncalls = 0
    for u, m in (st['stats']['usage_to_metrics'] or {}).items():
        for t in m.get('token_usages') or []:
            peak = max(peak, t.get('prompt_tokens') or 0); ncalls += 1
    print(f'LLM calls={ncalls} peak_prompt_tokens={peak}')
    evs = []
    for f in sorted(glob.glob(d + '/events/*.json')):
        try: evs.append(json.load(open(f)))
        except Exception: pass
    big = []; tools = {}; cmds = []
    for e in evs:
        k = e.get('kind')
        if k == 'ActionEvent':
            tc = e.get('tool_call') or {}; args = tc.get('arguments') or ''
            try: a = json.loads(args)
            except Exception: a = {}
            c = a.get('command') or a.get('path') or ''
            if isinstance(c, str): cmds.append((e.get('tool_name'), c.replace('\n', ' ')[:170]))
            tools[e.get('tool_name')] = tools.get(e.get('tool_name'), 0) + 1
        if k == 'ObservationEvent':
            txt = json.dumps(e.get('observation') or {})
            if len(txt) > 10000: big.append((e.get('tool_name'), len(txt)))
    print('tool counts', tools)
    print('outputs >10K chars:', big or 'none')
    for t, c in cmds: print('  -', t, '|', c)
    used = {n: sum(1 for t, c in cmds if n in c) for n in ('read_section', '--find', 'qrun', '--digest', 'gitckpt', 'log/notes', 'helper', 'plan-check', 'rg ', 'grep ')}
    print('NEW-TOOL USE', used)
    fin = [e for e in evs if e.get('kind') == 'MessageEvent' and e.get('source') == 'agent']
    if fin:
        txt = ''.join(c.get('text', '') for c in (fin[-1].get('llm_message') or {}).get('content') or [])
        print('FINAL:', txt[:700].replace('\n', ' | '))
    print('job folder:', r['working_dir'], os.listdir(r['working_dir'].replace('/workspace', W)) if os.path.isdir(r['working_dir'].replace('/workspace', W)) else '')
