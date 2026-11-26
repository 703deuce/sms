#!/usr/bin/env python3
"""Collect metrics for hard5 jobs. --watch: print status and stop runaways (> $1.50 or > 50 min)."""
import os, sys, json, glob, sqlite3, subprocess, re
from datetime import datetime, timezone
W="/opt/agent/workspace"; H="/opt/agent/tests/hard5_nov25"
CEIL_USD=1.50; CEIL_MIN=50
P={"opus":(4e-6,20e-6),"haiku":(1e-7,5e-7),"fable":(8e-6,40e-6)}
def fam(m): m=(m or "").lower(); return next((k for k in P if k in m),None)
def true_cost(cid):
    p=f"{W}/conversations/{cid.replace('-','')}/base_state.json"
    if not os.path.exists(p): return 0.0,0,"",0
    try: s=json.load(open(p))
    except Exception: return 0.0,0,"",0
    model=((s.get("agent") or {}).get("llm") or {}).get("model") or ""
    i,o=P.get(fam(model),(0,0)); usd=0; peak=0; n=0
    for u,m in (s.get("stats",{}).get("usage_to_metrics") or {}).items():
        t=m.get("accumulated_token_usage") or {}
        cr=t.get("cache_read_tokens") or 0; cw=t.get("cache_write_tokens") or 0
        usd+=((t.get("prompt_tokens") or 0)-cr-cw)*i+cw*i*1.25+cr*i*0.1+(t.get("completion_tokens") or 0)*o
        for tu in m.get("token_usages") or []:
            peak=max(peak,tu.get("prompt_tokens") or 0); n+=1
    return usd,peak,model,n
def snap(cid):
    for r in (W+"/runs/cost",):
        try: return json.load(open(f"{r}/{cid}.json")).get("llm_usd")
        except Exception: pass
def events(cid):
    out=[]
    for f in sorted(glob.glob(f"{W}/conversations/{cid.replace('-','')}/events/*.json")):
        try: out.append(json.load(open(f)))
        except Exception: pass
    return out
def tools_of(evs):
    counts={}; cmds=[]
    for e in evs:
        if e.get("kind")=="ActionEvent":
            tn=e.get("tool_name"); counts[tn]=counts.get(tn,0)+1
            a=(e.get("tool_call") or {}).get("arguments") or ""
            try: a=json.loads(a) if isinstance(a,str) else a
            except Exception: a={}
            c=a.get("command") or a.get("path") or ""
            if isinstance(c,str): cmds.append((tn,c))
    used={k:sum(1 for t,c in cmds if k in c) for k in ("read_section","--find","qrun","--digest","gitckpt","plan-check","save-skill","helper ","agent_load_browser")}
    used["agent_load_browser"]=counts.get("agent_load_browser",0)
    return counts,used,cmds
def parse(x):
    if not x: return None
    try: return datetime.fromisoformat(x.replace("Z","+00:00"))
    except Exception: return None
def main():
    watch="--watch" in sys.argv
    batch=json.load(open(H+"/batch.json"))
    db=sqlite3.connect(W+"/runs/runs.db"); db.row_factory=sqlite3.Row
    jl=subprocess.run("journalctl -u agent-lab-runner --no-pager --since '2026-11-25 16:20:00' | grep 'skill router'",shell=True,capture_output=True,text=True).stdout
    now=datetime.now(timezone.utc); rows=[]
    for b in batch:
        r=db.execute("select * from runs where id=?",(b["run"],)).fetchone()
        root=r["working_dir"] or ""
        kids=[r]; seen={r["id"]}; front=[b["cid"]]
        while front:
            nxt=[]
            for pc in front:
                for k in db.execute("select * from runs where parent_conversation_id=? order by created_at",(pc,)).fetchall():
                    if k["id"] not in seen: seen.add(k["id"]); kids.append(k); nxt.append(k["conversation_id"])
            front=[x for x in nxt if x]
        tree_status="running" if any(k["status"] in ("running","queued") for k in kids) else "done"
        lastfin=max([parse(k["finished_at"]) for k in kids if k["finished_at"]] or [None]) if tree_status=="done" else None
        usd=0; peak=0; models=set(); n=0; counts={}; used={}; snapusd=0; helpers=[]; cmds_all=[]
        for k in kids:
            if k["id"]!=b["run"]: helpers.append({"id":k["id"],"status":k["status"],"title":k["title"],"model":k["model"],"result":(k["result"] or "")[:400]})
            if not k["conversation_id"]: continue
            c,p,m,nn=true_cost(k["conversation_id"]); usd+=c; peak=max(peak,p); n+=nn
            if m: models.add(m)
            snapusd+=snap(k["conversation_id"]) or 0
            cc,uu,cmds=tools_of(events(k["conversation_id"])); cmds_all+=cmds
            for a,v in cc.items(): counts[a]=counts.get(a,0)+v
            for a,v in uu.items(): used[a]=used.get(a,0)+v
        picks=[]; rr=""
        for line in jl.splitlines():
            if b["run"] in line:
                rr=line.split("skill router",1)[-1].strip()
                m=re.search(r"picks=(\[[^\]]*\])",rr)
                if m:
                    try: picks=eval(m.group(1),{"__builtins__":{}})
                    except Exception: pass
                break
        a=parse(r["started_at"]); e=lastfin or (now if tree_status=="running" else parse(r["finished_at"]))
        mins=round((e-a).total_seconds()/60,2) if a and e else None
        rec=dict(id=b["id"],run=b["run"],cid=b["cid"],job=root,status=tree_status,front_status=r["status"],minutes=mins,cost_usd=round(usd,4),cost_snapshot_usd=round(snapusd,4),
                 peak_prompt_tokens=peak,ncalls=n,models=sorted(models),router_raw=rr[:300],router_picks=picks,tool_counts=counts,new_tools=used,
                 helpers=helpers,started_at=r["started_at"],finished_at=r["finished_at"],error=(r["error"] or "")[:300])
        rows.append(rec)
        print(f"{b['id']} {b['run']} tree={tree_status} {mins}min ${usd:.4f} (snap ${snapusd:.4f}) peak={peak} calls={n} picks={picks} helpers={len(helpers)} tools={counts} new={ {k:v for k,v in used.items() if v} }")
        if watch and tree_status=="running" and (usd>(0.50 if b["id"]=="f1" else CEIL_USD) or (mins or 0)>CEIL_MIN):
            print("  -> CEILING HIT, stopping", b["run"])
            subprocess.run(["python3","/opt/agent/tests/stoprun.py",b["run"]])
        if "--cmds" in sys.argv:
            for t,c in cmds_all[-int(sys.argv[sys.argv.index('--cmds')+1]):]: print("    ",t,c.replace("\n"," ")[:160])
    json.dump(rows,open(H+"/metrics.json","w"),indent=1)
    print("TOTAL $%.4f"%sum(x["cost_usd"] for x in rows))
main()
