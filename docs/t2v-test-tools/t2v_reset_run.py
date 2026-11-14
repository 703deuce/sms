"""Operator tool: re-run a T2V draft's autobuild (internal QA only; run inside clips-worker with DATABASE_URL set).

  python t2v_reset_run.py <draftId> [ai] [--from-footage] [--no-incumbents]

Default: full re-run from `queued` (new script, new plan).
--from-footage: restart at `finding_footage` with the script and scene plan FROZEN (story, segments, shots,
  music kept); every footage/verify/pick/AI/QA field is cleared, so old-vs-new matching can be compared on the
  same script. A plan made before the script-context pass gets its moments added once on the first tick.
Both modes also clear the previous output so no poll can read it as the new run's result: the old edit
  (scenes), render ids (autobuild renderId/compositionId, never kept), the row's assembled revision, stage and
  progress; the revision is bumped so an in-flight save from the old state cannot overwrite the reset, and
  autobuild.resetAt is set (the status route returns it; a poller should accept `done` only with a later state).
--from-footage also keeps the previous run's placed picks as `priorPicks` (score, depicts and the candidate
  record per line; an older prior pick is kept for a line the last run held). The next run re-verifies them
  under the fixed lineShows and keeps one unless a new clip is clearly better (incumbents).
--no-incumbents: clean slate (use with --from-footage for a rerun that must not be seeded by an earlier run's
  picks). No priorPicks are carried (neither the last run's placed picks nor older prior picks), so there are no
  incumbents; every per-run pick state is dropped too: look-alike bans, verify history, hold/re-check state and
  the candidate lists. Only the frozen script and plan (story, segments, shots, music) are kept. The blind
  pass-1 observation cache (t2v_clip_descriptions) is kept: it describes what a clip shows, never how it scored.
  A full re-run (no --from-footage) never carries picks, so the flag changes nothing there.
`ai`: also opt this run into the AI b-roll test step (paid; only when explicitly approved). Without `ai` the
  run is always written with aiBroll=false (an older run's aiBroll=true is never carried over).
"""
import os, json, psycopg2, datetime, sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
DID = args[0] if args else sys.exit("usage: t2v_reset_run.py <draftId> [ai] [--from-footage] [--no-incumbents]")
AI = "ai" in args[1:]
FROM_FOOTAGE = "--from-footage" in sys.argv[1:]
NO_INCUMBENTS = "--no-incumbents" in sys.argv[1:]
unknown = [a for a in sys.argv[1:] if a.startswith("--") and a not in ("--from-footage", "--no-incumbents")]
if unknown: sys.exit(f"unknown option {' '.join(unknown)}")

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
    # Incumbents: the previous run's placed picks (kept by a --from-footage reset unless --no-incumbents).
    prior = {} if NO_INCUMBENTS else dict(ab.get("priorPicks") or {})
    cands = ab.get("candidates") or {}
    for r in ([] if NO_INCUMBENTS else (ab.get("results") or [])):
        ch = (r or {}).get("chosen") or {}
        pid = ch.get("providerId")
        if not pid or (r.get("outcome") not in (None, "stock")):
            continue
        cand = next((c for c in cands.get(r.get("sceneId"), []) if c.get("providerId") == pid), None) or \
            next((c for lst in cands.values() for c in lst if c.get("providerId") == pid), None)
        if not cand:
            continue
        prior[r["sceneId"]] = {"providerId": pid, "score": ch.get("score"), "depicts": ch.get("depicts"),
                               "kind": ch.get("kind") or "video", "at": now, "candidate": cand}
    if prior:
        keep["priorPicks"] = prior
    status, completed, note = "finding_footage", ["writing_script", "planning_scenes"], "operator restart at finding_footage (script + plan frozen)"
    if NO_INCUMBENTS:
        note += ", clean slate (no incumbents / prior picks / bans)"
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
if NO_INCUMBENTS:
    # Belt and braces: nothing seeded from earlier picks may survive (keep_keys already leaves these out).
    for k in ("priorPicks", "lookalikeBans", "verifyHistory", "candidates", "reimagineLog", "reimaginePending",
              "reimagineTries", "reimagineScenes", "queriesTried", "lineShowsFixedAt"):
        d["autobuild"].pop(k, None)
cur.execute("update t2v_drafts set document=%s, status='AUTOBUILDING', stage=%s, error=NULL, progress=0, "
            "\"assembledRevision\"=NULL, revision=revision+1, \"updatedAt\"=now() where id=%s",
            (json.dumps(d), f"pipeline:{status}", DID))
c.commit(); print("reset ok", DID, status, "clean slate (no incumbents)" if NO_INCUMBENTS else
                  f"priorPicks={len(d['autobuild'].get('priorPicks') or {})}")
