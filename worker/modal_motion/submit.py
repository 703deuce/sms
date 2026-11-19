"""Local Modal launcher; job token becomes a per-job Modal Secret, never an argument."""
from __future__ import annotations
import json, os
import modal

def required(key):
    value=os.environ.get(key,"")
    if not value:raise ValueError("Missing required Modal submission configuration")
    return value

def main():
    job_id=required("MOTION_JOB_ID")
    token=required("MOTION_JOB_TOKEN")
    url=required("MOTION_JOB_URL")
    bundle=required("MOTION_BUNDLE_FILENAME")
    mode=required("MOTION_MODE")
    segment_frames=int(required("MOTION_SEGMENT_FRAMES"))
    estimate=int(required("MOTION_ESTIMATE_USD_MICROS"))
    benchmark_only=os.environ.get("MOTION_BENCHMARK_ONLY","1")!="0"
    app_name=os.environ.get("MODAL_MOTION_APP_NAME","transovo-motion-render")
    secret=modal.Secret.from_dict({
        "MOTION_JOB_TOKEN":token,
        "MOTION_JOB_URL":url,
        "MOTION_CPU_USD_PER_SECOND":os.environ.get("MOTION_CPU_USD_PER_SECOND","0"),
        "MOTION_GPU_USD_PER_SECOND":os.environ.get("MOTION_GPU_USD_PER_SECOND","0"),
    })
    function=modal.Function.from_name(app_name,"render_film").with_options(secrets=[secret])
    call=function.spawn(job_id,bundle,mode,segment_frames,estimate,benchmark_only)
    call_id=getattr(call,"object_id",None) or getattr(call,"function_call_id",None)
    if not call_id:raise RuntimeError("Modal did not return a call identifier")
    print(json.dumps({"jobId":job_id,"callId":call_id}))

if __name__=="__main__":
    main()
