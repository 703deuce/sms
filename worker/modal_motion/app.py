"""Isolated Motion Studio Modal app. No clips-worker classes are imported."""
from __future__ import annotations
import json, os, pathlib, tempfile, time
import modal

HERE=pathlib.Path(__file__).resolve().parent
app=modal.App(os.environ.get("MODAL_MOTION_APP_NAME","transovo-motion-render"))
image=(modal.Image.from_registry("docker.io/node:22-bookworm",add_python="3.11")
 .apt_install("chromium","ffmpeg","fonts-dejavu-core","fontconfig")
 .run_commands("mkdir -p /opt/motion_node && cd /opt/motion_node && npm install --no-audit --no-fund puppeteer-core@24.31.0 hyperframes@0.9.52")
 .pip_install("requests>=2.31,<3")
 .env({"NODE_PATH":"/opt/motion_node/node_modules","CHROMIUM_BIN":"/usr/bin/chromium",
       "HYPERFRAMES_TELEMETRY":"0","DO_NOT_TRACK":"1"})
 .add_local_dir(str(HERE),remote_path="/root/modal_motion"))

@app.function()
def ping():
    return {"ok":True,"app":"motion-render"}

@app.function(image=image,timeout=5400,cpu=4,memory=8192)
def capture_cpu(job_id:str,bundle_name:str,start:int,end:int):
    from pipeline import capture_segment
    return capture_segment(job_id,bundle_name,"cpu",start,end)

@app.function(image=image,gpu="T4",timeout=5400,cpu=4,memory=8192)
def capture_gpu(job_id:str,bundle_name:str,start:int,end:int):
    from pipeline import capture_segment
    return capture_segment(job_id,bundle_name,"gpu",start,end)

@app.function(image=image,timeout=5400,cpu=4,memory=8192)
def join_qa(job_id:str,bundle_name:str,mode:str,segments:list):
    from pipeline import join_and_qa
    return join_and_qa(job_id,bundle_name,mode,segments)

@app.function(image=image,timeout=12*3600,cpu=2,memory=4096)
def render_film(job_id:str,bundle_name:str,mode:str="cpu",segment_frames:int=300,
                estimate_usd_micros:int=0):
    """Fan out once, then mux/QA and publish. Whole-run paid retries disabled."""
    from pipeline import api,extract_bundle,heartbeat_scope
    if mode not in ("cpu","gpu") or not 1<=segment_frames<=600:
        raise ValueError("Invalid capture configuration")
    if estimate_usd_micros<=0:
        raise ValueError("Positive, operator-approved Modal estimate required")
    budget=api(job_id,"GET","/modal-budget",params={"estimateUsdMicros":estimate_usd_micros})
    if not budget["allowed"]:
        raise ValueError("Shared monthly Modal budget guard refused this render")
    started=time.monotonic()
    with tempfile.TemporaryDirectory() as tmp:
        _,project,_,_=extract_bundle(job_id,bundle_name,tmp)
    frame_count=project["frameCount"]
    segments=[(job_id,bundle_name,i,min(frame_count,i+segment_frames))
        for i in range(0,frame_count,segment_frames)]
    stop=heartbeat_scope(job_id)
    try:
        api(job_id,"POST","/render-status",{"stage":"queued","total":len(segments),"completed":0})
        api(job_id,"POST","/progress",{"stage":"rendering","percent":70,"message":"Rendering finished scenes"})
        # Modal children receive the same short-lived job-scoped Secret via
        # with_options; the token is NEVER put in child arguments or logs.
        secret=modal.Secret.from_dict({
            "MOTION_JOB_TOKEN":os.environ["MOTION_JOB_TOKEN"],
            "MOTION_JOB_URL":os.environ["MOTION_JOB_URL"],
        })
        fn=capture_gpu if mode=="gpu" else capture_cpu
        scoped=fn.with_options(secrets=[secret])
        results=[]
        for r in scoped.starmap(segments):
            results.append(r)
            api(job_id,"POST","/render-status",{"stage":"rendering",
              "completed":len(results),"total":len(segments)})
        joined=join_qa.with_options(secrets=[secret]).remote(job_id,bundle_name,mode,results)
        api(job_id,"POST","/render-status",{"stage":"qa_pass"})
        api(job_id,"POST","/assets",{"action":"approveMaster","uploadId":joined["masterUploadId"]})
        api(job_id,"POST","/progress",{"stage":"delivering","percent":90,
            "message":"Video ready to watch; preparing editable version"})
        api(job_id,"POST","/render-status",{"stage":"uploaded"})
        # A producer bundle must provide an exact, registered portable payload.
        # We do not fake editable media or auto-flatten it into an MP4.
        with tempfile.TemporaryDirectory() as tmp:
            root,project,_,_=extract_bundle(job_id,bundle_name,tmp)
            payload_file=root/"portable.json"
            if not payload_file.is_file():
                raise ValueError("Editable portable payload missing from render bundle")
            payload=json.loads(payload_file.read_text())
            version=api(job_id,"POST","/portable",payload,timeout=300)
        version_id=version["id"]
        api(job_id,"POST","/complete",{"delivery":"live","portableVersionId":version_id,
            "durationMs":project["durationMs"]})
        api(job_id,"POST","/render-status",{"stage":"completed"})
        seconds=sum(float(x.get("seconds",0)) for x in results)
        # Internal estimate only; the platform invoice is authoritative.
        rate_key="MOTION_GPU_USD_PER_SECOND" if mode=="gpu" else "MOTION_CPU_USD_PER_SECOND"
        rate=float(os.environ.get(rate_key,"0"))
        if rate>0:
            api(job_id,"POST","/usage",{"items":[{"provider":"modal",
                "units":seconds,"usd":round(seconds*rate,6)}]})
        return {"jobId":job_id,"mode":mode,"segments":len(results),
            "retries":0,"masterBytes":joined["masterBytes"],
            "shareBytes":joined["shareBytes"],"qa":joined["qa"],
            "renderSeconds":round(time.monotonic()-started,3)}
    except Exception as error:
        # Persist internal reason before the customer-facing generic failure.
        reason=str(error)[:800]
        try:api(job_id,"POST","/render-status",{"stage":"qa_fail","reason":reason})
        except Exception:pass
        try:api(job_id,"POST","/complete",{"status":"failed"})
        except Exception:pass
        raise RuntimeError("Motion Studio Modal render failed; see authenticated render status")
    finally:
        stop.set()
