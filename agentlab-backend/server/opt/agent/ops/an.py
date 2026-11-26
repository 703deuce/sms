import sys, json, collections
sys.path.insert(0,'/opt/agent/ops'); from oh import api, events
cid = sys.argv[1]
info = api('GET', f'/api/conversations/{cid}')
um = (info.get('stats') or {}).get('usage_to_metrics') or {}
print('status', info.get('execution_status'), 'title', info.get('title'), 'created', info.get('created_at'), 'updated', info.get('updated_at'))
print('model', (info.get('agent') or {}).get('llm',{}).get('model'))
for k,v in um.items(): print('cost', k, v.get('accumulated_cost'), 'tokens', (v.get('accumulated_token_usage') or {}).get('prompt_tokens'))
ev = events(cid)
print('events', len(ev), ev[0]['timestamp'], ev[-1]['timestamp'])
kinds = collections.Counter(e['kind'] for e in ev); print(kinds)
tools = collections.Counter(e.get('tool_name') for e in ev if e['kind']=='ActionEvent'); print(tools)
def text(c): return '\n'.join(x.get('text','') for x in (c or []) if isinstance(x, dict))
cmds = collections.Counter()
for e in ev:
    if e['kind']=='ActionEvent' and e.get('tool_name')=='terminal':
        c=(e.get('action') or {}).get('command') or ''
        cmds[c.split()[0] if c.split() else '']+=1
print('cmd heads', cmds.most_common(25))
for i,e in enumerate(ev):
    k=e['kind']
    if k=='MessageEvent':
        t=text(e['llm_message']['content'])
        print(f"#{i} {e['timestamp'][:19]} MSG {e['source']}: {t[:int(sys.argv[2]) if len(sys.argv)>2 else 300]!r}")
    elif k in ('AgentErrorEvent','ConversationErrorEvent','Condensation','CondensationSummaryEvent','PauseEvent','ConversationStateUpdateEvent'):
        if k=='ConversationStateUpdateEvent': continue
        print(f"#{i} {e['timestamp'][:19]} {k}: {str(e.get('error') or e.get('detail') or e.get('summary') or '')[:300]!r}")
    elif k=='ObservationEvent' and 'not found' in text((e.get('observation') or {}).get('content')).lower()[:300] and e.get('tool_name')!='terminal':
        print(f"#{i} OBS {e.get('tool_name')}: {text(e['observation'].get('content'))[:200]!r}")
