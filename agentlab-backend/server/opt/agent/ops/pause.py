import sys; sys.path.insert(0,'/opt/agent/ops'); from oh import api
print(api('POST',f'/api/conversations/{sys.argv[1]}/pause', timeout=900))
