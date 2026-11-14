"""Operator tool: re-run a T2V draft's autobuild (internal QA only; run inside clips-worker with DATABASE_URL set).

  python t2v_reset_run.py <draftId> [ai] [--from-footage]

Default: full re-run from `queued` (new script, new plan).
--from-footage: restart at `finding_footage` with the script and scene plan FROZEN (story, segments, shots,
  music kept); every footage/verify/pick/AI/QA field is cleared, so old-vs-new matching can be compared on the
  same script. A plan made before the script-context pass gets its moments added once on the first tick.
`ai`: also opt this run into the AI b-roll test step (paid; only when explicitly approved).
"""
import os, json, psycopg2, datetime, sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
DID = args[0] if args else sys.exit("usage: t2v_reset_run.py <draftId> [ai] [--from-footage]")
AI = len(args) > 1 and args[1] == "ai"
FROM_FOOTAGE = "--from-footage" in sys.argv[1:]

c = psycopg2.connect(os.environ["DATABASE_URL"]); cur = c.cursor()
cur.execute("select document from t2v_drafts where id=%s for update", (DID,))
row = cur.fetchone()
if not row: sys.exit(f"no draft {DID}")
d = row[0]; ab = d["autobuild"]
now = datetime.datetime.utcnow().isoformat() + "Z"
prev_log = ab.get("log") or []

if FROM_FOOTAGE:
    missing = [k for k in ("story", "segments", "shots") if not ab.get(k)]
    if missing: sys.exit(f"cannot freeze: autobuild has no {', '.join(missing)}; use a full re-run")
    keep_keys = ("v", "prompt", "style", "durationS", "renderResolution", "startedAt", "aiBroll",
                 "story", "segments", "shots", "musicGenerationId")
    keep = {k: ab[k] for k in keep_keys if k in ab}
    status, completed, note = "finding_footage", ["writing_script", "planning_scenes"], "operator restart at finding_footage (script + plan frozen)"
else:
    keep = {k: ab[k] for k in ("v", "prompt", "style", "durationS", "renderResolution", "startedAt") if k in ab}
    status, completed, note = "queued", [], "operator full re-run"
if AI:
    keep["aiBroll"] = True
    note += " + AI b-roll test (per-run aiBroll)"
keep.update({"status": status, "completed": completed, "resumes": 0,
             "log": prev_log + [{"stage": status, "at": now, "note": note}]})
d["autobuild"] = keep
d["music"] = {"volume": 0.18, "duck": True}
cur.execute("update t2v_drafts set document=%s, status='AUTOBUILDING', stage=%s, error=NULL, progress=0 where id=%s",
            (json.dumps(d), f"pipeline:{status}", DID))
c.commit(); print("reset ok", DID, status)
