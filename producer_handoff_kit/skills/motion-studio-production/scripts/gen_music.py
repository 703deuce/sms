#!/usr/bin/env python3
"""Per-job ElevenLabs Music cues -> 48 kHz stereo WAV. No paid retries or secret logging."""
from __future__ import annotations
import argparse
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

PRICE_PER_MINUTE = 0.15
MUSIC_CAP = 2.0
FORMATS = {"mp3_48000_192", "mp3_44100_192", "mp3_44100_128"}
class MusicError(Exception): pass

def run(argv):
    p=subprocess.run(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False)
    if p.returncode: raise MusicError("Local media command failed, exit "+str(p.returncode))
    return p.stdout.decode("utf8","replace")

def duration(file):
    x=float(run(["ffprobe","-v","error","-show_entries","format=duration",
         "-of","default=nw=1:nk=1",str(file)]).strip())
    if not math.isfinite(x) or x<=0: raise MusicError("Invalid source audio duration")
    return x

def load_cues(file):
    data=json.loads(Path(file).read_text())
    total=data.get("film_duration_seconds")
    if isinstance(total,bool) or not isinstance(total,(int,float)) or not 3<=total<=18000:
        raise MusicError("Invalid film duration")
    rows=data.get("cues")
    if not isinstance(rows,list) or not 1<=len(rows)<=4: raise MusicError("Expected 1–4 cues")
    result=[]
    previous=0.
    for index,r in enumerate(rows):
        if not isinstance(r,dict):raise MusicError("Invalid cue record")
        cue_id=r.get("id",f"cue_{index}")
        if not isinstance(cue_id,str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,40}",cue_id):
            raise MusicError("Unsafe cue ID")
        start=float(r.get("start",-1)); end=float(r.get("end",-1))
        if not math.isfinite(start) or not math.isfinite(end) or end-start<3:
            raise MusicError("Music cues need at least three seconds")
        if abs(previous-start)>0.1: raise MusicError("Cues must cover timeline without gaps")
        prompt=r.get("prompt","")
        if not isinstance(prompt,str) or not 15<=len(prompt.strip())<=3900:
            raise MusicError("Invalid cue prompt")
        bpm=r.get("bpm")
        if isinstance(bpm,bool) or not isinstance(bpm,(int,float)) or not 40<=bpm<=240:
            raise MusicError("Tempo must be 40–240 BPM")
        drums=bool(r.get("drums",False))
        vocals=bool(r.get("vocals",False)) and not bool(data.get("has_narration",True))
        cue_ms=round((end-start)*1000)
        bar=4*60/float(bpm)
        if cue_ms<=120000:
            generated=cue_ms
        else:
            generated=round(min(180, max(120,round(120/bar)*bar))*1000)
        words=("Instrumental, no singing, lyrics or vocals." if not vocals else
               "Vocals are allowed where they serve the scene.")
        detail=f"{prompt.strip().rstrip('. ')}. {float(bpm):g} BPM; {'with drums' if drums else 'no drums'}. {words}"
        if cue_ms>120000: detail+=" Compose a steady looping background with clean musical bars."
        if index==len(rows)-1:detail+=" End with a resolved final musical phrase."
        if len(detail)>4100:raise MusicError("Cue prompt too long")
        result.append(dict(id=cue_id,start=start,end=end,prompt=detail,bpm=float(bpm),
                           drums=drums,vocals=vocals,generated_ms=generated,looped=cue_ms>120000))
        previous=end
    if abs(previous-total)>0.1:raise MusicError("Final cue must end on final frame")
    return float(total),result

def id_for(cue,model):
    keys=("id","start","end","prompt","bpm","drums","vocals","generated_ms")
    content={key:cue[key] for key in keys}
    content["model"]=model
    return hashlib.sha256(json.dumps(content,sort_keys=True).encode()).hexdigest()[:24]

def from_cache(folder,key):
    meta=folder/(key+".json")
    raw=folder/(key+".mp3")
    if not meta.is_file() or not raw.is_file():return None
    try:
        data=json.loads(meta.read_text())
        if data.get("cache_id")!=key or raw.stat().st_size<1000:return None
        if hashlib.sha256(raw.read_bytes()).hexdigest()!=data.get("audio_sha256"):return None
        return raw,data
    except (OSError,ValueError):return None

def generation(key,cue,fmt,model):
    payload=json.dumps({"model_id":model,"prompt":cue["prompt"],
      "music_length_ms":cue["generated_ms"],"force_instrumental":not cue["vocals"],
      "store_for_inpainting":False}).encode()
    url="https://api.elevenlabs.io/v1/music?"+urllib.parse.urlencode({"output_format":fmt})
    req=urllib.request.Request(url,method="POST",data=payload,headers={
        "xi-api-key":key,"Content-Type":"application/json","Accept":"audio/mpeg"})
    try:
        with urllib.request.urlopen(req,timeout=240) as response:
            audio=response.read(50000000)
            if len(audio)<1000:raise MusicError("API returned empty music")
            return audio,response.headers.get("song-id"),response.status
    except urllib.error.HTTPError as exc:
        if exc.code==422 and fmt!="mp3_44100_128":
            try: message=exc.read(4000).decode("utf8","replace").lower()
            except Exception:message=""
            if any(k in message for k in ("output_format","tier","bitrate","subscription","format not available")):
                raise MusicError("FORMAT_UNAVAILABLE") from None
        raise MusicError(f"Music API request rejected (HTTP {exc.code})") from None
    except (urllib.error.URLError,TimeoutError):
        raise MusicError("Music API unavailable") from None

def make_music(path,total,cues,sources,crossfade_ms=None):
    """True overlap crossfades on loops; music scene changes blend at authored turns."""
    if len(sources)!=len(cues):raise MusicError("Missing cue sources")
    with tempfile.TemporaryDirectory(prefix="transovo_music_") as temp:
        root=Path(temp);parts=[]
        for index,(cue,src) in enumerate(zip(cues,sources)):
            decoded=root/f"raw_{index}.wav"
            run(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y",
              "-i",str(src),"-ar","48000","-ac","2","-c:a","pcm_s24le",str(decoded)])
            length=cue["end"]-cue["start"]
            out=root/f"cue_{index}.wav"
            if cue["looped"]:
                bar=4*60/cue["bpm"]
                available=duration(decoded)
                body=max(1,math.floor((available-.08)/bar))*bar
                if body<3:raise MusicError("Loop source lacks a whole bar")
                overlap=min(1.0,bar,body/8)
                number=max(2,math.ceil((length-overlap)/(body-overlap)))
                if number>100:raise MusicError("Excessive music looping requested")
                command=["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y"]
                for _ in range(number):command+=["-i",str(decoded)]
                chain=[f"[{n}:a]atrim=0:{body:.6f},asetpts=PTS-STARTPTS[p{n}]" for n in range(number)]
                last="p0"
                for n in range(1,number):
                    label=f"cross{n}"
                    chain.append(f"[{last}][p{n}]acrossfade=d={overlap:.6f}:c1=tri:c2=tri[{label}]")
                    last=label
                chain.append(f"[{last}]atrim=0:{length:.6f},apad=whole_dur={length:.6f},atrim=0:{length:.6f}[out]")
                run(command+["-filter_complex",";".join(chain),"-map","[out]","-ar","48000","-ac","2",
                    "-c:a","pcm_s24le",str(out)])
            else:
                run(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y","-i",str(decoded),
                     "-af",f"atrim=0:{length:.6f},apad=whole_dur={length:.6f},atrim=0:{length:.6f}",
                     "-ar","48000","-ac","2","-c:a","pcm_s24le",str(out)])
            parts.append(out)
        command=["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y"]
        for item in parts:command+=["-i",str(item)]
        chains=[];inputs=[]
        for i,cue in enumerate(cues):
            span=cue["end"]-cue["start"]
            incoming=(min((crossfade_ms/1000 if crossfade_ms else 1),span*.2,
                         (cues[i-1]["end"]-cues[i-1]["start"])*.2) if i else 0)
            outgoing=(min((crossfade_ms/1000 if crossfade_ms else 1),span*.2,
                          (cues[i+1]["end"]-cues[i+1]["start"])*.2) if i<len(cues)-1 else 0)
            new_start=cue["start"]-incoming
            wanted=span+incoming
            speed=span/wanted
            fades=(f"afade=t=in:st=0:d={incoming:.6f}," if incoming else "")+(
                   f"afade=t=out:st={wanted-outgoing:.6f}:d={outgoing:.6f}," if outgoing else "")
            chains.append(f"[{i}:a]atempo={speed:.9f},atrim=0:{wanted:.6f},asetpts=PTS-STARTPTS,"+
                          fades+f"adelay={round(new_start*1000)}|{round(new_start*1000)}[a{i}]")
            inputs.append(f"[a{i}]")
        chains.append("".join(inputs)+f"amix=inputs={len(inputs)}:normalize=0,"+
                     f"atrim=0:{total:.6f},apad=whole_dur={total:.6f},atrim=0:{total:.6f}[out]")
        path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
        run(command+["-filter_complex",";".join(chains),"-map","[out]",
                     "-ar","48000","-ac","2","-c:a","pcm_s24le",str(path)])
        if abs(duration(path)-total)>.05:raise MusicError("Final music duration mismatch")

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--cues",required=True,type=Path)
    p.add_argument("--out",required=True,type=Path)
    p.add_argument("--raw-dir",type=Path)
    p.add_argument("--output-format",default="auto")
    p.add_argument("--model-id",default="music_v2_5")
    p.add_argument("--crossfade-ms",type=int)
    p.add_argument("--env-file",type=Path)
    p.add_argument("--dry-run",action="store_true")
    p.add_argument("--reuse-only",action="store_true")
    args=p.parse_args(argv)
    if args.model_id!="music_v2_5":raise MusicError("Unsupported music model")
    if args.crossfade_ms is not None and not 10<=args.crossfade_ms<=2000:
        raise MusicError("Crossfade outside 10–2000 ms")
    total,cues=load_cues(args.cues)
    generated=sum(c["generated_ms"] for c in cues)/60000
    estimate=generated*PRICE_PER_MINUTE
    fmt=args.output_format if args.output_format!="auto" else os.environ.get("MOTION_STUDIO_MUSIC_OUTPUT_FORMAT","auto")
    if fmt!="auto" and fmt not in FORMATS:raise MusicError("Unsupported audio format")
    if args.dry_run:
        print(json.dumps({"duration_seconds":total,"generated_minutes":round(generated,3),
          "estimated_usd":round(estimate,4),"cap_usd":MUSIC_CAP,"format":fmt,
          "cues":[{"id":c["id"],"generated_ms":c["generated_ms"],"looped":c["looped"]} for c in cues]}))
        return 0
    if estimate>MUSIC_CAP+1e-9:raise MusicError("Music estimate exceeds per-job limit")
    remaining=float(os.environ.get("MOTION_STUDIO_PAID_BUDGET_REMAINING_USD","5"))
    if estimate>remaining+1e-9:raise MusicError("Music estimate exceeds remaining paid-job budget")
    cache=args.raw_dir or args.out.parent/"music_src"
    cache.mkdir(parents=True,exist_ok=True)
    key=os.environ.get("ELEVENLABS_API_KEY")
    if not key and args.env_file and not args.reuse_only:
        for line in args.env_file.read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                key=line.partition("=")[2].strip().strip("'\"")
    sources=[];spent=0.; chosen=fmt
    for cue in cues:
        identity=id_for(cue,args.model_id)
        hit=from_cache(cache,identity)
        if hit:
            sources.append(hit[0])
            print(f"cue={cue['id']} cache=hit length_s={cue['generated_ms']/1000:g}")
            continue
        if args.reuse_only:raise MusicError("Required cached music missing")
        if not key:raise MusicError("ELEVENLABS_API_KEY is not set")
        # Publishing customer videos requires verified payg commercial rights;
        # do not initiate a paid call just because a key works.
        if os.environ.get("MOTION_STUDIO_ELEVENLABS_MUSIC_COMMERCIAL_OK")!="1":
            raise MusicError("Customer-video music rights not confirmed")
        current="mp3_48000_192" if chosen=="auto" else chosen
        try:audio,song,status=generation(key,cue,current,args.model_id)
        except MusicError as error:
            if str(error)=="FORMAT_UNAVAILABLE" and chosen=="auto":
                current="mp3_44100_128"
                audio,song,status=generation(key,cue,current,args.model_id)
                chosen=current
            else:raise
        paid=cue["generated_ms"]/60000*PRICE_PER_MINUTE
        spent+=paid
        path=cache/(identity+".mp3")
        path.write_bytes(audio)
        metadata={"cache_id":identity,"cue_id":cue["id"],"prompt":cue["prompt"],
          "start":cue["start"],"end":cue["end"],"bpm":cue["bpm"],"drums":cue["drums"],
          "vocals":cue["vocals"],"generated_ms":cue["generated_ms"],"model":args.model_id,
          "output_format":current,"song_id":song,"http_status":status,"byte_size":len(audio),
          "duration_seconds":duration(path),"estimated_usd":paid,
          "audio_sha256":hashlib.sha256(audio).hexdigest(),
          "created_at":datetime.datetime.now(datetime.timezone.utc).isoformat()}
        (cache/(identity+".json")).write_text(json.dumps(metadata,indent=2)+"\n")
        sources.append(path)
        print(f"cue={cue['id']} cache=miss length_s={cue['generated_ms']/1000:g} running_usd={spent:.4f}")
    make_music(args.out,total,cues,sources,args.crossfade_ms)
    print(f"music_out={args.out} duration_s={total:.3f} generated_usd={spent:.4f}")
    return 0

if __name__=="__main__":
    try: sys.exit(main())
    except (MusicError,OSError,ValueError,json.JSONDecodeError) as error:
        print("music generation unavailable: "+str(error),file=sys.stderr)
        sys.exit(2)
