import json, os, sys
sys.path.insert(0, "/opt/agent/tools"); os.environ.setdefault("RUNS_DB", "/opt/agent/workspace/runs/runs.db")
import runlib as R
H = "/opt/agent/tests/custfix_nov25"
ids = sys.argv[1].split(",")
db = R.connect()
try: out = json.load(open(H + "/batch.json"))
except Exception: out = []
for t in json.load(open(H + "/tests.json")):
    if t["id"] not in ids: continue
    rid, cid = R.enqueue(db, t["prompt"], "user", title="custfix " + t["id"] + " " + t["category"][:50], model="lab-anthropic")
    print(t["id"], rid, cid, flush=True); out.append({"id": t["id"], "run": rid, "cid": cid})
json.dump(out, open(H + "/batch.json", "w"), indent=1)
