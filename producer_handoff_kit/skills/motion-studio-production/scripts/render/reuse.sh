#!/bin/sh
set -eu
[ "$#" -eq 2 ] || { echo "Usage: reuse.sh NEW_JOB_DIR SOURCE_JOB_ID" >&2; exit 2; }
export RENDER_REUSE_JOB_DIR="$1"
export RENDER_REUSE_SOURCE="$2"
python3 - <<'PY'
import os,re,requests,json,hashlib,collections
from pathlib import Path
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
# Reuse the already-approved bundle without creating or reprocessing scenes.
folder=Path(os.environ["RENDER_REUSE_JOB_DIR"])/"deliver_modal"
folder.mkdir(parents=True,exist_ok=True)
source_bundle=next((x for x in items if x["filename"]=="render_bundle_v1.zip"),None)
if source_bundle:
    answer=session.get(url+"/render-asset",params={"filename":"render_bundle_v1.zip"},
                       headers=heads,timeout=30,allow_redirects=False)
    if not answer.ok or not answer.json().get("exists"):
        raise SystemExit("Reusable bundle was not registered")
    signed=answer.json()["url"]
    output=folder/"render_bundle_v1.zip"
    if not output.exists():
        dig=hashlib.sha256()
        with session.get(signed,stream=True,timeout=(30,240),allow_redirects=False) as src:
            src.raise_for_status()
            with output.open("wb") as dest:
                for chunk in src.iter_content(1024*1024):
                    dig.update(chunk);dest.write(chunk)
        if dig.hexdigest()!=source_bundle["sha256"]:
            output.unlink(missing_ok=True)
            raise SystemExit("Borrowed bundle failed checksum")
spans=[]
for item in items:
    match=re.fullmatch(r"modal_seg_v1_cpu_(\d{8})_(\d{8})\.mp4",item.get("filename",""))
    if match:spans.append(int(match.group(2))-int(match.group(1)))
size=collections.Counter(spans).most_common(1)[0][0] if spans else 150
(folder/"reuse.json").write_text(json.dumps({"sourceJobId":source,"segmentFrames":size,
                   "reusedCount":r.json().get("reused",0)},indent=2)+"\n")
print("Reused",r.json().get("reused",0),"ready render artifacts")
PY
