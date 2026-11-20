#!/bin/sh
set -eu
[ -n "$MOTION_JOB_URL" ] && [ -n "$MOTION_JOB_TOKEN" ] ||
  { echo "Job API credentials missing" >&2; exit 2; }
python3 - <<'PY'
import os,requests
url=os.environ["MOTION_JOB_URL"]+"/render-status"
r=requests.get(url,headers={"Authorization":"Bearer "+os.environ["MOTION_JOB_TOKEN"]},
               timeout=30,allow_redirects=False)
if r.status_code==200:
    d=r.json()
    print("job:",d.get("jobId"),"stage:",d.get("stage"),"segments:",
          str(d.get("completed",0))+"/"+str(d.get("total",0)))
else:
    print("Render status unavailable (HTTP "+str(r.status_code)+")")
    raise SystemExit(2)
PY
