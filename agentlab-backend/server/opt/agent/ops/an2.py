import sys, json
sys.path.insert(0,'/opt/agent/ops'); from oh import api, events
cid=sys.argv[1]; ev=events(cid)
for i,e in enumerate(ev[:8]): print(i, e['kind'], e.get('source'), str(e)[:150])
cs=[e for e in ev if e['kind']=='Condensation']
print('N condensations', len(cs))
print(json.dumps({k:v for k,v in cs[-1].items() if k!='forgotten_event_ids'})[:6000])
