import sys, json, re, collections, statistics as S
from datetime import datetime
sys.path.insert(0,'/opt/agent/ops'); from oh import events
cid=sys.argv[1]; ev=events(cid)
T=lambda e: datetime.fromisoformat(e['timestamp'])
idx={e['id']:i for i,e in enumerate(ev)}
pre=[];post=[]
for i,e in enumerate(ev):
    if e['kind']!='HookExecutionEvent': continue
    # previous non-hook event
    j=i-1
    while j>=0 and ev[j]['kind'] in ('HookExecutionEvent','ConversationStateUpdateEvent'): j-=1
    d=(T(e)-T(ev[j])).total_seconds()
    (pre if e['hook_event_type']=='PreToolUse' else post).append((d,e['hook_event_type'],ev[j]['kind']))
print('hook gap after previous event: PreToolUse med/max', S.median([d for d,*_ in pre]), max(d for d,*_ in pre))
print('other hooks med/max', S.median([d for d,*_ in post]), max(d for d,*_ in post), collections.Counter((t,k) for _,t,k in post))
print('sum pre', sum(d for d,*_ in pre), 'sum other', sum(d for d,*_ in post))
acts=[e for e in ev if e['kind']=='ActionEvent']; obs={e['action_id']:e for e in ev if e['kind']=='ObservationEvent'}
rows=[]
for a in acts:
    o=obs.get(a['id'])
    if not o: continue
    d=(T(o)-T(a)).total_seconds()
    c=(a.get('action') or {}).get('command') or ''
    if a.get('tool_name')=='terminal': rows.append((d,c))
    if a.get('tool_name')=='agent_view':
        ar=(a.get('action') or {}).get('data') or a.get('action')
        txt=json.dumps(o.get('observation'))[:100000]
        print(f'VIEW {d:6.1f}s args={json.dumps(ar)[:300]} obslen={len(txt)} qa={"verdict" in txt.lower() or "PASS" in txt}')
print('--- mkdir chains')
for d,c in rows:
    if c.strip().startswith('mkdir'): print(f'{d:6.1f}s', c[:400].replace('\n',' | '))
print('--- for loops')
for d,c in rows:
    if c.strip().startswith('for '): print(f'{d:6.1f}s', c[:250].replace('\n',' | '))
print('--- slowest terminal')
for d,c in sorted(rows,reverse=True)[:25]: print(f'{d:6.1f}s', c[:300].replace('\n',' | '))
