#!/usr/bin/env python3
import os, sys, json, glob, sqlite3, subprocess, re
from datetime import datetime, timezone, timedelta
W = "/opt/agent/workspace"
tests = json.load(open(W + "/testdata/haiku20_nov25/tests.json"))
# official mapping
MAP = {
"t01":"run_4eb81bc482","t02":"run_560cb8b5a6","t03":"run_28edff74cf","t04":"run_385f56760b","t05":"run_274407a5b9",
"t06":"run_dd943d8750","t07":"run_fadf3258b8","t08":"run_de03edf37c","t09":"run_c0750c8978","t10":"run_9db2779fe0",
"t11":"run_5acc54c548","t12":"run_217324844c","t13":"run_87dd3e3e43","t14":"run_843fd9e1d4","t15":"run_382c3a50a1",
"t16":"run_4cbda7d2ba","t17":"run_150eafda76","t18":"run_eed6eb3205","t19":"run_b3234f763b","t20":"run_1a01102cd4",
}
P = {"opus": (4e-6, 20e-6), "haiku": (1e-7, 5e-7), "fable": (8e-6, 40e-6)}
def fam(m):
    m = (m or "").lower()
    return next((k for k in P if k in m), None)

def true_cost(cid):
    if not cid: return 0.0, 0, ""
    p = f"{W}/conversations/{cid.replace('-','')}/base_state.json"
    if not os.path.exists(p):
        return 0.0, 0, ""
    s = json.load(open(p))
    model = ((s.get("agent") or {}).get("llm") or {}).get("model") or ""
    f = fam(model)
    tot = {"in": 0, "cw": 0, "cr": 0, "out": 0}
    peak = 0
    ncalls = 0
    for u, m in (s.get("stats", {}).get("usage_to_metrics") or {}).items():
        t = m.get("accumulated_token_usage") or {}
        tot["in"] += (t.get("prompt_tokens") or 0) - (t.get("cache_read_tokens") or 0) - (t.get("cache_write_tokens") or 0)
        tot["cw"] += t.get("cache_write_tokens") or 0
        tot["cr"] += t.get("cache_read_tokens") or 0
        tot["out"] += t.get("completion_tokens") or 0
        for tu in m.get("token_usages") or []:
            peak = max(peak, tu.get("prompt_tokens") or 0)
            ncalls += 1
    i, o = P.get(f, (0, 0))
    usd = tot["in"] * i + tot["cw"] * i * 1.25 + tot["cr"] * i * 0.1 + tot["out"] * o
    return usd, peak, model, ncalls, tot

def events(cid):
    d = f"{W}/conversations/{cid.replace('-','')}/events"
    evs = []
    if not os.path.isdir(d):
        return evs
    for f in sorted(glob.glob(d + "/*.json")):
        try:
            evs.append(json.load(open(f)))
        except Exception:
            pass
    return evs

def tools_of(evs):
    cmds = []
    counts = {}
    big = []
    for e in evs:
        k = e.get("kind")
        if k == "ActionEvent":
            tc = e.get("tool_call") or {}
            args = tc.get("arguments") or ""
            try:
                a = json.loads(args) if isinstance(args, str) else (args or {})
            except Exception:
                a = {}
            c = a.get("command") or a.get("path") or ""
            if isinstance(c, str):
                cmds.append((e.get("tool_name"), c.replace("\n", " ")[:200]))
            counts[e.get("tool_name")] = counts.get(e.get("tool_name"), 0) + 1
        if k == "ObservationEvent":
            txt = json.dumps(e.get("observation") or {})
            if len(txt) > 10000:
                big.append(len(txt))
    used = {n: sum(1 for t, c in cmds if n in c) for n in ("read_section", "--find", "qrun", "--digest", "gitckpt", "plan-check")}
    return counts, used, big, cmds

jl = subprocess.run("journalctl -u agent-lab-runner --no-pager --since '2026-11-25 13:17:00' | grep 'skill router'",
                    shell=True, capture_output=True, text=True).stdout
db = sqlite3.connect(W + "/runs/runs.db")
db.row_factory = sqlite3.Row

rows = []
for t in tests:
    tid = t["id"]
    rid = MAP[tid]
    r = db.execute("select * from runs where id=?", (rid,)).fetchone()
    # children
    root = r["working_dir"]
    kids = db.execute("select * from runs where working_dir=? or working_dir like ? order by created_at",
                      (root, root + "/%")).fetchall()
    usd = 0.0
    peak = 0
    models = set()
    ncalls = 0
    all_counts = {}
    all_used = {}
    all_big = []
    router = ""
    for k in kids:
        if k["conversation_id"]:
            c, p, m, n, tot = true_cost(k["conversation_id"])
            usd += c
            peak = max(peak, p)
            if m: models.add(m)
            ncalls += n
            evs = events(k["conversation_id"])
            counts, used, big, cmds = tools_of(evs)
            for a,b in counts.items():
                all_counts[a] = all_counts.get(a,0)+b
            for a,b in used.items():
                all_used[a] = all_used.get(a,0)+b
            all_big += big
        for line in jl.splitlines():
            if k["id"] in line and "skill router" in line:
                # first front router
                if (k["id"] == rid or "role=front" in line) and not router:
                    router = line.split("skill router", 1)[-1].strip()
    if not router:
        for line in jl.splitlines():
            if rid in line:
                router = line.split("skill router", 1)[-1].strip()
                break
    # parse picks
    picks = []
    m = re.search(r"picks=(\[[^\]]*\])", router)
    if m:
        try:
            picks = eval(m.group(1), {"__builtins__": {}})
        except Exception:
            picks = [m.group(1)]
    st = r["started_at"]
    fn = r["finished_at"]
    def parse(x):
        if not x: return None
        x = x.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(x)
        except Exception:
            return None
    a, b = parse(st), parse(fn)
    mins = round((b-a).total_seconds()/60.0, 2) if a and b else None
    gpath = f"{W}/testdata/haiku20_nov25/grades/{tid}.json"
    g = json.load(open(gpath)) if os.path.exists(gpath) else {}
    rec = {
        "id": tid, "name": t["name"], "category": t["category"], "source": t["source"],
        "run": rid, "job": r["working_dir"], "status": r["status"],
        "minutes": mins, "cost_usd": round(usd, 6), "peak_prompt_tokens": peak,
        "ncalls": ncalls, "models": sorted(models), "router_raw": router[:300],
        "router_picks": picks, "tool_counts": all_counts, "new_tools": all_used,
        "outputs_over_10k": all_big, "pass": g.get("pass"), "evidence": g.get("evidence"),
        "started_at": st, "finished_at": fn, "n_runs_in_tree": len(kids),
    }
    rows.append(rec)
    print(f"{tid} {rid} pass={rec['pass']} ${rec['cost_usd']:.4f} {mins}min peak={peak} picks={picks} new={all_used} tools={all_counts}")

open(W + "/testdata/haiku20_nov25/results.json","w").write(json.dumps(rows, indent=2))
print("TOTAL", round(sum(r["cost_usd"] for r in rows), 4), "pass", sum(1 for r in rows if r["pass"]), "/", len(rows))
