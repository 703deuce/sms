import json, sqlite3
db = sqlite3.connect('/opt/agent/workspace/runs/runs.db'); db.row_factory = sqlite3.Row
cmp = json.load(open('/opt/agent/ops/cmp_router.json'))
st = json.load(open('/opt/agent/ops/pt_state_router.json'))
sk = json.load(open('/opt/agent/runner/state/skill-gate.json'))
print('| Test | Before cost | After cost | Before min | After min | Front start tokens before → after | Router picks per run (role: picks) | Gate |')
print('|---|---|---|---|---|---|---|---|')
for t, v in cmp.items():
    b, a = v['before'], v['after']
    fr = db.execute('SELECT working_dir FROM runs WHERE id=?', (st[t]['front'],)).fetchone()[0]
    picks, gates, rcost = [], [], 0
    for r in db.execute('SELECT id, kind, source FROM runs WHERE working_dir=? OR working_dir LIKE ? ORDER BY created_at', (fr, fr + '/%')):
        g = sk.get(r['id']) or {}
        ro = g.get('router') or {}
        rcost += ro.get('cost') or 0
        picks.append(f"{g.get('role', '?')}: {', '.join(x['slug'] + (':' + x['path'] if x.get('path') else '') for x in g.get('skills', [])) or 'none'}")
        if any(x['must'] or x.get('deliver_check') for x in g.get('skills', [])):
            gates.append(f"{g.get('final')}{' (sent back once)' if g.get('sent_back') else ''}")
    print(f"| {t} {v['name'][:30]} | ${b['cost']:.4f} | ${a['cost']:.4f} (+router ${rcost:.4f}) | {b['minutes']} | {a['minutes']} | {b['start_tokens']} → {a['start_tokens']} | {'; '.join(picks)} | {', '.join(gates) or 'n/a'} |")
