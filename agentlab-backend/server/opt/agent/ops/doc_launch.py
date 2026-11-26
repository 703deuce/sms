import json, os, sys, time
sys.path.insert(0, '/opt/agent/tools'); sys.path.insert(0, '/opt/agent/runner')
os.environ.setdefault('RUNS_DB', '/opt/agent/workspace/runs/runs.db')
import runlib as R
label, name = sys.argv[1], sys.argv[2]
p = open('/opt/agent/ops/deanrayj_prompt.txt').read()
p = p.replace('[Ownership rerun with Opus, from the operator]', f'[{label}, from the operator]')
p = p.replace('--name "Deen vs Ray J opus rerun nov25"', f'--name "{name}"')
db = R.connect()
rid, cid = R.enqueue(db, p, 'user', title=name, model='lab-anthropic')
print(rid, cid, time.time())
