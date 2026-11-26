import json, glob, sqlite3, collections, re
d = sqlite3.connect('/opt/agent/workspace/runs/runs.db'); d.row_factory = sqlite3.Row
rows = d.execute("select * from runs where created_at >= '2026-11-24T21:59' and conversation_id is not null").fetchall()
def role(r):
    if (r['kind'] or '') == 'visual-owner': return 'owner'
    if r['source'] == 'user': return 'front'
    if (r['title'] or '').startswith('[opus escalate]'): return 'escalate'
    return 'worker-' + ('opus' if 'opus' in (r['model'] or '') else 'haiku')
tools = collections.defaultdict(collections.Counter); cmds = collections.defaultdict(collections.Counter)
skills = collections.defaultdict(collections.Counter); nconv = collections.Counter()
for r in rows:
    ro = role(r); base = '/opt/agent/workspace/conversations/%s/events' % r['conversation_id'].replace('-', '')
    fs = glob.glob(base + '/*.json')
    if not fs: continue
    nconv[ro] += 1
    for f in fs:
        try: e = json.load(open(f))
        except Exception: continue
        if e.get('kind') != 'ActionEvent': continue
        tn = e.get('tool_name') or (e.get('action') or {}).get('kind') or '?'
        tools[ro][tn] += 1
        a = e.get('action') or {}
        if tn == 'terminal' and a.get('command'):
            for part in re.split(r'&&|\|\||;|\|', a['command']):
                w = part.strip().split()
                if w:
                    x = w[0] if w[0] not in ('cd', 'sudo', 'env', 'timeout', 'NODE_PATH=/opt/engines/js/node_modules') else (w[1] if len(w) > 1 else w[0])
                    cmds[ro][x.split('/')[-1][:24]] += 1
        if tn == 'agent_skill':
            skills[ro][str(a.get('name') or a.get('data', {}).get('name') or json.dumps(a)[:60])] += 1
for ro in sorted(nconv):
    print(f'== {ro}: {nconv[ro]} conversations')
    print('  tools:', dict(tools[ro].most_common(40)))
    print('  cmds :', dict(cmds[ro].most_common(45)))
    print('  skills:', dict(skills[ro]))
