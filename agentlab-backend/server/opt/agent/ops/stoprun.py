import sys; sys.path.insert(0,'/opt/agent/ops'); from oh import api
print(api('POST','/api/conversations/4b794183-c64e-440c-89d5-6311f646ee61/pause'))
d=api('GET','/api/conversations/search?limit=30')
print('live:', [(c['id'][:8],c.get('execution_status')) for c in d.get('items',[]) if c.get('execution_status') in ('running',)])
