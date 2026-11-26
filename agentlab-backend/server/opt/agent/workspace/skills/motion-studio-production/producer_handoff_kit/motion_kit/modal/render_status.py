#!/usr/bin/env python3
"""One authenticated status read; never echo signed links or job credentials."""
import json,os,re,sys,urllib.request
SENSITIVE=re.compile(r"(token|secret|key|auth|password|lease|url|signed|href|location)",re.I)
CONTENT=re.compile(r"https?://\S+|Bearer\s+\S+|eyJ[A-Za-z0-9_-]{10,}",re.I)
def red(v):
    if isinstance(v,dict):return {k:"[redacted]" if SENSITIVE.search(k) else red(x) for k,x in v.items()}
    if isinstance(v,list):return [red(x) for x in v]
    return CONTENT.sub("[redacted]",v) if isinstance(v,str) else v
req=urllib.request.Request(os.environ["MOTION_JOB_URL"]+"/render-status",
    headers={"Authorization":"Bearer "+os.environ["MOTION_JOB_TOKEN"]})
try:
    with urllib.request.urlopen(req,timeout=30) as r:
        print(json.dumps(red(json.loads(r.read().decode())),indent=1))
except Exception as e:
    print("Render status unavailable: "+type(e).__name__);sys.exit(2)
