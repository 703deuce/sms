#!/usr/bin/env python3
"""Validate or construct a single fully-composited render bundle; no rendering."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import zipfile
from build_from_job import build as build_job_bundle

MAX_FILES=10000
MAX_BYTES=3_000_000_000

def validate(folder):
    root=Path(folder).resolve()
    project=json.loads((root/"project.json").read_text())
    width=project.get("width")
    height=project.get("height")
    fps=project.get("fps")
    frames=project.get("frameCount")
    runtime=project.get("durationMs")
    if not all(type(v)==int for v in (width,height,fps,frames,runtime)):
        raise ValueError("Invalid project dimensions/frame count")
    if not 2<=width<=3840 or not 2<=height<=2160 or not 1<=fps<=120 or frames<=0:
        raise ValueError("Invalid render size")
    if abs(runtime-frames*1000/fps)>100:
        raise ValueError("Frame count disagrees with duration")
    entry=project.get("composition",{}).get("entryFile")
    audio=project.get("mixedAudioFile")
    for label,path in (("composition entry",entry),("mixed audio",audio)):
        if not isinstance(path,str) or not re.fullmatch(r"[A-Za-z0-9_./-]{1,200}",path):
            raise ValueError("Unsafe "+label)
        target=(root/path).resolve()
        if not str(target).startswith(str(root)+os.sep) or not target.is_file():
            raise ValueError("Missing "+label)
    for asset in project.get("assets",[]):
        filename=asset.get("path","")
        if not isinstance(filename,str) or not re.fullmatch(r"[A-Za-z0-9_./-]{1,200}",filename):
            raise ValueError("Invalid project source path")
        source=(root/filename).resolve()
        if not str(source).startswith(str(root)+os.sep) or not source.is_file():
            raise ValueError("Project source missing")
        digest=hashlib.sha256(source.read_bytes()).hexdigest()
        if digest!=asset.get("sha256") or source.stat().st_size!=asset.get("bytes"):
            raise ValueError("Film source checksum mismatch")
    scripts=[p for p in root.rglob("*") if p.suffix in (".js",".mjs") and p.is_file()
             and p.stat().st_size<4_000_000]
    texts=[(root/entry).read_text(errors="ignore")]
    for script in scripts[:100]:texts.append(script.read_text(errors="ignore"))
    combined="\n".join(texts)
    if not all(name in combined for name in ("__scene","seek","__ready")):
        raise ValueError("Composition seek/readiness contract is incomplete")
    if not (root/"portable.json").exists():
        if not (root/"package.json").exists() or not (root/"bundles.json").exists():
            raise ValueError("Editable document/package is missing")
    return project,entry

def check_page(root,entry,project):
    script=Path(__file__).with_name("check_page.mjs")
    result=subprocess.run(["node",str(script),str(root),entry,
          str(project["width"]),str(project["height"]),
          str(project["fps"]),str(project["frameCount"])],
          stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=180)
    if result.returncode:
        # Only report fixed categories; never echo browser stderr containing
        # job media paths, signed asset URLs or private page content.
        diagnostic=(result.stderr or "").lower()
        if "puppeteer-core missing" in diagnostic:
            reason="puppeteer-core not found"
        elif ("browser not found" in diagnostic or
              "failed to launch the browser" in diagnostic or
              "could not find chrome" in diagnostic or
              "enoent" in diagnostic):
            reason="browser not found"
        else:
            reason="seek check failed"
        raise ValueError(reason)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--job-dir",type=Path)
    parser.add_argument("--validate-only",type=Path)
    parser.add_argument("--film-dir",type=Path)
    parser.add_argument("--entry",default="index.html")
    parser.add_argument("--audio",default="audio.wav")
    parser.add_argument("--out",type=Path)
    parser.add_argument("--no-editable",action="store_true")
    parser.add_argument("--bundle-root",type=Path)
    parser.add_argument("--check-page",action="store_true")
    args=parser.parse_args()
    if not args.job_dir and not args.validate_only:
        raise ValueError("Pass --job-dir or --validate-only")
    job=args.job_dir.resolve() if args.job_dir else None
    deliver=(job/"deliver_modal") if job else None
    target=(args.validate_only.resolve() if args.validate_only else
            args.out.resolve() if args.out else deliver/"render_bundle_v1.zip")
    if deliver:deliver.mkdir(parents=True,exist_ok=True)
    source=(args.bundle_root.resolve() if args.bundle_root else
            deliver/"render_bundle" if deliver else None)
    if not args.validate_only and job and not args.bundle_root:
        built=build_job_bundle(job,target,film_dir=args.film_dir,entry=args.entry,
                               audio=args.audio,no_editable=args.no_editable)
        # Always validate the generated archive before returning.
        if not target.is_file():raise ValueError("Producer bundle build failed")
    else:
        built=None
    if target.is_file():
        with tempfile.TemporaryDirectory(prefix="motion_bundle_verify_") as temp:
            root=Path(temp)
            with zipfile.ZipFile(target) as z:
                items=z.infolist()
                if len(items)>MAX_FILES or sum(i.file_size for i in items)>MAX_BYTES:
                    raise ValueError("Render bundle exceeds limits")
                for item in items:
                    path=(root/item.filename).resolve()
                    if not str(path).startswith(str(root)+os.sep):
                        raise ValueError("Invalid archive path")
                    if (item.external_attr>>16)&0o170000==0o120000:
                        raise ValueError("Symlink not allowed")
                if z.testzip():raise ValueError("Corrupt ZIP member")
                z.extractall(root)
            project,entry=validate(root)
            if not args.no_editable and not (root/"portable.json").is_file() and not (
                (root/"package.json").is_file() and (root/"bundles.json").is_file()
                and (root/"live-project.json").is_file()):
                raise ValueError("Native editable package missing")
            if args.check_page:check_page(root,entry,project)
    else:
        if source is None or not source.is_dir():raise ValueError("No staged render bundle to pack")
        project,entry=validate(source)
        if args.check_page:check_page(source,entry,project)
        sources=sorted(p for p in source.rglob("*") if p.is_file())
        if len(sources)>MAX_FILES or sum(p.stat().st_size for p in sources)>MAX_BYTES:
            raise ValueError("Staged render exceeds limits")
        for file in sources:
            if file.is_symlink() or not str(file.resolve()).startswith(str(source)+os.sep):
                raise ValueError("Unsafe source file")
        staging=deliver/"render_bundle_v1.zip.tmp"
        with zipfile.ZipFile(staging,"w",zipfile.ZIP_DEFLATED,compresslevel=2,
                             allowZip64=True) as z:
            for file in sources:z.write(file,file.relative_to(source).as_posix())
        os.replace(staging,target)
    print(json.dumps({"bundle":str(target),"width":project["width"],
                     "height":project["height"],"frameCount":project["frameCount"],
                     "durationMs":project["durationMs"],"frames":project["frameCount"],
                     "fps":project["fps"],"verified":True,"built":built}))

if __name__=="__main__":
    try:main()
    except (ValueError,OSError,KeyError,json.JSONDecodeError,subprocess.TimeoutExpired,
            zipfile.BadZipFile) as exc:
        # Safe, intentionally bounded error classes only. Raw exceptions may
        # contain absolute paths or signed asset URLs and must never be printed.
        message=str(exc).lower()
        allowed=("browser not found","puppeteer-core not found","seek check failed")
        reason=next((label for label in allowed if label in message),
                    "invalid composition or project metadata")
        print("Render bundle validation failed: "+reason,file=sys.stderr)
        raise SystemExit(2)
