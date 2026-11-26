#!/usr/bin/env python3
"""cursor-efficiency before/after metrics. Usage: collect.py before after [--grade]"""
import os, sys, json, sqlite3, re, collections
from datetime import datetime
H5="/opt/agent/tests/hard5_nov25"; H="/opt/agent/tests/cursor_eff"; W="/opt/agent/workspace"
def load(path, drop):
    src=open(path).read(); src=src[:src.rindex(drop)]; g={"__name__":"x"}; exec(src,g); return g
C=load(H5+"/collect.py","\nmain()"); G=load(H5+"/grade.py","\ndef main():")
db=sqlite3.connect(W+"/runs/runs.db"); db.row_factory=sqlite3.Row
def tree(run, cid):
    r=db.execute("select * from runs where id=?",(run,)).fetchone(); kids=[r]; seen={r["id"]}; front=[cid]
    while front:
        nxt=[]
        for pc in front:
            for k in db.execute("select * from runs where parent_conversation_id=?",(pc,)).fetchall():
                if k["id"] not in seen: seen.add(k["id"]); kids.append(k); nxt.append(k["conversation_id"])
        front=[x for x in nxt if x]
    return r,kids
def toks(cid):
    try: s=json.load(open(f"{W}/conversations/{cid.replace('-','')}/base_state.json"))
    except Exception: return collections.Counter()
    c=collections.Counter()
    for m in (s.get("stats",{}).get("usage_to_metrics") or {}).values():
        t=m.get("accumulated_token_usage") or {}
        for k in ("prompt_tokens","cache_read_tokens","cache_write_tokens","completion_tokens"): c[k]+=t.get(k) or 0
    return c
def P(x): return datetime.fromisoformat(x.replace("Z","+00:00")) if x else None
rows=[]
for tag in [a for a in sys.argv[1:] if not a.startswith("--")]:
    for b in json.load(open(f"{H}/batch_{tag}.json")):
        r,kids=tree(b["run"],b["cid"]); usd=0; peak=0; calls=0; tk=collections.Counter(); tc=collections.Counter()
        opened=set(); cmdhits=collections.Counter(); ac_blocks=0
        for k in kids:
            if not k["conversation_id"]: continue
            u,p,m,n=C["true_cost"](k["conversation_id"]); usd+=u; peak=max(peak,p); calls+=n; tk+=toks(k["conversation_id"])
            evs=C["events"](k["conversation_id"])
            for e in evs:
                if e.get("kind")=="HookExecutionEvent" and "autocheck" in str(e.get("hook_command")) and e.get("blocked"): ac_blocks+=1
                if e.get("kind")!="ActionEvent": continue
                tn=e.get("tool_name"); tc[tn]+=1; a=e.get("action") or {}
                if tn=="file_editor" and a.get("command")=="view" and a.get("path"): opened.add(a["path"])
                if tn=="terminal":
                    c=a.get("command") or ""
                    for w in ("codesearch","repomap","qrun","read_section","autocheck","rg ","grep "): cmdhits[w.strip()]+=c.count(w)
                    for f in re.findall(r"read_section\s+(\S+)",c): opened.add(f)
                    for f in re.findall(r"(?:\bcat|sed -n '[^']*'|head(?: -n ?\d+)?|tail(?: -n ?\d+)?)\s+([\w./-]+\.py)\b",c): opened.add(f)
        done=[P(k["finished_at"]) for k in kids if k["finished_at"]]
        mins=round((max(done)-P(r["started_at"])).total_seconds()/60,1) if done and r["started_at"] else None
        v="?"
        if "--grade" in sys.argv:
            try: v,ev=G["g_h1"](G["host"](r["working_dir"])); v=f"{v} ({ev[-1]})"
            except Exception as ex: v=f"grade error {ex}"
        rows.append(dict(id=b["id"],status=r["status"],runs=len(kids),minutes=mins,cost_usd=round(usd,4),llm_calls=calls,peak_prompt=peak,
            prompt_tokens=tk["prompt_tokens"],cache_read=tk["cache_read_tokens"],cache_write=tk["cache_write_tokens"],completion=tk["completion_tokens"],
            files_opened=len(opened),tools=dict(tc),cmds={k:v for k,v in cmdhits.items() if v},autocheck_blocks=ac_blocks,grade=v))
        print(json.dumps(rows[-1]))
json.dump(rows,open(H+"/metrics.json","w"),indent=1)
print("TOTAL $%.4f"%sum(x["cost_usd"] for x in rows))
