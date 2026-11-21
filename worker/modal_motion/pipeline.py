"""Private-bundle rendering helpers. No database or B2 credentials in Modal."""
from __future__ import annotations
import concurrent.futures, hashlib, json, os, pathlib, re, shutil, signal, subprocess, tempfile, threading, time, zipfile
from urllib.parse import quote, urlparse
import requests

CHUNK=6*1024*1024
MAX_ZIP=2_000_000_000
MAX_UNPACKED=3_000_000_000
MAX_FILES=10000
SESSION=requests.Session()

def safe_stage_log(stage,**fields):
    """Allowlisted operational numbers only; never log URLs, paths or tokens."""
    if not os.environ.get("MOTION_RENDER_STAGE_LOGS"):return
    permitted={k:round(float(v),3) if isinstance(v,(int,float)) else bool(v)
               for k,v in fields.items() if k in (
                   "index","bytes","seconds","attempt","skipped","count","retries")}
    print(json.dumps({"stage":stage,**permitted},separators=(",",":")),flush=True)

def job_url(job_id):
    base=os.environ["MOTION_JOB_URL"].rstrip("/")
    u=urlparse(base)
    if u.scheme!="https" or not base.endswith("/jobs/"+job_id):
        raise ValueError("Job URL must be a trusted HTTPS job endpoint")
    return base

def job_headers():
    return {"Authorization":"Bearer "+os.environ["MOTION_JOB_TOKEN"]}

def api(job_id,method,path="",payload=None,params=None,timeout=120,attempts=8):
    """Ride out web deploys/proxy blips: retry 429/5xx and connection errors."""
    import random
    for attempt in range(1,attempts+1):
        try:
            r=SESSION.request(method,job_url(job_id)+path,headers=job_headers(),
              json=payload,params=params,timeout=timeout,allow_redirects=False)
        except (requests.ConnectionError,requests.Timeout):
            if attempt==attempts: raise
            time.sleep(min(60,2**attempt)+random.uniform(0,3)); continue
        if r.status_code in (429,500,502,503,504) and attempt<attempts:
            time.sleep(min(60,2**attempt)+random.uniform(0,3)); continue
        if not r.ok:
            # Preserve the server's validation reason, excluding URLs and query strings.
            try: detail=str((r.json() or {}).get("error") or "")
            except Exception: detail=""
            detail=re.sub(r"https?://\S+","[url]",detail)[:300]
            raise RuntimeError("Job API failed: "+str(r.status_code)+
                " "+method+" "+(path or "/")+(": "+detail if detail else ""))
        return r.json()

def heartbeat(job_id,stop):
    while not stop.wait(105):
        try: api(job_id,"GET",timeout=45)
        except Exception: pass # Main operation will fail if lease expires.

def heartbeat_scope(job_id):
    stop=threading.Event()
    thread=threading.Thread(target=heartbeat,args=(job_id,stop),daemon=True)
    thread.start()
    return stop

def ready_url(job_id,filename):
    r=api(job_id,"GET","/render-asset",params={"filename":filename})
    return r.get("url") if r.get("exists") else None

TRANSIENT_STATUS={429,500,502,503,504}

def fetch_file(job_id,filename,target,required=True,attempts=8):
    """Storage (B2) can return 503/429 under parallel load: back off and retry."""
    import random
    for attempt in range(1,attempts+1):
        url=ready_url(job_id,filename)
        if not url:
            if required: raise ValueError("Required registered render artifact missing: "+filename)
            return False
        try:
            with SESSION.get(url,stream=True,timeout=(30,180),allow_redirects=False) as response:
                if response.status_code in TRANSIENT_STATUS and attempt<attempts:
                    raise ConnectionError("transient storage status "+str(response.status_code))
                response.raise_for_status()
                with open(target,"wb") as out:
                    size=0
                    for chunk in response.iter_content(1024*1024):
                        size+=len(chunk)
                        if size>MAX_ZIP: raise ValueError("Artifact over size limit")
                        out.write(chunk)
            return True
        except (requests.ConnectionError,requests.Timeout,requests.exceptions.ChunkedEncodingError,ConnectionError):
            if attempt==attempts: raise
            time.sleep(min(60,2**attempt)+random.uniform(0,5))

def extract_bundle(job_id,filename,directory):
    archive=os.path.join(directory,"bundle.zip")
    fetch_file(job_id,filename,archive)
    root=pathlib.Path(directory,"bundle")
    root.mkdir()
    with zipfile.ZipFile(archive) as z:
        members=z.infolist()
        if len(members)>MAX_FILES or sum(x.file_size for x in members)>MAX_UNPACKED:
            raise ValueError("Render bundle exceeds limits")
        for item in members:
            target=(root/item.filename).resolve()
            if not str(target).startswith(str(root.resolve())+os.sep):
                raise ValueError("Unsafe bundle path")
            if (item.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Symlinks are forbidden")
        z.extractall(root)
    project=json.loads((root/"project.json").read_text())
    width,height,fps=(project.get(k) for k in ("width","height","fps"))
    if not all(isinstance(v,int) for v in (width,height,fps)) or not (
        2<=width<=3840 and 2<=height<=2160 and 1<=fps<=120
    ): raise ValueError("Invalid native project format")
    count=project.get("frameCount")
    duration=project.get("durationMs")
    if not isinstance(count,int) or count<=0 or count>2000000:
        raise ValueError("frameCount must be specified by Producer")
    if not isinstance(duration,int) or abs(duration-count*1000/fps)>100:
        raise ValueError("Inconsistent duration and frame count")
    composition=project.get("composition",{})
    entry=composition.get("entryFile")
    # This is an explicit, already composited HTML file. Do not silently
    # concatenate plate MP4s and omit layer-scene text/graphics.
    if not isinstance(entry,str) or not re.fullmatch(r"[A-Za-z0-9_./-]{1,200}",entry):
        raise ValueError("Producer must specify full-composition entryFile")
    candidate=(root/entry).resolve()
    if not str(candidate).startswith(str(root.resolve())+os.sep) or not candidate.is_file():
        raise ValueError("Full-composition HTML missing")
    audio=project.get("mixedAudioFile")
    if not isinstance(audio,str) or not re.fullmatch(r"[A-Za-z0-9_./-]{1,200}",audio):
        raise ValueError("Mixed audio must be supplied separately")
    audio_file=(root/audio).resolve()
    if not str(audio_file).startswith(str(root.resolve())+os.sep) or not audio_file.is_file():
        raise ValueError("Mixed audio source missing")
    return root,project,entry,audio_file

def checked(cmd,timeout=1800,cancel_event=None):
    # Never print argv: command lines can include media paths or signed URLs.
    if cancel_event is None:
        p=subprocess.run(cmd,capture_output=True,text=True,timeout=timeout)
        if p.returncode:
            raise RuntimeError("Media processing failed: "+p.stderr[-350:])
        return p.stdout,p.stderr
    proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                         text=True,start_new_session=True)
    deadline=time.monotonic()+timeout
    try:
        while True:
            if cancel_event.is_set():
                raise RuntimeError("Render cancelled")
            if time.monotonic()>deadline:
                raise TimeoutError("Render segment timed out")
            try:
                stdout,stderr=proc.communicate(timeout=0.5)
                if proc.returncode:
                    raise RuntimeError("Media processing failed: "+stderr[-350:])
                return stdout,stderr
            except subprocess.TimeoutExpired:
                continue
    finally:
        if proc.poll() is None:
            try:os.killpg(proc.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            proc.communicate()

def prepare_upload(job_id,path,filename,kind,mime):
    size=os.path.getsize(path)
    with open(path,"rb") as f:
        sha=hashlib.file_digest(f,"sha256").hexdigest()
    prepared=api(job_id,"POST","/assets",{"action":"prepare","filename":filename,
      "kind":kind,"mime":mime,"bytes":size,"sha256":sha,"resume":True},
      timeout=30,attempts=2)
    if prepared.get("exists"):
        return prepared.get("uploadId")
    uid=prepared["uploadId"]
    mode=prepared["mode"]
    parts=[]
    if mode=="signed_put":
        with open(path,"rb") as stream:
            r=SESSION.put(prepared["signedPut"]["url"],data=stream,
              headers={"content-type":mime},timeout=600)
            r.raise_for_status()
    elif mode=="s3_multipart":
        details=prepared["s3Multipart"]
        part_bytes=details["partSize"]
        with open(path,"rb") as stream:
            for item in details["partUrls"]:
                stream.seek((item["partNumber"]-1)*part_bytes)
                data=stream.read(part_bytes)
                r=SESSION.put(item["url"],data=data,timeout=600)
                r.raise_for_status()
                etag=r.headers.get("etag")
                if not etag:raise RuntimeError("S3 multipart part missing ETag")
                parts.append({"partNumber":item["partNumber"],"etag":etag})
    elif mode=="tus":
        details=prepared["tus"]
        metadata={"bucketName":details["bucket"],"objectName":details["objectKey"],
                  "contentType":mime}
        import base64
        encoded=",".join(k+" "+base64.b64encode(v.encode()).decode()
          for k,v in metadata.items())
        headers={"Tus-Resumable":"1.0.0","x-signature":details["token"]}
        r=SESSION.post(details["endpoint"],headers={**headers,"Upload-Length":str(size),
          "Upload-Metadata":encoded},timeout=120)
        r.raise_for_status()
        from urllib.parse import urljoin
        location=urljoin(details["endpoint"],r.headers["location"])
        if urlparse(location).netloc!=urlparse(details["endpoint"]).netloc:
            raise ValueError("Unexpected TUS upload host")
        with open(path,"rb") as stream:
            offset=0
            while offset<size:
                block=stream.read(CHUNK)
                response=SESSION.patch(location,headers={**headers,
                  "Upload-Offset":str(offset),"content-type":"application/offset+octet-stream"},
                  data=block,timeout=600)
                response.raise_for_status()
                offset+=len(block)
                if response.headers.get("upload-offset")!=str(offset):
                    raise RuntimeError("TUS offset mismatch")
    else:raise RuntimeError("Unsupported job upload mode")
    # Commit-only retry keeps the same storage object and upload ID.
    # Re-preparing or re-encoding can create duplicate pending artifacts.
    for attempt in range(1,5):
        try:
            api(job_id,"POST","/assets",
                {"action":"commit","uploadId":uid,"parts":parts,
                 "retryCommit":attempt>1},timeout=30,attempts=1)
            return uid
        except Exception as exc:
            mismatch="Uploaded size does not match the prepared object" in str(exc)
            retryable=mismatch or isinstance(exc,(requests.Timeout,requests.ConnectionError))
            if not retryable or attempt==4:raise
            safe_stage_log("commit_retry",attempt=attempt,bytes=size)
            time.sleep(min(attempt*2,6))
    return uid

def segment_name(mode,start,end):
    return f"modal_seg_v1_{mode}_{start:08d}_{end:08d}.mp4"

def capture_segment(job_id,bundle_name,mode,start,end,bundle_root=None,cancel_event=None):
    name=segment_name(mode,start,end)
    if cancel_event is not None and cancel_event.is_set():
        raise RuntimeError("Render cancelled")
    if ready_url(job_id,name):
        return {"name":name,"start":start,"end":end,"skipped":True,"seconds":0}
    stop=heartbeat_scope(job_id)
    beginning=time.monotonic()
    try:
        with tempfile.TemporaryDirectory() as directory:
            if bundle_root is None:
                root,project,entry,_=extract_bundle(job_id,bundle_name,directory)
            else:
                root=pathlib.Path(bundle_root)
                project=json.loads((root/"project.json").read_text())
                entry=project["composition"]["entryFile"]
            if end>project["frameCount"]:raise ValueError("Segment past film end")
            output=os.path.join(directory,name)
            checked(["node","/root/modal_motion/capture.mjs",str(root),entry,output,
                str(project["width"]),str(project["height"]),str(project["fps"]),
                str(start),str(end),mode],timeout=3600,cancel_event=cancel_event)
            if cancel_event is not None and cancel_event.is_set():
                raise RuntimeError("Render cancelled")
            # The completed capture stays on disk while upload/commit is
            # retried. Never reopen Chromium for a storage-only failure.
            for upload_attempt in range(1,4):
                try:
                    prepare_upload(job_id,output,name,"video","video/mp4")
                    break
                except Exception:
                    if upload_attempt==3:raise
                    safe_stage_log("segment_upload_retry",attempt=upload_attempt,
                                   bytes=os.path.getsize(output))
                    time.sleep(upload_attempt*2)
        return {"name":name,"start":start,"end":end,"skipped":False,
          "seconds":round(time.monotonic()-beginning,3)}
    finally:stop.set()

def ffprobe(path):
    # -count_packets reads the container index (no full decode); long films
    # made -count_frames exceed its timeout.
    out,_=checked(["ffprobe","-v","error","-count_packets","-show_streams",
      "-show_format","-of","json",path],timeout=1800)
    return json.loads(out)

def qa_video(path,expected_frames,fps,expected_width=None,expected_height=None):
    """Technical integrity only. Creative design is approved before rendering."""
    result=ffprobe(path)
    streams=result.get("streams",[])
    video=next((x for x in streams if x.get("codec_type")=="video"),None)
    audio=next((x for x in streams if x.get("codec_type")=="audio"),None)
    if not video or not audio:raise ValueError("Missing master video or audio")
    frames=int(video.get("nb_read_packets") or video.get("nb_read_frames") or 0)
    if frames!=expected_frames:raise ValueError("Frame count mismatch")
    if expected_width is not None and int(video.get("width") or 0)!=expected_width:
        raise ValueError("Wrong video resolution")
    if expected_height is not None and int(video.get("height") or 0)!=expected_height:
        raise ValueError("Wrong video resolution")
    rate=video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1"
    from fractions import Fraction
    if abs(float(Fraction(rate))-fps)>0.01:raise ValueError("Wrong video frame rate")
    expected=expected_frames/fps
    duration=float(result["format"]["duration"])
    if abs(duration-expected)>max(0.08,2/fps):
        raise ValueError("Master duration mismatch")
    a_duration=float(audio.get("duration") or duration)
    if abs(a_duration-expected)>0.20:
        raise ValueError("Audio/video duration mismatch")
    # Decode every video/audio frame. Packet count alone cannot detect corruption.
    checked(["ffmpeg","-nostdin","-v","error","-xerror","-i",path,
             "-map","0:v:0","-map","0:a:0","-f","null","-"],timeout=5400)
    # Integrated level is informational. The worker normalizes the encode;
    # loudness deviations must never reject an otherwise valid film.
    _,loud=checked(["ffmpeg","-nostdin","-hide_banner","-i",path,"-vn","-af",
      "ebur128=peak=true,volumedetect","-f","null","-"],timeout=1800)
    matches=re.findall(r"I:\s*(-?[0-9.]+) LUFS",loud)
    integrated=float(matches[-1]) if matches else None
    volumes=re.findall(r"max_volume:\s*(-?[0-9.]+) dB",loud)
    peak=float(volumes[-1]) if volumes else None
    if peak is None or peak<=-55:
        raise ValueError("Audio track is silent")
    return {"frames":frames,"duration":duration,"integratedLufs":integrated,
            "audioPeakDb":peak,"width":video["width"],"height":video["height"],
            "fps":fps}

def repair_loudness_if_needed(master):
    """Normalize again without re-encoding video when final LUFS drifted."""
    try:
        _,log=checked(["ffmpeg","-nostdin","-hide_banner","-i",master,"-vn",
          "-af","ebur128=peak=true","-f","null","-"],timeout=1800)
        readings=re.findall(r"I:\s*(-?[0-9.]+) LUFS",log)
        measured=float(readings[-1]) if readings else None
        if measured is None or -16.5<=measured<=-13.5:return False
        corrected=os.path.join(os.path.dirname(master),"renormalized.mp4")
        checked(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y",
          "-i",master,"-map","0:v:0","-map","0:a:0","-c:v","copy",
          "-af","loudnorm=I=-14:TP=-1.5:LRA=11","-ar","48000","-ac","2",
          "-c:a","aac","-b:a","192k","-movflags","+faststart",corrected],
          timeout=3600)
        os.replace(corrected,master)
        return True
    except Exception:
        # Integrity/decode checks still run in qa_video. A loudness-only
        # mismatch never destroys an otherwise usable film.
        return False

def join_and_qa(job_id,bundle_name,mode,segments,bundle_root=None,recovery_dir=None):
    start=time.monotonic()
    stop=heartbeat_scope(job_id)
    try:
        with tempfile.TemporaryDirectory() as directory:
            if bundle_root is None:
                root,project,_,audio=extract_bundle(job_id,bundle_name,directory)
            else:
                root=pathlib.Path(bundle_root)
                project=json.loads((root/"project.json").read_text())
                audio=(root/project["mixedAudioFile"]).resolve()
                if not str(audio).startswith(str(root.resolve())+os.sep) or not audio.is_file():
                    raise ValueError("Mixed audio missing from verified bundle")
            segments=sorted(segments,key=lambda s:s["start"])
            cursor=0
            inputs=[]
            for index,item in enumerate(segments):
                if item["start"]!=cursor:raise ValueError("Missing video segment")
                cursor=item["end"]
                target=os.path.join(directory,f"segment_{index:04}.mp4")
                fetch_file(job_id,item["name"],target)
                inputs.append(target)
            if cursor!=project["frameCount"]:raise ValueError("Incomplete film capture")
            listfile=os.path.join(directory,"concat.txt")
            pathlib.Path(listfile).write_text("".join(
              "file '"+f.replace("'","'\\''")+"'\n" for f in inputs))
            join=os.path.join(directory,"joined.mp4")
            checked(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat",
              "-safe","0","-i",listfile,"-c","copy",join],timeout=1800)
            master=os.path.join(directory,"master.mp4")
            checked(["ffmpeg","-hide_banner","-loglevel","error","-y",
              "-i",join,"-i",str(audio),"-map","0:v:0","-map","1:a:0",
              "-c:v","libx264","-preset","medium","-crf","16","-profile:v","high",
              "-level:v","4.2","-pix_fmt","yuv420p","-movflags","+faststart",
              "-af","loudnorm=I=-14:TP=-1.5:LRA=11","-ar","48000","-ac","2",
              "-c:a","aac","-b:a","192k","-frames:v",str(project["frameCount"]),master],timeout=5400)
            # The first mux already normalizes audio. Only if its integrated
            # level drifted, repair that audio stream without re-encoding video.
            repair_loudness_if_needed(master)
            # Register a diagnostic master BEFORE QA; a technical QA failure
            # must not destroy the only finished film.
            if recovery_dir:
                os.makedirs(recovery_dir,exist_ok=True)
                shutil.copy2(master,os.path.join(recovery_dir,"master.mp4"))
            master_id=prepare_upload(job_id,master,f"master_{mode}.mp4","video","video/mp4")
            share=os.path.join(directory,"share.mp4")
            duration=project["frameCount"]/project["fps"]
            scale="scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2"
            if duration>300:
                # Films over 5 minutes cannot fit under 24 MB at watchable audio+video
                # bitrates; encode one clean 720p CRF 30 preview instead of 7 passes.
                checked(["ffmpeg","-hide_banner","-loglevel","error","-y",
                  "-i",master,"-vf",scale,
                  "-c:v","libx264","-preset","medium","-crf","30",
                  "-profile:v","high","-level:v","4.2","-pix_fmt","yuv420p",
                  "-c:a","aac","-b:a","96k","-movflags","+faststart",share],timeout=3600)
            else:
                for crf in (26,29,32,35):
                    checked(["ffmpeg","-hide_banner","-loglevel","error","-y",
                      "-i",master,"-vf",scale,
                      "-c:v","libx264","-preset","medium","-crf",str(crf),
                      "-profile:v","high","-level:v","4.2","-pix_fmt","yuv420p",
                      "-c:a","aac","-b:a","128k","-movflags","+faststart",share],timeout=3600)
                    if os.path.getsize(share)<24_000_000:break
                else:
                    video_rate=max(100000,int(23_000_000*8/duration-96000))
                    for factor in (0.95,0.80,0.65):
                        target=max(90000,int(video_rate*factor))
                        checked(["ffmpeg","-hide_banner","-loglevel","error","-y",
                          "-i",master,"-vf",scale,
                          "-c:v","libx264","-preset","medium","-b:v",str(target),
                          "-maxrate",str(target),"-bufsize",str(target*2),
                          "-profile:v","high","-level:v","4.2","-pix_fmt","yuv420p",
                          "-c:a","aac","-b:a","96k","-movflags","+faststart",share],
                          timeout=3600)
                        if os.path.getsize(share)<24_000_000:break
                    else:raise ValueError("Share copy exceeds maximum size")
            if recovery_dir:
                shutil.copy2(share,os.path.join(recovery_dir,"share.mp4"))
            share_id=prepare_upload(job_id,share,f"share_{mode}.mp4","video","video/mp4")
            try:
                metrics=qa_video(master,project["frameCount"],project["fps"],
                                 project["width"],project["height"])
            except Exception:
                # Diagnostic still is saved and registered under the same job,
                # with no visual-design verdict. Never mask the actual QA error.
                diagnostic=os.path.join(
                    recovery_dir if recovery_dir else directory,"qa_frame.png")
                try:
                    checked(["ffmpeg","-nostdin","-hide_banner","-loglevel","error",
                        "-y","-ss","0","-i",master,"-frames:v","1",diagnostic],
                        timeout=120)
                    prepare_upload(job_id,diagnostic,f"qa_frame_{mode}.png",
                                   "media","image/png")
                except Exception:pass
                raise
            return {"masterUploadId":master_id,"shareUploadId":share_id,
                "masterBytes":os.path.getsize(master),"shareBytes":os.path.getsize(share),
                "qa":metrics,"seconds":round(time.monotonic()-start,3)}
    finally:stop.set()

def publish_editable(job_id,root):
    """Upload the immutable Producer package, preserving native hash IDs.

    Mirrors the existing publish-editable.mjs contract. No rendering here,
    no rewriter for arbitrary scene code, no additional master approval.
    """
    fast=root/"portable.json"
    if fast.is_file():
        payload=json.loads(fast.read_text())
        return api(job_id,"POST","/portable",payload,timeout=300)
    manifest_file=root/"package.json"
    bundles_file=root/"bundles.json"
    if not manifest_file.is_file() or not bundles_file.is_file():
        raise ValueError("Producer package.json and bundles.json missing")
    pkg=json.loads(manifest_file.read_text())
    bundles=json.loads(bundles_file.read_text())
    if pkg.get("schema")!="transovo.motion-package/1" or not isinstance(bundles,list):
        raise ValueError("Unsupported Producer package")
    assets=pkg.get("assets")
    if not isinstance(assets,dict):raise ValueError("Invalid Producer asset map")
    if len(assets)>10000:raise ValueError("Too many editable assets")
    records=[]
    work=[]
    dedupe={}
    for native_id,asset in assets.items():
        if not isinstance(native_id,str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}",native_id):
            raise ValueError("Invalid native asset ID")
        digest=asset.get("sha256","")
        if not re.fullmatch(r"[a-f0-9]{64}",digest):
            raise ValueError("Native source digest missing")
        blob=root/"blobs"/digest
        if not blob.is_file() or blob.is_symlink():
            raise ValueError("Immutable source blob missing")
        filename=asset.get("filename") or native_id
        filename=re.sub(r"[^A-Za-z0-9._-]","_",filename)[:120]
        kind=("bundle" if native_id.startswith("bnd_") else
              "font" if native_id.startswith("fnt_") else asset.get("kind","source"))
        mime=asset.get("mime") or "application/json"
        if mime in ("text/html","text/x-python","text/x-shellscript","text/markdown","text/vtt"):
            mime="text/plain"
        if os.path.getsize(blob)!=asset.get("bytes"):
            raise ValueError("Native source length mismatch")
        with open(blob,"rb") as src:
            if hashlib.file_digest(src,"sha256").hexdigest()!=digest:
                raise ValueError("Native source digest mismatch")
        # Identical native content may appear in multiple scenes; upload
        # each verified distinct blob once, regardless of its source name.
        key=(digest,asset["bytes"],kind,mime)
        if key not in dedupe:
            dedupe[key]=len(work)
            work.append((str(blob),filename,kind,mime))
        records.append({"id":native_id,"workIndex":dedupe[key],
                        "kind":kind,"sha256":digest})
    # Small bounded pool: network latency dominates tiny asset transfers.
    # Output order remains deterministic and manifests retain native IDs.
    def publish_one(item):
        path,filename,kind,mime=item
        started=time.monotonic()
        receipt=prepare_upload(job_id,path,filename,kind,mime)
        return receipt,time.monotonic()-started
    results=[None]*len(work)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        future_map={pool.submit(publish_one,item):index for index,item in enumerate(work)}
        for future in concurrent.futures.as_completed(future_map):
            index=future_map[future]
            receipt,seconds=future.result()
            results[index]=receipt
            safe_stage_log("editable_asset",index=index+1,seconds=round(seconds,3),
                           bytes=os.path.getsize(work[index][0]))
    for record in records:
        record["storageId"]=results[record.pop("workIndex")]
    records.sort(key=lambda a:a["id"])
    payload={"document":pkg["document"],"assets":records,"bundles":bundles}
    live=root/"live-project.json"
    if live.is_file():
        # The live timeline references assets by their NATIVE ids (ast_/fnt_/bnd_...), but the server only
        # accepts registered STORAGE ids (random upload ids). Remap every string that is a native id,
        # exactly like bg_delivery/manifest.mjs buildManifest does, or /portable refuses the timeline.
        storage={r["id"]:r["storageId"] for r in records}
        def remap(value):
            if isinstance(value,str):return storage.get(value,value)
            if isinstance(value,list):return [remap(x) for x in value]
            if isinstance(value,dict):return {k:remap(x) for k,x in value.items()}
            return value
        payload["liveProject"]=remap(json.loads(live.read_text()))
    return api(job_id,"POST","/portable",payload,timeout=300)
