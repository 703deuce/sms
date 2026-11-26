import sys, json, re, collections
from datetime import datetime
sys.path.insert(0,'/opt/agent/ops'); from oh import events, api
cid=sys.argv[1]; ev=events(cid)
T=lambda e: datetime.fromisoformat(e['timestamp'])
kinds=collections.Counter(e['kind'] for e in ev); print(kinds)
# hooks
hooks=[e for e in ev if e['kind']=='HookExecutionEvent']
if hooks:
    print('hook keys', list(hooks[0].keys()))
    hk=collections.defaultdict(list)
    for h in hooks:
        d=h.get('duration_ms') or h.get('duration') or (h.get('result') or {}).get('duration_ms')
        hk[(h.get('hook_event_type') or h.get('event_type'), h.get('hook_command') or h.get('command'))].append(d)
    for k,v in hk.items(): print('hook',k,len(v), 'durs sample', v[:5])
# token usage per llm call
acts=[e for e in ev if e['kind']=='ActionEvent']
a0=acts[len(acts)//2]; print('action keys', list(a0.keys()))
mm=[e for e in ev if 'metrics' in e or e['kind'] in ('MetricsEvent',)]
print('metric events', len(mm))
info=api('GET',f'/api/conversations/{cid}')
st=info.get('stats') or info.get('metrics') or {}
s=json.dumps(st)[:3000]; print('stats', s)
llm=(info.get('agent') or {}).get('llm') or {}
print('llm cfg', {k:llm.get(k) for k in ('model','reasoning_effort','extended_thinking_budget','caching_prompt','temperature','max_output_tokens','native_tool_calling','enable_encrypted_reasoning','litellm_extra_body')})
