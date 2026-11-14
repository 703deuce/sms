"""Operator tool: re-run a T2V draft's autobuild (internal QA only; run inside clips-worker with DATABASE_URL set).

  python t2v_reset_run.py <draftId> [ai] [--from-footage]

Default: full re-run from `queued` (new script, new plan).
--from-footage: restart at `finding_footage` with the script and scene plan FROZEN (story, segments, shots,
  music kept); every footage/verify/pick/AI/QA field is cleared, so old-vs-new matching can be compared on the
  same script. A plan made before the script-context pass gets its moments added once on the first tick.
Both modes also clear the previous output so no poll can read it as the new run's result: the old edit
  (scenes), render ids (autobuild renderId/compositionId, never kept), the row's assembled revision, stage and
  progress; the revision is bumped so an in-flight save from the old state cannot overwrite the reset, and
  autobuild.resetAt is set (the status route returns it; a poller should accept `done` only with a later state).
`ai`: also opt this run into the AI b-roll test step (paid; only when explicitly approved). Without `ai` the
  run is always written with aiBroll=false (an older run's aiBroll=true is never carried over).
"""
import os, json, psycopg2, datetime, sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
DID = args[0] if args else sys.exit("usage: t2v_reset_run.py <draftId> [ai] [--from-footage]")
AI = "ai" in args[1:]
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
    # aiBroll is NOT carried over: paid AI b-roll only when `ai` is passed for this reset.
    keep_keys = ("v", "prompt", "style", "durationS", "renderResolution", "startedAt",
                 "story", "segments", "shots", "musicGenerationId")
    keep = {k: ab[k] for k in keep_keys if k in ab}
    status, completed, note = "finding_footage", ["writing_script", "planning_scenes"], "operator restart at finding_footage (script + plan frozen)"
else:
    keep = {k: ab[k] for k in ("v", "prompt", "style", "durationS", "renderResolution", "startedAt") if k in ab}
    status, completed, note = "queued", [], "operator full re-run"
keep["aiBroll"] = AI
if AI:
    note += " + AI b-roll test (per-run aiBroll)"
else:
    note += " (aiBroll=false)"
keep.update({"status": status, "completed": completed, "resumes": 0, "resetAt": now,
             "log": prev_log + [{"stage": status, "at": now, "note": note}]})
d["autobuild"] = keep
d["music"] = {"volume": 0.18, "duck": True}
# The previous run's output: never visible as this run's state.
d["scenes"] = []
d["nextSlot"] = 0
for k in ("renderId", "compositionId", "results", "qa", "stockStats", "assembleJobId"):
    d["autobuild"].pop(k, None)
cur.execute("update t2v_drafts set document=%s, status='AUTOBUILDING', stage=%s, error=NULL, progress=0, "
            "\"assembledRevision\"=NULL, revision=revision+1, \"updatedAt\"=now() where id=%s",
            (json.dumps(d), f"pipeline:{status}", DID))
c.commit(); print("reset ok", DID, status)
