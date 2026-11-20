#!/usr/bin/env python3
"""Borrow ready bundle and segments from a source job into the retry job."""
import argparse,json,os,re,sys,urllib.request
ap=argparse.ArgumentParser()
ap.add_argument("job_dir");ap.add_argument("source_job_id")
ap.add_argument("--bundle",default="render_bundle_v1.zip")
ap.add_argument("--no-segments",action="store_true")
ap.add_argument("--dry-run",action="store_true")
a=ap.parse_args()
if not re.fullmatch(r"msaj_[0-9a-f-]{36}",a.source_job_id):sys.exit("Invalid source job")
st=os.path.join(os.path.abspath(a.job_dir),"state")
os.makedirs(st,exist_ok=True)
base=os.environ["MOTION_JOB_URL"].rstrip("/")
token=os.environ["MOTION_JOB_TOKEN"]
def post(body):
    req=urllib.request.Request(base+"/assets",data=json.dumps(body).encode(),method="POST",
       headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=120) as r:return json.loads(r.read().decode() or "{}")
    except Exception as e:
        sys.exit("Artifact API failed: "+type(e).__name__)
receipts=post({"action":"receipts","sourceJobId":a.source_job_id})
with open(os.path.join(st,"receipts.json"),"w") as fh:json.dump(receipts,fh,indent=1)
items=receipts.get("receipts",[])
wanted=[r for r in items if r.get("filename")==a.bundle or
    (not a.no_segments and str(r.get("filename","")).startswith("modal_seg_"))]
if not any(x.get("filename")==a.bundle for x in wanted):sys.exit("No ready source render bundle")
request={"action":"reuse","sourceJobId":a.source_job_id,"ids":[r["id"] for r in wanted]}
with open(os.path.join(st,"reuse_req.json"),"w") as fh:json.dump(request,fh,indent=1)
if a.dry_run:
    print("DRY RUN: no artifacts reused");sys.exit(0)
response=post(request)
with open(os.path.join(st,"reuse_resp.json"),"w") as fh:json.dump(response,fh,indent=1)
print("reused:",response.get("reused",0))
