import json, os, sys
sys.path.insert(0, "/opt/agent/tools"); os.environ.setdefault("RUNS_DB", "/opt/agent/workspace/runs/runs.db")
import runlib as R
H="/opt/agent/tests/hard5_nov25"
db = R.connect(); out=[]
for t in json.load(open(H+"/tests.json")):
    rid, cid = R.enqueue(db, t["prompt"], "user", title="hard5 "+t["id"]+" "+t["name"][:60], model="lab-anthropic")
    print(t["id"], rid, cid, flush=True); out.append({"id":t["id"],"run":rid,"cid":cid})
json.dump(out, open(H+"/batch.json","w"), indent=1)
