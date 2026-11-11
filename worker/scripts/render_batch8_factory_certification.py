#!/usr/bin/env python3
"""Render/QA sharded Batch 8 worker contracts using real worker lanes.

This is not a browser-preview substitute and never writes release scores. It
proves that every generated design can consume real decodable media, preserve
editable source segments/transitions/text/motion/music, produce an MP4 and
poster, and pass basic frame/audio/duration checks through the worker code.
"""
from __future__ import annotations
import argparse, hashlib, json, math, os, shutil, subprocess, sys, tempfile
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
W,H=180,320

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

def frame_mean(path:Path,frame:int,total:int)->float:
    sec=max(.01,min((total-2)/30.0,frame/30.0))
    data=subprocess.check_output([
        FFMPEG,"-v","error","-ss",f"{sec:.4f}","-i",str(path),"-frames:v","1",
        "-vf","scale=48:86,format=gray","-f","rawvideo","-pix_fmt","gray","-"],
        timeout=30)
    return sum(data)/max(1,len(data))

def fixtures(root:Path,music_source:Path,preview_sprites:list[dict])->tuple[dict[str,Path],Path]:
    media=root/"media"; media.mkdir(parents=True,exist_ok=True)
    paths:dict[str,Path]={}
    previews=ROOT/"new-app"/"public"/"clips"/"template-previews"
    if len(preview_sprites)!=10:
        raise RuntimeError("worker contract must pin exactly ten preview sprites")
    for i,row in enumerate(preview_sprites):
        sprite=previews/str(row.get("file") or "")
        if not sprite.is_file(): raise RuntimeError(f"missing first-party sprite {sprite}")
        if sha(sprite)!=row.get("sha256"):
            raise RuntimeError(f"first-party sprite SHA-256 drift: {sprite.name}")
        image=media/f"image_{i}.png"
        run(FFMPEG,"-y","-v","error","-i",str(sprite),"-vf",
            f"crop=iw/4:ih:0:0,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
            "-frames:v","1",str(image))
        paths[f"b8_image_{i}"]=image
        video=media/f"video_{i}.mp4"
        run(FFMPEG,"-y","-v","error","-loop","1","-i",str(image),"-t","8",
            "-vf",f"zoompan=z='min(zoom+0.0007,1.08)':d=240:s={W}x{H}:fps=30,format=yuv420p",
            "-an","-c:v","libx264","-preset","ultrafast","-crf","28",str(video))
        paths[f"b8_video_{i}"]=video
    if not music_source.is_file() or music_source.stat().st_size<=44:
        raise RuntimeError("missing pinned certification soundtrack")
    music=media/"music.wav"
    shutil.copyfile(music_source,music)
    return paths,music

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
        poster=target/"poster.jpg"
        run(FFMPEG,"-y","-v","error","-ss",f"{total/60:.3f}","-i",str(final),
            "-frames:v","1","-vf","scale=360:-2:flags=lanczos",str(poster))
    info=probe(final); streams=info.get("streams",[])
    duration=float(info["format"]["duration"])
    boundaries=[int(x) for x in row["boundaries"]]
    black=[f for f in [1,max(1,total-2),*boundaries[1:-1]] if frame_mean(final,f,total)<=8]
    checks={
        "productionRenderEditedClip":True,
        "video":any(s.get("codec_type")=="video" for s in streams),
        "audio":any(s.get("codec_type")=="audio" for s in streams),
        "duration":abs(duration-total/30.0)<0.12,
        "blackFrames":black,
        "sourceSegments":len(row["edits"].get("sourceSegments") or []),
        "transitions":len(row["edits"].get("transitions") or []),
        "textItems":len(row["edits"].get("textItems") or []),
        "musicTrack":bool((row["edits"].get("audio") or {}).get("music")),
    }
    expected_slots=len(boundaries)-1
    ok=(checks["video"] and checks["audio"] and checks["duration"] and not black and
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
        consumed=source_transition_boundaries(edits)
        transitions=[tr for tr in (edits.get("transitions") or [])
                     if int(round(float(tr.get("srcMs",-1)))) not in consumed]
        motion={**edits,"transitions":transitions or None}
        if motion.get("keyframes") or motion.get("transitions"):
            sourced=apply_motion_after_cut(sourced,sourced,motion,[(0,duration_ms)],0,work,{})
        text_out=work/"text.mp4"
        with_text=apply_text_items(sourced,text_out,edits,play_w=W,play_h=H)
        require_template_soundtrack((edits.get("audio") or {}).get("music") or {},music)
        final=target/"render.mp4"
        apply_audio_mix(with_text,final,music,[],length_s=total/30.0,volume=.35,
            duck_depth=.55,fade_in_s=.5,fade_out_s=1.0,music_loop=False)
        poster=target/"poster.jpg"
        run(FFMPEG,"-y","-v","error","-ss",f"{total/60:.3f}","-i",str(final),
            "-frames:v","1","-vf","scale=360:-2:flags=lanczos",str(poster))
    info=probe(final); streams=info.get("streams",[])
    duration=float(info["format"]["duration"])
    boundaries=[int(x) for x in row["boundaries"]]
    samples=[1,max(1,total-2),*boundaries[1:-1]]
    black=[f for f in samples if frame_mean(final,f,total)<=8]
    checks={
        "video":any(s.get("codec_type")=="video" for s in streams),
        "audio":any(s.get("codec_type")=="audio" for s in streams),
        "duration":abs(duration-total/30.0)<0.12,
        "blackFrames":black,
        "sourceSegments":len(row["edits"].get("sourceSegments") or []),
        "transitions":len(row["edits"].get("transitions") or []),
        "textItems":len(row["edits"].get("textItems") or []),
        "musicTrack":bool((row["edits"].get("audio") or {}).get("music")),
    }
    expected_slots=len(boundaries)-1
    ok=(checks["video"] and checks["audio"] and checks["duration"] and not black and
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
    ap.add_argument("--production-smoke",action="store_true")
    args=ap.parse_args()
    if not FFMPEG or not FFPROBE: raise RuntimeError("ffmpeg/ffprobe required")
    contract=json.loads(Path(args.contract).read_text())
    music_source=Path(args.music)
    if sha(music_source)!=contract.get("fixture",{}).get("musicSha"):
        raise RuntimeError("pinned certification soundtrack SHA-256 mismatch")
    rows=[r for i,r in enumerate(contract["designs"]) if i%args.shards==args.shard]
    if args.limit:rows=rows[:args.limit]
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    media,music=fixtures(out/"_fixtures",music_source,
        contract.get("fixture",{}).get("previewSprites") or [])
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
        print(f"[b8-render] {n}/{len(rows)} {row['id']} ok={result['ok']}",flush=True)
    manifest={"v":1,"shard":args.shard,"shards":args.shards,"expected":len(rows),
        "passed":sum(1 for r in results if r["ok"]),"failed":sum(1 for r in results if not r["ok"]),
        "results":results}
    (out/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    return 0 if manifest["failed"]==0 else 1
if __name__=="__main__":raise SystemExit(main())
