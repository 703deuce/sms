import os, json, sys, psycopg2
DID = sys.argv[1]
c = psycopg2.connect(os.environ["DATABASE_URL"]); cur = c.cursor()
cur.execute("select document from t2v_drafts where id=%s", (DID,))
d = cur.fetchone()[0]; ab = d.get("autobuild") or {}
out = {"status": ab.get("status"), "stockStats": ab.get("stockStats"), "qa": ab.get("qa"), "log": ab.get("log"), "story": {k: (ab.get("story") or {}).get(k) for k in ("title", "topic")}, "shots": [], "results": [], "scenes": []}
for s in ab.get("shots") or []:
    out["shots"].append({k: s.get(k) for k in ("sceneId", "beat", "subject", "needS", "voiceGroup", "narration")})
for r in ab.get("results") or []:
    ch = r.get("chosen") or {}
    out["results"].append({"sceneId": r.get("sceneId"), "pickedBy": r.get("pickedBy"), "outcome": r.get("outcome"),
        "chosen": {k: ch.get(k) for k in ("providerId", "kind", "score", "lighting", "visible", "verdict", "author", "subjectVisible", "reviewedForOtherLine", "timeOfDay", "saturation", "luma")},
        "nEval": len(r.get("evaluated") or []), "nPhotoEval": sum(1 for e in r.get("evaluated") or [] if e.get("kind") == "photo")})
for s in d.get("scenes") or []:
    m = s.get("media") or {}
    out["scenes"].append({"id": s.get("id"), "narration": s.get("narration"), "media": {k: m.get(k) for k in ("kind", "providerId", "kenBurns", "srcInMs")},
        "cuts": [{"atWord": x.get("atWord"), "providerId": (x.get("media") or {}).get("providerId"), "kind": (x.get("media") or {}).get("kind"), "kenBurns": (x.get("media") or {}).get("kenBurns")} for x in s.get("cuts") or []]})
jid = ab.get("assembleJobId")
if jid:
    cur.execute("select payload from clip_jobs where id=%s", (jid,))
    p = (cur.fetchone() or [{}])[0] or {}
    out["asm"] = {k: p.get(k) for k in ("shotStartsMs", "assembledMs")}
print(json.dumps(out))
