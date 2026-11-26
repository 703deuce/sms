"""Produce a validated, complete render ZIP directly from a Producer job folder.

Derived from the on-box Producer make_bundle.py job-folder contract. Stdlib only.
"""
import hashlib,json,os,pathlib,re,shutil,tempfile,zipfile

PATH=re.compile(r"[A-Za-z0-9_./-]{1,200}$")
ID=re.compile(r"[A-Za-z0-9_.:-]{1,128}$")
SHA=re.compile(r"[a-f0-9]{64}$")
SKIP={".git","node_modules","__pycache__",".cache"}
RESERVED={"package.json","bundles.json","live-project.json","portable.json","blobs"}
COMPRESSED={".jpg",".jpeg",".png",".webp",".mp4",".webm",".mov",".woff",".woff2",".zip",".frames",".mp3",".m4a"}
MIME={"video/mp4","video/webm","video/quicktime","application/json","image/png","image/jpeg","image/webp","image/svg+xml","audio/mpeg","audio/wav","audio/x-wav","audio/mp4","text/plain","text/vtt","application/x-subrip","application/zip","font/ttf","font/otf","font/woff","font/woff2","application/octet-stream","application/wasm","application/javascript","text/javascript","text/css"}
KINDS={"video","project","media","audio","source","font","image","bundle"}

def sha(file):
    h=hashlib.sha256()
    with open(file,"rb") as src:
        for chunk in iter(lambda:src.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()

def paths(film):
    collected=[]
    for root,dirs,files in os.walk(film,followlinks=False):
        dirs[:]=sorted(d for d in dirs if d not in SKIP)
        for d in dirs:
            if (pathlib.Path(root)/d).is_symlink():raise ValueError("Symlink in film")
        for name in sorted(files):
            source=pathlib.Path(root)/name
            relative=source.relative_to(film).as_posix()
            if (source.is_symlink() or not PATH.fullmatch(relative) or
                relative.split("/")[0] in RESERVED):
                raise ValueError("Unsafe file in film")
            if relative=="project.json" or name.endswith((".tmp",".tmp.mp4",".swp",".log",".DS_Store")):continue
            if source.stat().st_size>2_000_000_000:raise ValueError("Film source too large")
            collected.append((relative,source))
    return collected

def live_package(job,stage,duration):
    base=job/"editable"/"live"
    found=next((base/"payload"/name for name in ("live.packed.json","live.json")
                 if (base/"payload"/name).is_file()),None)
    if not found:raise ValueError("Missing editable/live/payload/live.packed.json or live.json")
    live=json.loads(found.read_text())
    for k in ("durationMs","document","assets","bundles","liveProject"):
        if k not in live:raise ValueError("Editable package missing "+k)
    if live["durationMs"]!=duration or live["liveProject"].get("format",{}).get("durationMs")!=duration:
        raise ValueError("Editable and film durations differ")
    document=live["document"]
    if not document.get("projectId") or document.get("projectId")=="PLACEHOLDER_PROJECT_ID":
        raise ValueError("Editable project ID invalid")
    assets=live["assets"]
    if not isinstance(assets,list) or len(assets)>9950:raise ValueError("Invalid asset count")
    payload={}
    ids=set()
    (stage/"blobs").mkdir()
    for item in assets:
        native=item.get("id","")
        digest=item.get("sha256","")
        if (not isinstance(native,str) or not ID.fullmatch(native) or native in ids
            or not isinstance(digest,str) or not SHA.fullmatch(digest)):
            raise ValueError("Invalid native asset ID or digest")
        ids.add(native)
        kind=("bundle" if native.startswith("bnd_") else
              "font" if native.startswith("fnt_") else item.get("kind","source"))
        mime=item.get("mime") or "application/json"
        wire="text/plain" if mime in ("text/html","text/x-python","text/x-shellscript","text/markdown","text/vtt") else mime
        if kind not in KINDS or wire not in MIME:raise ValueError("Unsupported editable asset kind or mime")
        if kind in ("font","image","bundle") and item.get("bytes",0)>25*1024*1024:
            raise ValueError("Editable native asset over upload limit")
        if wire=="application/octet-stream" and (kind!="source" or
            not str(item.get("filename","")).endswith(".frames") or
            item.get("bytes",0)>16*1024*1024):
            raise ValueError("Invalid octet-stream upload")
        src=(base/item.get("file","")).resolve()
        if not str(src).startswith(str(base.resolve())+os.sep) or not src.is_file() or src.is_symlink():
            raise ValueError("Missing or unsafe editable blob")
        if src.stat().st_size!=item.get("bytes") or sha(src)!=digest:
            raise ValueError("Editable blob digest mismatch")
        dst=stage/"blobs"/digest
        if not dst.exists():shutil.copyfile(src,dst)
        payload[native]={"sha256":digest,"bytes":item["bytes"],"mime":mime,
                         "kind":item.get("kind",kind),"filename":item.get("filename") or native}
    for bundle in live["bundles"]:
        if bundle.get("bundleId") not in ids:raise ValueError("Unknown native scene bundle")
    (stage/"package.json").write_text(json.dumps({"schema":"transovo.motion-package/1",
       "projectId":document["projectId"],"durationMs":duration,"document":document,"assets":payload}))
    (stage/"bundles.json").write_text(json.dumps(live["bundles"]))
    (stage/"live-project.json").write_text(json.dumps(live["liveProject"]))
    return {"assets":len(assets),"bundles":len(live["bundles"])}

def build(job,out,film_dir=None,live_dir=None,entry="index.html",audio="audio.wav",no_editable=False):
    job=pathlib.Path(job).resolve()
    film=pathlib.Path(film_dir).resolve() if film_dir else job/"film"
    if not film.is_dir():raise ValueError("Producer job film/ directory missing")
    specfile=next((film/name for name in ("film.json","project.json") if (film/name).is_file()),None)
    if not specfile:raise ValueError("Producer film.json/project.json missing")
    spec=json.loads(specfile.read_text())
    for field in ("width","height","fps","frameCount"):
        if type(spec.get(field))!=int:raise ValueError("Film metadata is incomplete")
    w,h,fps,frames=(spec[x] for x in ("width","height","fps","frameCount"))
    if not (2<=w<=3840 and 2<=h<=2160 and 1<=fps<=120 and 0<frames<=2_000_000):
        raise ValueError("Film metadata invalid")
    listing=paths(film)
    if not (film/entry).is_file() or not (film/audio).is_file():
        raise ValueError("Full composition page and mixed audio are required")
    with tempfile.TemporaryDirectory(prefix="motion_bundle_stage_") as temp:
        stage=pathlib.Path(temp)
        entries=[]
        for rel,src in listing:
            dst=stage/rel
            dst.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(src,dst)
            entries.append({"path":rel,"bytes":src.stat().st_size,"sha256":sha(src)})
        duration=round(frames*1000/fps)
        editable=None
        if not no_editable:
            editable=live_package(job,stage,duration)
        project={"title":spec.get("title",""),"width":w,"height":h,"fps":fps,
           "frameCount":frames,"durationMs":duration,
           "composition":{"entryFile":entry},"mixedAudioFile":audio,
           "entry":entry,"audio":audio,
           "seek":{"ready":"window.__ready === true","method":"await window.__scene.seek(t)",
                   "tSeconds":"frameIndex / fps"},
           "assets":entries}
        (stage/"project.json").write_text(json.dumps(project))
        items=sorted((p for p in stage.rglob("*") if p.is_file()),
                     key=lambda p:(p.name!="project.json",p.as_posix()))
        if len(items)>10000 or sum(p.stat().st_size for p in items)>3_000_000_000:
            raise ValueError("Bundle exceeds file count or unpacked size")
        out=pathlib.Path(out)
        out.parent.mkdir(parents=True,exist_ok=True)
        tmp=out.with_suffix(".tmp.zip")
        with zipfile.ZipFile(tmp,"w",allowZip64=True) as zipfileout:
            for p in items:
                rel=p.relative_to(stage).as_posix()
                record=zipfile.ZipInfo(rel,(2020,1,1,0,0,0))
                record.external_attr=0o100644<<16
                record.compress_type=(zipfile.ZIP_STORED if p.suffix.lower() in COMPRESSED or
                                      rel.startswith("blobs/") else zipfile.ZIP_DEFLATED)
                with open(p,"rb") as src,zipfileout.open(record,"w",force_zip64=True) as dst:
                    shutil.copyfileobj(src,dst,1024*1024)
        if tmp.stat().st_size>2_000_000_000:
            tmp.unlink(missing_ok=True)
            raise ValueError("ZIP exceeds maximum upload size")
        os.replace(tmp,out)
    return {"bundle":str(out),"frameCount":frames,"durationMs":duration,
            "width":w,"height":h,"fps":fps,"editable":editable}
