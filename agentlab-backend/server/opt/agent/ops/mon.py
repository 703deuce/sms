import sys, json, collections; sys.path.insert(0,'/opt/agent/ops'); from oh import api, events
cid=sys.argv[1]; ev=events(cid); info=api('GET',f'/api/conversations/{cid}')
cost=sum((m or {}).get('accumulated_cost',0) for m in (info.get('stats',{}).get('usage_to_metrics') or {}).values())
tools=collections.Counter(); errs=[]
for e in ev:
    k=e.get('kind')
    if k=='ActionEvent': tools[e.get('tool_name')]+=1
    if k in ('AgentErrorEvent','ConversationErrorEvent'): errs.append((e.get('timestamp','')[11:19], (e.get('error') or e.get('detail') or '')[:160]))
print('status', info.get('execution_status'), 'events', len(ev), 'cost $%.3f'%cost, 'condensations', sum(1 for e in ev if e.get('kind')=='Condensation'))
print('tools', dict(tools)); print('errors', errs[-5:])
last=[e for e in ev if e.get('kind')=='ActionEvent'][-4:]
for e in last: print(' last:', e.get('timestamp','')[11:19], e.get('tool_name'), json.dumps(e.get('action') or {})[:220])
try:
    for l in open(f'/opt/agent/workspace/jobs/{cid}/log/read-manifest.jsonl'): r=json.loads(l); print(' read:', r.get('at','')[11:19], r['kind'], r.get('file') or r.get('images') or r.get('ids'), r.get('chars',''), r.get('verdict',''), r.get('delivery',''))
except FileNotFoundError: print(' no manifest yet')
