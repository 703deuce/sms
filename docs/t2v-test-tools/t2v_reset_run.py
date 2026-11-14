import os, json, psycopg2, datetime, sys
DID = sys.argv[1] if len(sys.argv) > 1 else "t2v_0a0c874f40644f57a08607a223122df5"
c = psycopg2.connect(os.environ["DATABASE_URL"]); cur = c.cursor()
cur.execute("select document from t2v_drafts where id=%s for update", (DID,))
d = cur.fetchone()[0]; ab = d["autobuild"]
keep = {k: ab[k] for k in ("v","prompt","style","durationS","renderResolution","startedAt") if k in ab}
now = datetime.datetime.utcnow().isoformat() + "Z"
prev_log = ab.get("log") or []
AI = len(sys.argv) > 2 and sys.argv[2] == "ai"
if AI: keep["aiBroll"] = True
keep.update({"status": "queued", "completed": [], "resumes": 0,
  "log": prev_log + [{"stage": "queued", "at": now, "note": "operator re-run after editorial pacing + no cards + stills cap" + (" + AI b-roll test (per-run aiBroll)" if AI else "")}]})
d["autobuild"] = keep
d["music"] = {"volume": 0.18, "duck": True}
cur.execute("update t2v_drafts set document=%s, status='AUTOBUILDING', stage='pipeline:queued', error=NULL, progress=0 where id=%s", (json.dumps(d), DID))
c.commit(); print("reset ok", DID)
