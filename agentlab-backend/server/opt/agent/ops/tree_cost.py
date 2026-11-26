import json, sys, sqlite3
RID = sys.argv[1]; sys.argv[1] = "/opt/agent/ops/pt_state_router.json"
exec(open('/opt/agent/ops/compare.py').read().split('out = {}')[0])
s = summarize(RID)
print(json.dumps({k: s[k] for k in ('cost', 'tokens', 'minutes', 'runs', 'start_tokens')}, indent=1))
fr, rows = tree(RID)
for r in rows:
    tot = 0; tk = {}
    for name, a, st, mn in (usage(r['conversation_id']) or []):
        c, t = cost(mn or r['model'], a); tot += c
        for k, v in t.items(): tk[k] = tk.get(k, 0) + v
    print(r['id'], r['kind'], r['model'], round(tot, 4), tk)
