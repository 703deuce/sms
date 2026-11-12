#!/usr/bin/env python3
"""Render/QA sharded Batch 8 worker contracts using real worker lanes.

This is not a browser-preview substitute and never writes release scores. It
proves that every generated design can consume real decodable media, preserve
editable source segments/transitions/text/motion/music, produce an MP4 and
poster, and pass basic frame/audio/duration checks through the worker code.
"""
from __future__ import annotations
import argparse, hashlib, json, math, os, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"worker"))
from clips_worker.audio_render import apply_audio_mix, require_template_soundtrack
from clips_worker.media_sources import apply_full_render_sources, source_transition_boundaries
from clips_worker.motion_render import apply_motion_after_cut
from clips_worker.text_items import apply_text_items
from clips_worker.edits_render import render_edited_clip

FFMPEG=shutil.which("ffmpeg")
FFPROBE=shutil.which("ffprobe")
W,H=720,1280

def run(*args:str)->None:
    subprocess.run(args,check=True,capture_output=True,text=True,timeout=180)

def sha(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

def probe(path:Path)->dict:
    return json.loads(subprocess.check_output([
        FFPROBE,"-v","error","-show_entries","format=duration:stream=codec_type",
        "-of","json",str(path)],text=True,timeout=30))

def video_frames(path:Path)->int:
    data=json.loads(subprocess.check_output([
        FFPROBE,"-v","error","-select_streams","v:0","-count_frames",
        "-show_entries","stream=nb_read_frames,nb_frames","-of","json",str(path)
    ],text=True,timeout=30))
    streams=data.get("streams") or []
    if not streams:return 0
    raw=streams[0].get("nb_read_frames") or streams[0].get("nb_frames") or 0
    try:return int(raw)
    except (TypeError,ValueError):return 0

def frame_lumas(path:Path)->list[float]:
    """Decode the exact output frame stream once; never infer black from an empty seek."""
    w,h=48,86
    data=subprocess.check_output([
        FFMPEG,"-v","error","-i",str(path),
        "-vf",f"scale={w}:{h},format=gray",
        "-f","rawvideo","-pix_fmt","gray","-"],
        timeout=60)
    frame_bytes=w*h
    if not data or len(data)%frame_bytes:
        raise RuntimeError("decoded QA stream is empty or not frame-aligned")
    return [
        sum(data[offset:offset+frame_bytes])/frame_bytes
        for offset in range(0,len(data),frame_bytes)
    ]

def transition_black_frames(row:dict,lumas:list[float],fps:int=30)->list[int]:
    """Fail closed on black flashes inside authored non-black transition windows."""
    out:set[int]=set()
    for tr in (row.get("edits") or {}).get("transitions") or []:
        if not isinstance(tr,dict) or tr.get("type")=="dip_black":
            continue
        try:
            center=int(round(float(tr.get("srcMs"))*fps/1000.0))
            frames=max(2,int(round(float(tr.get("durMs") or 0)*fps/1000.0)))
        except (TypeError,ValueError):
            continue
        lo=max(0,center-(frames+1)//2-1)
        hi=min(len(lumas),center+frames//2+2)
        for frame in range(lo,hi):
            if lumas[frame]<=8:
                out.add(frame)
    return sorted(out)


def git_blob_sha(path:Path)->str:
    data=path.read_bytes()
    header=f"blob {len(data)}\0".encode()
    return hashlib.sha1(header+data).hexdigest()

def _download_cc0_photos(root:Path,manifest_ref:dict)->list[Path]:
    rel=str(manifest_ref.get("path") or "")
    manifest_path=(ROOT/rel).resolve()
    if not rel or ROOT not in manifest_path.parents or not manifest_path.is_file():
        raise RuntimeError("missing pinned CC0 photo manifest")
    manifest=json.loads(manifest_path.read_text())
    if manifest.get("v")!=1 or manifest.get("revision")!=manifest_ref.get("revision"):
        raise RuntimeError("CC0 photo manifest revision drift")
    if manifest.get("license")!="CC0-1.0" or len(manifest.get("photos") or [])<4:
        raise RuntimeError("CC0 photo manifest must contain licensed photographic fixtures")
    out=root/"cc0"; out.mkdir(parents=True,exist_ok=True)
    paths=[]
    for index,row in enumerate(manifest["photos"]):
        sha1=str(row.get("sha1") or "").lower()
        filename=str(row.get("fileName") or "")
        if len(sha1)!=40 or not filename or not str(row.get("pageUrl") or "").startswith("https://commons.wikimedia.org/wiki/File:"):
            raise RuntimeError("invalid CC0 photo source row")
        target=out/f"{index:02d}_{Path(filename).name}"
        if not target.is_file() or hashlib.sha1(target.read_bytes()).hexdigest()!=sha1:
            url="https://commons.wikimedia.org/wiki/Special:Redirect/file/"+urllib.parse.quote(filename)
            request=urllib.request.Request(url,headers={
                "User-Agent":"TransovoTemplateCertification/1.0 (+https://transovo.ai)"
            })
            with urllib.request.urlopen(request,timeout=90) as response, target.open("wb") as fh:
                shutil.copyfileobj(response,fh)
        if hashlib.sha1(target.read_bytes()).hexdigest()!=sha1:
            raise RuntimeError("CC0 photo SHA-1 mismatch: "+filename)
        paths.append(target)
    return paths


def fixtures(root:Path,music_source:Path,photo_manifest:dict)->tuple[dict[str,Path],Path]:
    media=root/"media"; media.mkdir(parents=True,exist_ok=True)
    paths:dict[str,Path]={}
    photos=_download_cc0_photos(root,photo_manifest)
    for i in range(10):
        source=photos[i%len(photos)]
        image=media/f"image_{i}{source.suffix.lower()}"
        if not image.is_file(): shutil.copyfile(source,image)
        paths[f"b8_image_{i}"]=image
        video=media/f"video_{i}.mp4"
        if not video.is_file():
            run(FFMPEG,"-y","-v","error","-loop","1","-i",str(image),"-t","8",
                "-vf",f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                      f"zoompan=z='min(zoom+0.0008,1.10)':d=240:s={W}x{H}:fps=30,format=yuv420p",
                "-an","-c:v","libx264","-preset","ultrafast","-crf","22",str(video))
        paths[f"b8_video_{i}"]=video
    if not music_source.is_file() or music_source.stat().st_size<=44:
        raise RuntimeError("missing pinned certification soundtrack")
    music=media/"music.wav"
    shutil.copyfile(music_source,music)
    return paths,music


def stable_slot_frame(boundaries:list[int])->int:
    spans=[(b-a,a,b) for a,b in zip(boundaries,boundaries[1:]) if b-a>=3]
    if not spans:return 1
    _span,a,b=max(spans)
    return max(a+1,min(b-2,a+(b-a)//2))


def carrier(cache:dict[int,Path],work:Path,total:int)->Path:
    if total in cache:return cache[total]
    path=work/f"carrier_{total}.mp4"
    run(FFMPEG,"-y","-v","error","-f","lavfi","-i",
        f"color=c=#151515:s={W}x{H}:r=30:d={total/30:.6f}",
        "-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000",
        "-t",f"{total/30:.6f}","-c:v","libx264","-preset","ultrafast",
        "-pix_fmt","yuv420p","-c:a","aac","-shortest",str(path))
    cache[total]=path
    return path

def render_production_smoke(row:dict,out_root:Path,media:dict[str,Path],music:Path,cache:dict[int,Path])->dict:
    did=row["id"]; total=int(row["totalFrames"]); duration_ms=round(total*1000/30)
    target=out_root/did; target.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f"b8-prod-{did}-") as td:
        work=Path(td)
        src=carrier(cache,out_root/"_carrier_cache",total)
        final=target/"render.mp4"
        settings={"aspectRatio":"9:16","exportResolution":"720p","layout":"full_frame",
                  "captions":{"enabled":False},"aiMeta":{"videoTemplate":{"v":1}}}
        audio_assets={
            "media_paths":media,"music_path":music,"sfx_paths":[],
            "music_meta":{"volume":0.35,"duckDepth":0.55,"fadeInMs":500,
                          "fadeOutMs":1000,"loop":False},
        }
        render_meta={}
        rendered,_,_=render_edited_clip(
            src,final,[],row["edits"],0,duration_ms,settings,work,
            audio_assets=audio_assets,render_id="b8-production-smoke",
            render_meta=render_meta,compose_spec=None,
        )
        if rendered != final and rendered.is_file():
            shutil.copy(rendered,final)
        boundaries=[int(x) for x in row["boundaries"]]
        poster_frame=stable_slot_frame(boundaries)
        poster=target/"poster.jpg"
        run(FFMPEG,"-y","-v","error","-ss",f"{poster_frame/30:.4f}","-i",str(final),
            "-frames:v","1","-vf","scale=720:-2:flags=lanczos",str(poster))
    info=probe(final); streams=info.get("streams",[])
    duration=float(info["format"]["duration"])
    boundaries=[int(x) for x in row["boundaries"]]
    frame_count=video_frames(final)
    lumas=frame_lumas(final)
    interiors=[max(a+1,min(b-2,a+(b-a)//2)) for a,b in zip(boundaries,boundaries[1:]) if b-a>=3]
    samples=[1,max(1,total-1),*interiors]
    black=[frame for frame in samples if frame>=len(lumas) or lumas[frame]<=8]
    transition_black=transition_black_frames(row,lumas)
    checks={
        "productionRenderEditedClip":True,
        "expectedFrames":total,
        "videoFrames":frame_count,
        "frameCountExact":frame_count==total,
        "posterFrame":stable_slot_frame(boundaries),
        "photoFixtureCount":len([key for key in media if key.startswith("b8_image_")]),
        "video":any(s.get("codec_type")=="video" for s in streams),
        "audio":any(s.get("codec_type")=="audio" for s in streams),
        "duration":abs(duration-total/30.0)<0.12,
        "blackFrames":black,
        "transitionBlackFrames":transition_black,
        "sourceSegments":len(row["edits"].get("sourceSegments") or []),
        "transitions":len(row["edits"].get("transitions") or []),
        "textItems":len(row["edits"].get("textItems") or []),
        "musicTrack":bool((row["edits"].get("audio") or {}).get("music")),
    }
    expected_slots=len(boundaries)-1
    ok=(checks["video"] and checks["audio"] and checks["duration"] and
        checks["frameCountExact"] and not black and not transition_black and
        checks["sourceSegments"]==expected_slots and
        checks["transitions"]==max(0,expected_slots-1) and
        checks["textItems"]>=2 and checks["musicTrack"])
    return {"id":did,"definitionHash":row["definitionHash"],"ok":ok,
        "render":str(final.relative_to(out_root)),"poster":str(poster.relative_to(out_root)),
        "renderSha256":sha(final),"posterSha256":sha(poster),"checks":checks}

def render(row:dict,out_root:Path,media:dict[str,Path],music:Path,cache:dict[int,Path])->dict:
    did=row["id"]; total=int(row["totalFrames"]); duration_ms=round(total*1000/30)
    target=out_root/did; target.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f"b8-{did}-") as td:
        work=Path(td); edits=row["edits"]
        src=carrier(cache,out_root/"_carrier_cache",total)
        sourced=apply_full_render_sources(src,edits,0,duration_ms,work,media)
        stage_frames={"carrier":video_frames(src),"sources":video_frames(sourced)}
        consumed=source_transition_boundaries(edits)
        transitions=[tr for tr in (edits.get("transitions") or [])
                     if int(round(float(tr.get("srcMs",-1)))) not in consumed]
        motion={**edits,"transitions":transitions or None}
        if motion.get("keyframes") or motion.get("transitions"):
            sourced=apply_motion_after_cut(sourced,sourced,motion,[(0,duration_ms)],0,work,{})
        stage_frames["motion"]=video_frames(sourced)
        text_out=work/"text.mp4"
        with_text=apply_text_items(sourced,text_out,edits,play_w=W,play_h=H)
        stage_frames["text"]=video_frames(with_text)
        require_template_soundtrack((edits.get("audio") or {}).get("music") or {},music)
        final=target/"render.mp4"
        apply_audio_mix(with_text,final,music,[],length_s=total/30.0,volume=.35,
            duck_depth=.55,fade_in_s=.5,fade_out_s=1.0,music_loop=False)
        stage_frames["audioMix"]=video_frames(final)
        boundaries=[int(x) for x in row["boundaries"]]
        poster_frame=stable_slot_frame(boundaries)
        poster=target/"poster.jpg"
        run(FFMPEG,"-y","-v","error","-ss",f"{poster_frame/30:.4f}","-i",str(final),
            "-frames:v","1","-vf","scale=720:-2:flags=lanczos",str(poster))
    info=probe(final); streams=info.get("streams",[])
    duration=float(info["format"]["duration"])
    boundaries=[int(x) for x in row["boundaries"]]
    interiors=[max(a+1,min(b-2,a+(b-a)//2)) for a,b in zip(boundaries,boundaries[1:]) if b-a>=3]
    samples=[1,max(1,total-1),*interiors]
    lumas=frame_lumas(final)
    black=[frame for frame in samples if frame>=len(lumas) or lumas[frame]<=8]
    transition_black=transition_black_frames(row,lumas)
    checks={
        "video":any(s.get("codec_type")=="video" for s in streams),
        "audio":any(s.get("codec_type")=="audio" for s in streams),
        "duration":abs(duration-total/30.0)<0.12,
        "blackFrames":black,
        "sourceSegments":len(row["edits"].get("sourceSegments") or []),
        "transitions":len(row["edits"].get("transitions") or []),
        "textItems":len(row["edits"].get("textItems") or []),
        "musicTrack":bool((row["edits"].get("audio") or {}).get("music")),
        "expectedFrames":total,"videoFrames":video_frames(final),"stageFrames":stage_frames,
        "posterFrame":stable_slot_frame(boundaries),
        "photoFixtureCount":len([key for key in media if key.startswith("b8_image_")]),
    }
    checks["frameCountExact"]=checks["videoFrames"]==total
    expected_slots=len(boundaries)-1
    ok=(checks["video"] and checks["audio"] and checks["duration"] and
        checks["frameCountExact"] and not black and not transition_black and
        checks["sourceSegments"]==expected_slots and
        checks["transitions"]==max(0,expected_slots-1) and
        checks["textItems"]>=2 and checks["musicTrack"])
    return {"id":did,"definitionHash":row["definitionHash"],"ok":ok,
        "render":str(final.relative_to(out_root)),"poster":str(poster.relative_to(out_root)),
        "renderSha256":sha(final),"posterSha256":sha(poster),"checks":checks}

def main()->int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--contract",required=True);ap.add_argument("--out",required=True)
    ap.add_argument("--music",required=True)
    ap.add_argument("--shard",type=int,required=True);ap.add_argument("--shards",type=int,required=True)
    ap.add_argument("--limit",type=int,default=0)
    ap.add_argument("--ids",default="",help="comma-separated exact design IDs; when set, bypass shard selection")
    ap.add_argument("--production-smoke",action="store_true")
    args=ap.parse_args()
    if not FFMPEG or not FFPROBE: raise RuntimeError("ffmpeg/ffprobe required")
    contract=json.loads(Path(args.contract).read_text())
    music_source=Path(args.music)
    if sha(music_source)!=contract.get("fixture",{}).get("musicSha"):
        raise RuntimeError("pinned certification soundtrack SHA-256 mismatch")
    requested={value.strip() for value in args.ids.split(",") if value.strip()}
    if requested:
        by_id={str(row.get("id") or ""):row for row in contract["designs"]}
        missing=sorted(requested-set(by_id))
        if missing: raise RuntimeError("unknown certification design IDs: "+",".join(missing))
        rows=[row for row in contract["designs"] if row.get("id") in requested]
    else:
        rows=[r for i,r in enumerate(contract["designs"]) if i%args.shards==args.shard]
    if args.limit:rows=rows[:args.limit]
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    media,music=fixtures(out/"_fixtures",music_source,
        contract.get("fixture",{}).get("photoManifest") or {})
    cache_dir=out/"_carrier_cache";cache_dir.mkdir(exist_ok=True)
    cache:dict[int,Path]={}
    results=[]
    for n,row in enumerate(rows,1):
        try:
            result=(render_production_smoke(row,out,media,music,cache)
                    if args.production_smoke else render(row,out,media,music,cache))
        except Exception as exc:
            result={"id":row["id"],"definitionHash":row["definitionHash"],"ok":False,
                "error":f"{type(exc).__name__}: {str(exc)[:500]}"}
        results.append(result)
        if result.get("ok"):
            print(f"[b8-render] {n}/{len(rows)} {row['id']} ok=True",flush=True)
        else:
            print(f"[b8-render] {n}/{len(rows)} {row['id']} ok=False "
                  f"checks={json.dumps(result.get('checks') or {})} "
                  f"error={result.get('error','')}",flush=True)
    manifest={"v":1,"shard":args.shard,"shards":args.shards,"expected":len(rows),
        "passed":sum(1 for r in results if r["ok"]),"failed":sum(1 for r in results if not r["ok"]),
        "results":results}
    (out/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    return 0 if manifest["failed"]==0 else 1
if __name__=="__main__":raise SystemExit(main())
