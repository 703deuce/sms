#!/usr/bin/env python3
"""Validate or construct a single fully-composited render bundle; no rendering."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import zipfile

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
    if not (root/"portable.json").exists():
        if not (root/"package.json").exists() or not (root/"bundles.json").exists():
            raise ValueError("Editable document/package is missing")
    return project,entry

def check_page(root,entry,project):
    script=Path(__file__).with_name("check_page.mjs")
    result=subprocess.run(["node",str(script),str(root),entry,
          str(project["width"]),str(project["height"]),
          str(project["frameCount"]/project["fps"])],
          stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=180)
    if result.returncode:
        raise ValueError("Composed browser page did not pass seek checks")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--job-dir",required=True,type=Path)
    parser.add_argument("--bundle-root",type=Path)
    parser.add_argument("--check-page",action="store_true")
    args=parser.parse_args()
    job=args.job_dir.resolve()
    deliver=job/"deliver_modal"
    target=deliver/"render_bundle_v1.zip"
    source=args.bundle_root.resolve() if args.bundle_root else deliver/"render_bundle"
    deliver.mkdir(parents=True,exist_ok=True)
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
                z.extractall(root)
            project,entry=validate(root)
            if args.check_page:check_page(root,entry,project)
    else:
        if not source.is_dir():raise ValueError("No staged render bundle to pack")
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
    print(json.dumps({"bundle":str(target),"frames":project["frameCount"],
                     "fps":project["fps"],"verified":True}))

if __name__=="__main__":
    try:main()
    except (ValueError,OSError,KeyError,json.JSONDecodeError,subprocess.TimeoutExpired,
            zipfile.BadZipFile):
        print("Render bundle validation failed; inspect composition and project metadata.",
              file=sys.stderr)
        raise SystemExit(2)
