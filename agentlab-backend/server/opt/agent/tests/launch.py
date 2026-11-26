import sys, os
sys.path.insert(0, '/opt/agent/tools'); os.environ.setdefault('RUNS_DB', '/opt/agent/workspace/runs/runs.db')
import runlib as R
db = R.connect()
rid, cid = R.enqueue(db, sys.argv[2], 'user', title=sys.argv[1], model='lab-anthropic')
print(sys.argv[1], rid, cid, flush=True)
