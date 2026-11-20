#!/bin/sh
set -eu
[ "$#" -eq 2 ] || { echo "Usage: reuse.sh NEW_JOB_DIR SOURCE_JOB_ID" >&2; exit 2; }
export RENDER_REUSE_JOB_DIR="$1"
export RENDER_REUSE_SOURCE="$2"
python3 - <<'PY'
import os,re,requests
url=os.environ["MOTION_JOB_URL"]
token=os.environ["MOTION_JOB_TOKEN"]
source=os.environ["RENDER_REUSE_SOURCE"]
if not re.fullmatch(r"msaj_[A-Za-z0-9-]{4,100}",source):
    raise SystemExit("Invalid source job ID")
if not url.startswith("https://transovo.ai/api/motion-studio/agent/jobs/"):
    raise SystemExit("Invalid job URL")
heads={"Authorization":"Bearer "+token}
session=requests.Session()
r=session.post(url+"/assets",headers=heads,json={"action":"receipts","sourceJobId":source},
               timeout=60,allow_redirects=False)
if not r.ok:raise SystemExit("Could not read reusable receipts")
items=[a for a in r.json()["receipts"] if not a.get("currentJob") and (
    a.get("filename")=="render_bundle_v1.zip" or
    re.fullmatch(r"modal_seg_v1_cpu_\d{8}_\d{8}\.mp4",a.get("filename","")))]
ids=[a["id"] for a in items]
if not ids:raise SystemExit("No reusable render receipts; check source job")
r=session.post(url+"/assets",headers=heads,json={"action":"reuse",
        "sourceJobId":source,"ids":ids},timeout=60,allow_redirects=False)
if not r.ok:raise SystemExit("Could not register previous render segments")
print("Reused",r.json().get("reused",0),"ready render artifacts")
PY
