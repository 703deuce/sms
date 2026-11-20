"""Private persistent Motion Studio rendering queue. Never publish this HTTP port."""
from __future__ import annotations
import concurrent.futures
import contextlib
import hmac
import json
import os
from pathlib import Path
import re
import shutil
import signal
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import requests

sys.path.insert(0, "/root/modal_motion")
sys.path.insert(1, str(Path(__file__).resolve().parents[1]/"modal_motion"))
import pipeline

WORK=Path(os.getenv("RENDER_WORK_DIR","/work")).resolve()
STATE=WORK/"queue.json"
SCRATCH=WORK/"tmp"
SECRET=os.getenv("RENDER_HOST_SECRET","")
HOST=os.getenv("RENDER_ALLOWED_JOB_HOST","transovo.ai")
WORKERS=max(1,min(32,int(os.getenv("RENDER_SEGMENT_WORKERS","2"))))
MAX_DISK=float(os.getenv("RENDER_DISK_MAX_PERCENT","90"))
JOB_TIMEOUT=int(os.getenv("RENDER_JOB_TIMEOUT_MIN","180"))*60
NICE=max(0,min(19,int(os.getenv("RENDER_NICE","10"))))
LOCK=threading.RLock()
CURRENT=None
QUEUE=[]
STAGES={}
ACTIVE=True
LAST_DISK_ERROR=""
SESSION=requests.Session()
TERMINAL=(401,403,409)

def job_endpoint(job_id):
    return f"https://{HOST}/api/motion-studio/agent/jobs/{job_id}"

def valid_url(url,job_id):
    try:
        target=urlparse(url)
        return (target.scheme=="https" and target.hostname==HOST and
          target.port in (None,443) and not target.username and not target.password and
          not target.query and not target.fragment and target.path==urlparse(job_endpoint(job_id)).path)
    except (ValueError,TypeError):return False

def safe_status(status):
    return status in TERMINAL

def should_check_assignment(now,last_check,completed=False):
    """Check promptly on completion, otherwise at most once per minute."""
    return completed or now-last_check>=60

def auth_ok(value):
    return len(SECRET)>=32 and isinstance(value,str) and hmac.compare_digest(SECRET,value)

def disk_metrics():
    info=shutil.disk_usage(WORK)
    return round((1-info.free/info.total)*100,2),info.free

def disk_ready(needed=0):
    used,free=disk_metrics()
    return used<=MAX_DISK and free>=needed,used

def atomic_state():
    WORK.mkdir(parents=True,exist_ok=True)
    target=WORK/".queue.next"
    data={"running":CURRENT,"queue":QUEUE,"stages":STAGES}
    with open(target,"w",encoding="utf8") as fp:
        os.chmod(target,0o600)
        json.dump(data,fp,separators=(",",":"))
        fp.flush()
        os.fsync(fp.fileno())
    os.replace(target,STATE)

def load():
    global CURRENT
    WORK.mkdir(parents=True,exist_ok=True)
    os.chmod(WORK,0o700)
    # No jobs run at startup. Old segment/QA temp dirs are expendable;
    # completed ranges remain registered by the job asset API.
    if SCRATCH.exists():shutil.rmtree(SCRATCH)
    SCRATCH.mkdir(mode=0o700)
    if STATE.is_file():
        try:
            data=json.loads(STATE.read_text())
            QUEUE.extend(data.get("queue",[]))
            prior=data.get("running")
            if prior and not any(x["id"]==prior["id"] for x in QUEUE):
                QUEUE.insert(0,prior)
            STAGES.update(data.get("stages",{}))
        except (OSError,ValueError,KeyError):
            raise RuntimeError("Invalid persistent render queue; manual recovery required")
    # Only delete orphaned per-job temporary folders; never touch other volumes.
    for folder in WORK.glob("job_*"):
        job_id=folder.name[4:]
        if (folder.is_dir() and not any(folder.name=="job_"+x["id"] for x in QUEUE)
            and STAGES.get(job_id) in ("completed","qa_pass","cancelled")):
            shutil.rmtree(folder)
    CURRENT=None
    atomic_state()

def verify_job(entry):
    r=SESSION.get(entry["url"],headers={"Authorization":"Bearer "+entry["token"]},
        timeout=(15,45),allow_redirects=False)
    if safe_status(r.status_code):return False
    if not r.ok:raise RuntimeError("Job auth check failed (HTTP "+str(r.status_code)+")")
    state=(r.json().get("job") or {}).get("status")
    return state not in ("complete","failed","cancelled","dispatch_failed")

def isolated_ping(entry):
    try:
        r=SESSION.get(entry["url"],headers={"Authorization":"Bearer "+entry["token"]},
            timeout=(15,30),allow_redirects=False)
        if safe_status(r.status_code):return False
        if r.ok:
            return (r.json().get("job") or {}).get("status") not in (
                "complete","failed","cancelled","dispatch_failed")
        return True
    except requests.RequestException:return True

def tick_heartbeats():
    while ACTIVE:
        with LOCK:
            waiting=list(QUEUE)
        for entry in waiting:
            if not isolated_ping(entry):
                with LOCK:
                    QUEUE[:]=[x for x in QUEUE if x["id"]!=entry["id"]]
                    STAGES[entry["id"]]="cancelled"
                    atomic_state()
        time.sleep(100)

def technical_failure(entry,reason):
    """Keep job open, retry once with already-registered segments, then escalate."""
    job_id=entry["id"]
    count=int(entry.get("attempt",0))+1
    entry["attempt"]=count
    retry=count<2
    stage="retrying" if retry else "attention_required"
    # Only a small, known technical category leaves this worker; arbitrary
    # ffmpeg stderr can expose paths or signed source URLs.
    low=str(reason).lower()
    categories=(
        ("missing video segment","missing_segment"),
        ("frame count","frame_count"),
        ("duration","duration"),
        ("audio","audio"),
        ("resolution","resolution"),
        ("frame rate","frame_rate"),
        ("decode","decode"),
        ("disk full","disk_full"),
        ("deadline","timeout"),
    )
    category=next((label for key,label in categories if key in low),"technical_render_failure")
    with LOCK:
        STAGES[job_id]=stage
        if retry and not any(x["id"]==job_id for x in QUEUE):
            QUEUE.insert(0,entry)
        atomic_state()
    details={"stage":stage,"reason":category,"attempt":count,
             "masterFilename":"master_cpu.mp4","shareFilename":"share_cpu.mp4",
             "diagnosticPath":"recovery/master.mp4"}
    try:
        pipeline.api(job_id,"POST","/render-status",details)
        pipeline.api(job_id,"POST","/progress",{
            "stage":"fixing","percent":89 if retry else 90,
            "message":("Finishing touches, retrying the final render" if retry else
                       "Our team is reviewing the final render")})
    except Exception:
        pass
    # Durable operator-visible event via /render-status, plus safe server log.
    if not retry:
        print("render needs owner attention: job="+job_id+" check="+category,flush=True)
    return retry

def fail(entry,reason,report=True):
    # Kept for timeout and disk-pressure callsites.
    return technical_failure(entry,reason) if report else False

def do_render(entry):
    global LAST_DISK_ERROR
    job_id=entry["id"]
    root=WORK/("job_"+job_id)
    deadline=time.monotonic()+JOB_TIMEOUT
    start=time.monotonic()
    stop=None
    try:
        if not verify_job(entry):
            with LOCK:
                STAGES[job_id]="cancelled";atomic_state()
            return
        os.environ["MOTION_JOB_URL"]=entry["url"]
        os.environ["MOTION_JOB_TOKEN"]=entry["token"]
        stop=pipeline.heartbeat_scope(job_id)
        api=pipeline.api
        api(job_id,"POST","/render-status",{"stage":"queued","completed":0,"total":1})
        meta=api(job_id,"GET","/render-asset",params={"filename":entry["bundle"]})
        if not meta.get("exists"):raise RuntimeError("Render bundle not registered")
        size=int(meta.get("bytes") or 0)
        required=max(0,size)*4+2_000_000_000
        if disk_metrics()[1]<required:raise RuntimeError("render host disk full")
        # Preserve recovery/master.mp4 and recovery/share.mp4 across retries.
        # Only the extracted ZIP is rebuilt; segment receipts are reusable.
        root.mkdir(parents=True,exist_ok=True)
        (root/"bundle.zip").unlink(missing_ok=True)
        if (root/"bundle").exists():shutil.rmtree(root/"bundle")
        bundle,project,_,_=pipeline.extract_bundle(job_id,entry["bundle"],str(root))
        frames=int(project["frameCount"])
        ranges=[(x,min(frames,x+entry["segmentFrames"]))
                for x in range(0,frames,entry["segmentFrames"])]
        api(job_id,"POST","/render-status",{"stage":"queued","completed":0,"total":len(ranges)})
        api(job_id,"POST","/progress",{"stage":"rendering","percent":70,
            "message":"Rendering finished scenes"})
        with LOCK:
            STAGES[job_id]="rendering";atomic_state()
        def segment(span):
            first,last=span
            for attempt in range(1,4):
                if time.monotonic()>=deadline:raise TimeoutError("Render job deadline exceeded")
                try:
                    if cancelled.is_set():raise RuntimeError("Render cancelled")
                    result=pipeline.capture_segment(job_id,entry["bundle"],"cpu",
                              first,last,bundle_root=bundle,cancel_event=cancelled)
                    result["retries"]=attempt-1
                    return result
                except Exception:
                    if attempt>=3:raise
                    time.sleep(attempt*2)
        results=[]
        cancelled=threading.Event()
        with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures=[]
            spans=iter(ranges)
            def schedule():
                if cancelled.is_set():return
                try:span=next(spans)
                except StopIteration:return
                futures.append(pool.submit(segment,span))
            for _ in range(WORKERS):schedule()
            last_check=time.monotonic()
            try:
                while futures:
                    if time.monotonic()>=deadline:
                        raise TimeoutError("Render job deadline exceeded")
                    done,still=concurrent.futures.wait(futures,timeout=2,
                        return_when=concurrent.futures.FIRST_COMPLETED)
                    futures=list(still)
                    now=time.monotonic()
                    if should_check_assignment(now,last_check,bool(done)):
                        if not verify_job(entry):
                            with LOCK:
                                STAGES[job_id]="cancelled";atomic_state()
                            cancelled.set()
                            return
                        last_check=now
                    for finished in done:
                        results.append(finished.result())
                        api(job_id,"POST","/render-status",{"stage":"rendering",
                            "completed":len(results),"total":len(ranges)})
                        schedule()
            finally:
                cancelled.set()
                for future in futures:future.cancel()
        if time.monotonic()>deadline:raise TimeoutError("Render job deadline exceeded")
        joined=pipeline.join_and_qa(job_id,entry["bundle"],"cpu",results,
                                   bundle_root=bundle,recovery_dir=str(root/"recovery"))
        if not verify_job(entry):
            with LOCK:
                STAGES[job_id]="cancelled";atomic_state()
            return
        api(job_id,"POST","/render-status",{"stage":"qa_pass"})
        if not entry["benchmark"]:
            api(job_id,"POST","/assets",{"action":"approveMaster",
                "uploadId":joined["masterUploadId"]})
            api(job_id,"POST","/progress",{"stage":"delivering","percent":90,
                "message":"Video ready to watch; preparing editable version"})
            api(job_id,"POST","/render-status",{"stage":"uploaded"})
            version=pipeline.publish_editable(job_id,bundle)
            api(job_id,"POST","/complete",{"delivery":"live",
                "portableVersionId":version["id"],"durationMs":project["durationMs"]})
            api(job_id,"POST","/render-status",{"stage":"completed"})
        with LOCK:
            STAGES[job_id]="completed" if not entry["benchmark"] else "qa_pass"
            atomic_state()
    except Exception as exc:
        # Expired token / completed or reassigned job is not a render failure:
        # never publish a second completion or mark a terminal job failed.
        message=str(exc)
        terminal=any(code in message for code in (
            "Job API failed: 401","Job API failed: 403","Job API failed: 409"))
        if terminal:
            with LOCK:
                STAGES[job_id]="cancelled";atomic_state()
        else:
            technical_failure(entry,message)
    finally:
        if stop:stop.set()
        # Only clean the local job after confirmed successful delivery.
        # Attention-required jobs retain the master/share and source bundle.
        if STAGES.get(job_id) in ("completed","qa_pass"):
            shutil.rmtree(root,ignore_errors=True)
        # Normal pipeline TemporaryDirectory() calls live under /work/tmp.
        for item in SCRATCH.iterdir():
            if item.is_dir():shutil.rmtree(item,ignore_errors=True)
            else:item.unlink(missing_ok=True)
        os.environ.pop("MOTION_JOB_TOKEN",None)
        os.environ.pop("MOTION_JOB_URL",None)

def consume():
    global CURRENT,LAST_DISK_ERROR
    waiting_since={}
    while ACTIVE:
        with LOCK:
            if CURRENT or not QUEUE:
                entry=None
            else:
                entry=QUEUE[0]
        if not entry:
            time.sleep(1);continue
        ready,used=disk_ready()
        if not ready:
            LAST_DISK_ERROR="render host disk full"
            first=waiting_since.setdefault(entry["id"],time.monotonic())
            if time.monotonic()-first>1800:
                with LOCK:
                    if QUEUE and QUEUE[0]["id"]==entry["id"]:
                        QUEUE.pop(0)
                        CURRENT=entry
                        atomic_state()
                os.environ["MOTION_JOB_URL"]=entry["url"]
                os.environ["MOTION_JOB_TOKEN"]=entry["token"]
                technical_failure(entry,"render host disk full")
                os.environ.pop("MOTION_JOB_URL",None)
                os.environ.pop("MOTION_JOB_TOKEN",None)
                with LOCK:CURRENT=None;atomic_state()
            time.sleep(60);continue
        LAST_DISK_ERROR=""
        waiting_since.pop(entry["id"],None)
        with LOCK:
            if not QUEUE or QUEUE[0]["id"]!=entry["id"]:continue
            CURRENT=QUEUE.pop(0)
            STAGES[entry["id"]]="running"
            atomic_state()
        try:do_render(entry)
        finally:
            with LOCK:
                CURRENT=None
                atomic_state()

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):
        # Deliberately never log URLs, request bodies, headers or credentials.
        pass
    def respond(self,status,data):
        blob=json.dumps(data,separators=(",",":")).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Length",str(len(blob)))
        self.end_headers()
        self.wfile.write(blob)
    def authorized(self):
        if auth_ok(self.headers.get("x-render-host-secret","")):return True
        self.respond(401,{"error":"Unauthorized"});return False
    def do_GET(self):
        if self.path=="/livez":
            # Only a liveness bit; no queue/status/credentials exposed.
            return self.respond(200,{"ok":True})
        if not self.authorized():return
        if self.path=="/health":
            ready,used=disk_ready()
            with LOCK:
                self.respond(200,{"ok":True,"status":"busy" if CURRENT else "idle",
                    "queueLength":len(QUEUE),"segmentWorkers":WORKERS,
                    "diskPercent":used,"accepting":ready,
                    "reason":"" if ready else "render host disk full"})
            return
        m=re.fullmatch(r"/jobs/(msaj_[a-zA-Z0-9-]{4,100})",self.path)
        if not m:return self.respond(404,{"error":"Not found"})
        job_id=m.group(1)
        with LOCK:
            place=next((i+1 for i,x in enumerate(QUEUE) if x["id"]==job_id),None)
            self.respond(200,{"jobId":job_id,"position":place,
                "stage":STAGES.get(job_id,"unknown")})
    def do_POST(self):
        if not self.authorized():return
        if self.path!="/enqueue":return self.respond(404,{"error":"Not found"})
        try:
            n=int(self.headers.get("Content-Length","0"))
            if not 0<n<=8192:raise ValueError()
            data=json.loads(self.rfile.read(n))
            job_id=data.get("jobId")
            token=data.get("token")
            url=data.get("jobUrl")
            frames=data.get("segmentFrames",150)
            bundle=data.get("bundle","render_bundle_v1.zip")
            if (not isinstance(job_id,str) or not re.fullmatch(r"msaj_[a-zA-Z0-9-]{4,100}",job_id)
                or not isinstance(token,str) or not 16<=len(token)<=256
                or not isinstance(url,str) or not valid_url(url,job_id)
                or type(frames)!=int or not 1<=frames<=600
                or not isinstance(bundle,str) or not re.fullmatch(r"[a-zA-Z0-9_.-]{1,120}\.zip",bundle)):
                raise ValueError()
        except (ValueError,TypeError,AttributeError,KeyError):
            return self.respond(400,{"error":"Invalid render request"})
        with LOCK:
            existing=next((x for x in QUEUE+([CURRENT] if CURRENT else []) if x["id"]==job_id),None)
            if existing:
                return self.respond(200,{"jobId":job_id,"queued":True,
                    "alreadyExists":True,"stage":STAGES.get(job_id,"queued")})
        entry={"id":job_id,"token":token,"url":url,"bundle":bundle,
               "segmentFrames":frames,"benchmark":data.get("benchmarkOnly") is True}
        # Authenticate against the authoritative job API before storing credentials.
        try:
            if not verify_job(entry):return self.respond(409,{"error":"Job not active"})
        except requests.RequestException:
            return self.respond(503,{"error":"Job API unavailable"})
        except RuntimeError:
            return self.respond(401,{"error":"Job not authenticated"})
        with LOCK:
            if any(x["id"]==job_id for x in QUEUE) or (CURRENT and CURRENT["id"]==job_id):
                return self.respond(200,{"jobId":job_id,"queued":True,
                    "alreadyExists":True,"stage":STAGES.get(job_id,"queued")})
            QUEUE.append(entry);STAGES[job_id]="queued";atomic_state()
        return self.respond(202,{"jobId":job_id,"queued":True,"alreadyExists":False,"stage":"queued"})

def main():
    if len(SECRET)<32:raise RuntimeError("RENDER_HOST_SECRET must be configured")
    if not re.fullmatch(r"[a-zA-Z0-9.-]+",HOST):raise RuntimeError("Invalid allowed host")
    load()
    # Set CPU priority once; os.nice() applies process-wide and must not
    # accumulate across successive customer jobs.
    if NICE:os.nice(NICE)
    os.environ["TMPDIR"]=str(SCRATCH)
    tempfile.tempdir=str(SCRATCH)
    threading.Thread(target=tick_heartbeats,daemon=True).start()
    threading.Thread(target=consume,daemon=True).start()
    server=ThreadingHTTPServer(("0.0.0.0",int(os.getenv("PORT","8098"))),Handler)
    server.serve_forever()

if __name__=="__main__":
    main()
