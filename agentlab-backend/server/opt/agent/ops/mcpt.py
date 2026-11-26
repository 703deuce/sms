import sys, json; sys.path.insert(0,'/opt/agent/ops'); from oh import api
import time
for tool,args in (('mcp_find',{'query':'context7'}),('recall',{'query':'x'}),('mcp_list',{})):
    t=time.time()
    r=api('POST','/api/mcp/test',{'name':'agent','server':{'command':'/opt/tools/agent-mcp','args':['--job','auto'],'transport':'stdio','timeout':300},'timeout':60,'tool_call':{'name':tool,'arguments':args}})
    print(tool, round(time.time()-t,1), json.dumps(r.get('tool_result') or r)[:400])
