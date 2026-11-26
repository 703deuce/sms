import json, sys, os
sys.path.insert(0, "/opt/agent/tests")
sys.path.insert(0, "/opt/agent/tools")
os.environ.setdefault("RUNS_DB", "/opt/agent/workspace/runs/runs.db")
import runlib as R
tests = json.load(open("/opt/agent/workspace/testdata/haiku20_nov25/tests.json"))
want = sys.argv[1:]
db = R.connect()
ids = []
for t in tests:
    if t["id"] not in want:
        continue
    title = "haiku20 %s %s" % (t["id"], t["name"][:50])
    rid, cid = R.enqueue(db, t["prompt"], "user", title=title, model="lab-anthropic")
    print(t["id"], rid, cid, flush=True)
    ids.append({"id": t["id"], "run": rid, "cid": cid})
open("/opt/agent/workspace/testdata/haiku20_nov25/last_batch.json", "w").write(json.dumps(ids, indent=2))
