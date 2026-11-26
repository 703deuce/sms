import sys; sys.path.insert(0,'/opt/agent/ops'); from oh import api
r=api('PATCH','/api/settings',{'agent_settings_diff':{'agent_context':{'system_message_suffix':open('/opt/agent/AGENTS.md').read()}}})
s=r.get('agent_settings') or {}
print('suffix chars', len((s.get('agent_context') or {}).get('system_message_suffix') or ''), 'condenser', {k:(s.get('condenser') or {}).get(k) for k in ('max_size','keep_first')}, r.get('_http_error'))
