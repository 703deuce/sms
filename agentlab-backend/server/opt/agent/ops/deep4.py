import sys, json, statistics as S, collections
from datetime import datetime
sys.path.insert(0,'/opt/agent/ops'); from oh import events
ev=events(sys.argv[1]); T=lambda e: datetime.fromisoformat(e['timestamp'])
acts=[e for e in ev if e['kind']=='ActionEvent']
nresp=collections.Counter(a.get('llm_response_id') for a in acts)
print('responses', len(nresp), 'multi-action responses', sum(1 for v in nresp.values() if v>1), 'max actions/resp', max(nresp.values()))
g=[]
for i,e in enumerate(ev):
    if e['kind']=='HookExecutionEvent' and e['hook_event_type']=='PreToolUse':
        j=i-1
        while ev[j]['kind']!='ActionEvent': j-=1
        p=ev[j]
        if True and nresp[p.get('llm_response_id')]==1: g.append((T(e)-T(p)).total_seconds())
print('single-action pre-hook gap n=%d median=%.3f p90=%.3f max=%.2f sum=%.1f'%(len(g),S.median(g),sorted(g)[int(len(g)*.9)],max(g),sum(g)))
# context size per call

seq=[e['kind'][:6] for e in ev[100:130]]; print(seq)
