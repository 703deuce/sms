import sys, json, re, collections
from datetime import datetime
sys.path.insert(0,'/opt/agent/ops'); from oh import events
cid=sys.argv[1]; ev=events(cid)
T=lambda e: datetime.fromisoformat(e['timestamp'])
def cmd_of(a):
    act=a.get('action') or {}
    return act.get('command') if isinstance(act.get('command'),str) else json.dumps(act.get('data') or act)[:300]
def cat(a):
    t=a.get('tool_name') or ''
    if t.startswith('agent_skill'): return 'skill/file reads'
    if t in ('agent_search','fetch_fetch'): return 'research (search/fetch tools)'
    if t in ('agent_view','agent_look'): return 'view/look'
    if t=='file_editor': return 'file edits'
    if t!='terminal': return 'other tool: '+t
    c=cmd_of(a) or ''
    for k,rx in [('yt-dlp / downloads','yt-dlp|gallery-dl|wget |curl -sL?o|curl .* -o '),('helper calls',r'\bhelper\b'),('watch-media/look (terminal)','watch-media|\blook\b'),
                 ('research (terminal search/readpage/curl)','\bsearch\b|readpage|curl '),('frame extraction / ffmpeg','ffmpeg|ffprobe'),
                 ('render (remotion/hyperframes/python engines)','remotion|hyperframes|render\.py|npx '),('python scripts','python3? '),
                 ('skill/file reads (terminal)','\bskill\b|/skills/|readfile|cat |sed -n|head |tail |rg |grep '),('ls/inspect','\bls\b|du |wc ')]:
        if re.search(rx,c): return k
    return 'other terminal'
acts=[e for e in ev if e['kind']=='ActionEvent']; obs={e['action_id']:e for e in ev if e['kind']=='ObservationEvent'}
model=0.0; tool=collections.defaultdict(float); cnt=collections.Counter(); slow=[]
prev_end=T(ev[0]); seen_resp=set(); last_obs_t=None; resp_n=0
# model time: per llm response, from the last event before its first action to that action
idx={e['id']:i for i,e in enumerate(ev)}
for a in acts:
    rid=a.get('llm_response_id')
    i=idx[a['id']]
    if rid not in seen_resp:
        seen_resp.add(rid); resp_n+=1
        j=i-1
        while j>0 and ev[j]['kind'] in ('ConversationStateUpdateEvent','HookExecutionEvent'): j-=1
        model+=(T(a)-T(ev[j])).total_seconds()
    o=obs.get(a['id'])
    if o:
        # sequential execution: start at max(action ts, previous observation ts)
        start=max(T(a), last_obs_t or T(a)); dur=(T(o)-start).total_seconds(); last_obs_t=T(o)
        c=cat(a); tool[c]+=dur; cnt[c]+=1
        txt=json.dumps(o.get('observation'))
        slow.append((dur,c,(cmd_of(a) or '')[:140].replace('\n',' '), 'exit=-1' if '"exit_code": -1' in txt else ''))
cond=[]
for i,e in enumerate(ev):
    if e['kind']=='Condensation': cond.append((T(e)-T(ev[i-1])).total_seconds())
wall=(T(ev[-1])-T(ev[0])).total_seconds()
print(f'wall {wall/60:.1f} min; llm responses {resp_n}; actions {len(acts)}')
print(f'model response time {model/60:.1f} min (avg {model/max(resp_n,1):.1f}s per response)')
print(f'tool/command time {sum(tool.values())/60:.1f} min'); 
for k,v in sorted(tool.items(), key=lambda x:-x[1]): print(f'  {k:48s} {v/60:6.1f} min  n={cnt[k]}  avg {v/cnt[k]:.0f}s')
print('condensation gaps (s):', [round(x) for x in cond])
print('slowest 15:'); 
for s in sorted(slow,reverse=True)[:15]: print(f'  {s[0]:6.0f}s {s[1]:30s} {s[3]} {s[2]}')
soft=[s for s in slow if s[3]]; print('soft timeouts (exit -1):', len(soft), round(sum(s[0] for s in soft)/60,1),'min')
# phases by order of first appearance
ph=[(T(a).strftime('%H:%M:%S'), cat(a)) for a in acts]
print('timeline (per 5 min, top category):')
b=collections.defaultdict(collections.Counter)
for a in acts: b[T(a).strftime('%H:')+str(T(a).minute//5*5).zfill(2)][cat(a)]+=1
for k in sorted(b): print(' ',k, dict(b[k].most_common(3)))
