#!/usr/bin/env python3
"""Borrow ready bundle and segments from a source job into the retry job."""
import argparse,hashlib,json,os,re,sys,urllib.parse,urllib.request
from pathlib import Path
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
# Preserve the prior completed bundle as immutable local ZIP for the
# submitter's project metadata and the dry-run path. Never rebuild the film.
bundle=next((r for r in wanted if r.get("filename")==a.bundle),None)
if not bundle or not re.fullmatch(r"[a-f0-9]{64}",str(bundle.get("sha256",""))):
    sys.exit("Reusable bundle receipt lacks SHA-256")
asset_req=urllib.request.Request(base+"/render-asset?"+
    urllib.parse.urlencode({"filename":a.bundle}),
    headers={"Authorization":"Bearer "+token})
try:
    with urllib.request.urlopen(asset_req,timeout=40) as endpoint:
        info=json.loads(endpoint.read().decode())
    if not info.get("exists"):sys.exit("Borrowed bundle not readable")
    signed=info["url"]
    target=Path(a.job_dir).resolve()/"deliver_modal"/a.bundle
    target.parent.mkdir(parents=True,exist_ok=True)
    if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest()!=bundle["sha256"]:
        digest=hashlib.sha256()
        staging=target.with_suffix(".partial")
        with urllib.request.urlopen(signed,timeout=240) as source,open(staging,"wb") as out:
            total=0
            while True:
                chunk=source.read(1024*1024)
                if not chunk:break
                total+=len(chunk)
                if total>2_000_000_000:sys.exit("Source bundle over limit")
                digest.update(chunk);out.write(chunk)
        if digest.hexdigest()!=bundle["sha256"]:
            staging.unlink(missing_ok=True)
            sys.exit("Borrowed bundle integrity check failed")
        os.replace(staging,target)
except Exception as exc:
    sys.exit("Could not fetch immutable retry bundle: "+type(exc).__name__)
print("reused:",response.get("reused",0))
