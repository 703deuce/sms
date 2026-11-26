import sys, json; sys.path.insert(0,'/opt/agent/ops'); from oh import api
print(api('POST','/api/conversations/518c040f-5006-4fc1-8d0e-c6ab5b92e977/pause'))
for n,t in (('agent',900000),('fetch',120000),('docs',120000)):
    r=api('PATCH',f'/api/settings/mcp/{n}',{'timeout':t}); print(n, r.get('_http_error'), r.get('body','')[:200])
print(json.dumps({k:v.get('timeout') for k,v in api('GET','/api/settings')['agent_settings']['mcp_config'].items()}))
