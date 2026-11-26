import sys, json
sys.path.insert(0,'/opt/agent/ops'); from oh import events
ev=events(sys.argv[1])
acts=[e for e in ev if e['kind']=='ActionEvent']; obs={e['action_id']:e for e in ev if e['kind']=='ObservationEvent'}
for a in acts:
    c=(a.get('action') or {}).get('command') or ''
    if 'work/prep.py' in c and 'mkdir -p work/assets' in c:
        print(len(c), c.count('\n')); print(c[-1500:]); print('----OBS'); print(json.dumps(obs[a['id']].get('observation'))[:2500])
