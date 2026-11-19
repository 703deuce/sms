"""Isolated Motion Studio Modal app. No clips-worker classes are imported."""
from __future__ import annotations
import json, os, pathlib, tempfile, time, sys
sys.path.insert(0, '/root/modal_motion')
import modal

HERE=pathlib.Path(__file__).resolve().parent
app=modal.App(os.environ.get("MODAL_MOTION_APP_NAME","transovo-motion-render"))
image=(modal.Image.from_registry("docker.io/node:22-bookworm",add_python="3.11")
 .apt_install("chromium","ffmpeg","fonts-dejavu-core","fontconfig")
 .run_commands("mkdir -p /root/modal_motion && cd /root/modal_motion && npm install --no-audit --no-fund puppeteer-core@24.31.0 hyperframes@0.9.52")
 .pip_install("requests>=2.31,<3")
 .env({"CHROMIUM_BIN":"/usr/bin/chromium",
       "HYPERFRAMES_TELEMETRY":"0","DO_NOT_TRACK":"1"})
 .add_local_dir(str(HERE),remote_path="/root/modal_motion"))

@app.function()
def ping():
    return {"ok":True,"app":"motion-render"}

def bounded_segment(job_id,bundle_name,mode,start,end):
    from pipeline import capture_segment
    for attempt in range(1,4):
        try:
            result=capture_segment(job_id,bundle_name,mode,start,end)
            result["retries"]=attempt-1
            return result
        except Exception:
            if attempt==3:raise
            time.sleep(2*attempt)

@app.function(image=image,timeout=5400,cpu=4,memory=8192)
def capture_cpu(job_id:str,bundle_name:str,start:int,end:int):
    return bounded_segment(job_id,bundle_name,"cpu",start,end)

@app.function(image=image,gpu="T4",timeout=5400,cpu=4,memory=8192)
def capture_gpu(job_id:str,bundle_name:str,start:int,end:int):
    return bounded_segment(job_id,bundle_name,"gpu",start,end)

@app.function(image=image,timeout=5400,cpu=4,memory=8192)
def join_qa(job_id:str,bundle_name:str,mode:str,segments:list):
    from pipeline import join_and_qa
    return join_and_qa(job_id,bundle_name,mode,segments)

@app.function(image=image,timeout=12*3600,cpu=2,memory=4096)
def render_film(job_id:str,bundle_name:str,mode:str="cpu",segment_frames:int=300,
                estimate_usd_micros:int=0,benchmark_only:bool=True):
    """Fan out once, then mux/QA and publish. Whole-run paid retries disabled."""
    from pipeline import api,extract_bundle,heartbeat_scope
    if mode not in ("cpu","gpu") or not 1<=segment_frames<=600:
        raise ValueError("Invalid capture configuration")
    if estimate_usd_micros<=0:
        raise ValueError("Positive, operator-approved Modal estimate required")
    rate_key="MOTION_GPU_USD_PER_SECOND" if mode=="gpu" else "MOTION_CPU_USD_PER_SECOND"
    if float(os.environ.get(rate_key,"0"))<=0:
        raise ValueError("Approved Modal compute rate must be provided before paid work")
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
        retry_count=sum(item.get("retries",0) for item in results)
        work_seconds=sum(float(item.get("seconds",0)) for item in results)+float(joined.get("seconds",0))
        cost_key="MOTION_GPU_USD_PER_SECOND" if mode=="gpu" else "MOTION_CPU_USD_PER_SECOND"
        rate=float(os.environ.get(cost_key,"0"))
        if rate<=0:raise ValueError("An operator-approved Modal rate is required for cost tracking")
        api(job_id,"POST","/usage",{"usageId":"modal_"+("bench_" if benchmark_only else "prod_")+mode+"_"+bundle_name,
          "items":[{"provider":"modal",
          "units":work_seconds,"usd":round(work_seconds*rate,6)}]})
        summary={"jobId":job_id,"mode":mode,"segments":len(results),
          "retries":retry_count,"masterBytes":joined["masterBytes"],
          "shareBytes":joined["shareBytes"],"qa":joined["qa"],
          "renderSeconds":round(time.monotonic()-started,3),
          "estimatedUsd":round(work_seconds*rate,6)}
        if benchmark_only:
            # The first CPU/GPU comparison does NOT approve or complete a
            # customer job. One paid run per mode; preserve the job assignment.
            return summary
        api(job_id,"POST","/assets",{"action":"approveMaster","uploadId":joined["masterUploadId"]})
        api(job_id,"POST","/progress",{"stage":"delivering","percent":90,
            "message":"Video ready to watch; preparing editable version"})
        api(job_id,"POST","/render-status",{"stage":"uploaded"})
        # Reuse the existing content-addressed Producer package contract;
        # upload original bundles/stems and publish their native metadata.
        from pipeline import publish_editable
        with tempfile.TemporaryDirectory() as tmp:
            root,project,_,_=extract_bundle(job_id,bundle_name,tmp)
            version=publish_editable(job_id,root)
        version_id=version["id"]
        api(job_id,"POST","/complete",{"delivery":"live","portableVersionId":version_id,
            "durationMs":project["durationMs"]})
        api(job_id,"POST","/render-status",{"stage":"completed"})
        return summary
    except Exception as error:
        # Persist internal reason before the customer-facing generic failure.
        reason=str(error)[:800]
        try:api(job_id,"POST","/render-status",{"stage":"qa_fail","reason":reason})
        except Exception:pass
        if not benchmark_only:
            try:api(job_id,"POST","/complete",{"status":"failed"})
            except Exception:pass
        raise RuntimeError("Motion Studio Modal render failed; see authenticated render status")
    finally:
        stop.set()
