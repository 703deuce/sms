import json, os, sys
sys.path.insert(0, "/opt/agent/tools"); os.environ.setdefault("RUNS_DB", "/opt/agent/workspace/runs/runs.db")
import runlib as R
H="/opt/agent/tests/cursor_eff"; tag=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 1
t=[x for x in json.load(open("/opt/agent/tests/hard5_nov25/tests.json")) if x["id"]=="h1"][0]
db=R.connect(); f=H+"/batch_"+tag+".json"; out=json.load(open(f)) if os.path.exists(f) else []
for i in range(n):
    rid,cid=R.enqueue(db, t["prompt"], "user", title=f"cursor-eff {tag} h1 more-itertools #{i+1}", model="lab-anthropic")
    print(rid,cid,flush=True); out.append({"id":f"h1-{tag}-{i+1}","run":rid,"cid":cid})
json.dump(out, open(f,"w"), indent=1)
