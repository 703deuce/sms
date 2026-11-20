#!/usr/bin/env python3
"""One-shot Producer handoff: upload bundle, start self-hosted render, exit."""
from __future__ import annotations
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import datetime
import math
from urllib.parse import urljoin, urlparse
import requests

SESSION=requests.Session()

class TerminalJobError(RuntimeError):pass

def fail(message):
    raise RuntimeError(message)

def request(method,url,token,data=None):
    response=SESSION.request(method,url,headers={"Authorization":"Bearer "+token},
                             json=data,timeout=(20,180),allow_redirects=False)
    if not response.ok:
        if response.status_code in (401,403,409):
            raise TerminalJobError("Job assignment ended or authorization expired")
        fail("Job API rejected request (HTTP "+str(response.status_code)+")")
    return response.json()

def upload(joburl,token,filename,src):
    size=src.stat().st_size
    if not 0<size<=2_000_000_000:fail("Invalid bundle size")
    hash=hashlib.sha256()
    with src.open("rb") as fh:
        for block in iter(lambda:fh.read(1024*1024),b""):hash.update(block)
    reply=request("POST",joburl+"/assets",token,{"action":"prepare","filename":filename,
       "kind":"project","mime":"application/zip","bytes":size,
       "sha256":hash.hexdigest(),"resume":True})
    if reply.get("exists"):return
    mode=reply.get("mode")
    parts=[]
    if mode=="signed_put":
        with src.open("rb") as fh:
            r=SESSION.put(reply["signedPut"]["url"],data=fh,timeout=900,
                headers={"Content-Type":"application/zip"},allow_redirects=False)
            r.raise_for_status()
    elif mode=="s3_multipart":
        detail=reply["s3Multipart"]
        with src.open("rb") as fh:
            for item in detail["partUrls"]:
                fh.seek((item["partNumber"]-1)*detail["partSize"])
                r=SESSION.put(item["url"],data=fh.read(detail["partSize"]),
                    timeout=900,allow_redirects=False)
                r.raise_for_status()
                etag=r.headers.get("ETag")
                if not etag:fail("Multipart upload missing ETag")
                parts.append({"partNumber":item["partNumber"],"etag":etag})
    elif mode=="tus":
        info=reply["tus"]
        meta={"bucketName":info["bucket"],"objectName":info["objectKey"],
              "contentType":"application/zip"}
        encoded=",".join(k+" "+base64.b64encode(v.encode()).decode()
                         for k,v in meta.items())
        heads={"Tus-Resumable":"1.0.0","x-signature":info["token"]}
        r=SESSION.post(info["endpoint"],headers={**heads,"Upload-Length":str(size),
            "Upload-Metadata":encoded},timeout=180,allow_redirects=False)
        r.raise_for_status()
        location=urljoin(info["endpoint"],r.headers["Location"])
        if urlparse(location).netloc!=urlparse(info["endpoint"]).netloc:
            fail("Upload target changed")
        with src.open("rb") as fh:
            offset=0
            while offset<size:
                chunk=fh.read(6*1024*1024)
                rr=SESSION.patch(location,data=chunk,headers={**heads,
                    "Upload-Offset":str(offset),"Content-Type":"application/offset+octet-stream"},
                    timeout=900,allow_redirects=False)
                rr.raise_for_status()
                offset+=len(chunk)
                if rr.headers.get("Upload-Offset")!=str(offset):fail("Upload offset mismatch")
    else:fail("Unsupported bundle upload transport")
    request("POST",joburl+"/assets",token,{"action":"commit",
            "uploadId":reply["uploadId"],"parts":parts})

def main():
    if len(sys.argv)!=2:fail("Usage: submit.sh JOB_DIR")
    jobdir=Path(sys.argv[1]).resolve()
    jobid=os.environ.get("MOTION_JOB_ID","")
    url=os.environ.get("MOTION_JOB_URL","")
    token=os.environ.get("MOTION_JOB_TOKEN","")
    backend=os.environ.get("RENDER_BACKEND","self_hosted")
    fallback=os.environ.get("MOTION_MODAL_FALLBACK","0")=="1"
    if not re.fullmatch(r"msaj_[A-Za-z0-9-]{4,100}",jobid):fail("Invalid job ID")
    parsed=urlparse(url)
    if (parsed.scheme!="https" or parsed.hostname!="transovo.ai" or parsed.username or
        parsed.password or parsed.query or parsed.fragment or
        parsed.path!="/api/motion-studio/agent/jobs/"+jobid):fail("Invalid job URL")
    if not token:fail("Missing job credential")
    if backend not in ("self_hosted","modal"):fail("Unknown render backend")
    output=jobdir/"deliver_modal"/"submit.json"
    reuse=jobdir/"deliver_modal"/"reuse.json"
    original=json.loads(reuse.read_text()) if reuse.is_file() else {}
    original_frames=original.get("segmentFrames")
    archive=jobdir/"deliver_modal"/os.environ.get("MOTION_BUNDLE_FILENAME","render_bundle_v1.zip")
    if not archive.is_file():fail("Verified render bundle does not exist")
    if output.is_file() and os.environ.get("FORCE_RESUBMIT")!="1":
        fail("Render already submitted; override only after checking status")
    import zipfile
    with zipfile.ZipFile(archive) as f:
        project=json.loads(f.read("project.json"))
        count=int(project["frameCount"])
        if count<=0:fail("Bundle frame count invalid")
    receipts=jobdir/"state"/"receipts.json"
    if original_frames is None and receipts.exists():
        try:
            records=json.loads(receipts.read_text()).get("receipts",[])
            spans=[]
            import re as regex
            for record in records:
                matched=regex.fullmatch(r"modal_seg_v1_cpu_(\d{8})_(\d{8})\.mp4",
                                       str(record.get("filename","")))
                if matched:
                    spans.append(int(matched.group(2))-int(matched.group(1)))
            if spans:original_frames=max(spans)
        except (ValueError,KeyError):pass
    default_frames=min(450,max(150,math.ceil(math.ceil(count/96)/30)*30))
    segment_frames=int(os.environ.get("MOTION_SEGMENT_FRAMES",
                         str(original_frames if original_frames else default_frames)))
    if not 1<=segment_frames<=600:fail("Invalid segment length")
    if original_frames is not None and segment_frames!=int(original_frames):
        fail("Retry must reuse original segment length")
    dry=os.environ.get("DRY_RUN")=="1"
    benchmark=(os.environ.get("MOTION_BENCHMARK_ONLY")=="1" or
               os.environ.get("RENDER_BENCHMARK_ONLY")=="1")
    film_minutes=round(count/float(project["fps"])/60,2)
    metadata={"backend":backend,"jobId":jobid,"mode":os.environ.get("MOTION_MODE","cpu"),
              "segmentFrames":segment_frames,"segments":(count+segment_frames-1)//segment_frames,
              "filmMinutes":film_minutes,
              "submittedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "bundle":archive.name,"benchmarkOnly":benchmark}
    if dry:
        print(json.dumps({"dryRun":True,**metadata}))
        return
    upload(url,token,archive.name,archive)
    exists=request("GET",url+"/render-asset?filename="+archive.name,token)
    if not exists.get("exists"):fail("Bundle registration not ready")
    if backend=="modal":
        modal_submit(jobdir,metadata)
    else:
        start=url+"/start-render"
        launched=False
        for attempt in range(2):
            try:
                response=request("POST",start,token,{
                  "bundle":archive.name,"segmentFrames":segment_frames,
                  "benchmarkOnly":metadata["benchmarkOnly"]})
                if response.get("queued") is not True:fail("Renderer did not acknowledge")
                metadata["renderId"]=response["jobId"]
                metadata["alreadyExists"]=response.get("alreadyExists",False)
                launched=True;break
            except TerminalJobError:
                raise
            except (requests.RequestException,RuntimeError):
                if attempt==0:time.sleep(2)
        if not launched:
            # A POST can time out after the worker already accepted it.
            # Query the authoritative internal queue before considering Modal.
            try: probe=request("GET",start,token)
            except (requests.RequestException,RuntimeError):
                fail("Renderer status uncertain; do not risk a second backend")
            stage=probe.get("stage")
            if stage in ("queued","running","rendering","qa_pass","uploaded","completed"):
                metadata["renderId"]=jobid
                metadata["alreadyExists"]=True
                launched=True
            elif stage=="unknown":
                if not fallback:fail("Private render worker unavailable; Modal fallback is disabled")
                modal_submit(jobdir,metadata)
            else:
                fail("Private render already failed or was cancelled; do not resubmit")
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(metadata,indent=2)+"\n")
    os.chmod(output,0o600)
    (output.parent/"submit_failed.json").unlink(missing_ok=True)
    print(json.dumps({"jobId":jobid,"backend":metadata["backend"],
       "segments":metadata["segments"],"status":"submitted"}))

def modal_submit(jobdir,metadata):
    kit=Path(__file__).resolve().parent
    if (os.environ.get("MODAL_DISABLED")=="1" or
        (kit/".modal_disabled").is_file() or
        (jobdir/".modal_disabled").is_file()):
        fail("Modal is explicitly disabled")
    # Use the original Modal submission setup, credentials and budget checks.
    original=kit/"modal_submit.sh"
    if not original.is_file():fail("Original Modal submission script unavailable")
    env={**os.environ,"MOTION_SEGMENT_FRAMES":str(metadata["segmentFrames"]),
         "MOTION_BENCHMARK_ONLY":"1" if metadata["benchmarkOnly"] else "0"}
    result=subprocess.run(["bash",str(original),str(jobdir),
                           metadata.get("mode","cpu")],env=env,
                          stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if result.returncode:fail("Explicit Modal submission failed")
    receipt=jobdir/"deliver_modal"/"modal_receipt.json"
    if not receipt.is_file():fail("Modal submission did not produce a call receipt")
    value=json.loads(receipt.read_text())
    if not isinstance(value.get("callId"),str):fail("Missing Modal call ID")
    metadata["backend"]="modal"
    metadata["callId"]=value["callId"]
    metadata["renderId"]=value["callId"]

if __name__=="__main__":
    try:main()
    except (RuntimeError,ValueError,KeyError,FileNotFoundError,requests.RequestException) as exc:
        # Never emit a traceback containing job tokens or signed storage URLs.
        if len(sys.argv)==2:
            try:
                failure=Path(sys.argv[1]).resolve()/"deliver_modal"/"submit_failed.json"
                failure.parent.mkdir(parents=True,exist_ok=True)
                failure.write_text(json.dumps({"failedAt":datetime.datetime.now(
                    datetime.timezone.utc).isoformat(),"type":type(exc).__name__})+"\n")
                os.chmod(failure,0o600)
            except OSError:pass
        print("Render handoff could not finish; check server status and the local job configuration.",
              file=sys.stderr)
        sys.exit(2)
