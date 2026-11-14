#!/usr/bin/env bash
# Print the newest Prompt-to-Video runs (no secrets/URLs). Usage: t2v_watch.sh [limit]
LIMIT="${1:-3}"
ssh coolify-server "sudo docker exec -i clips-worker python3 -" <<PY 2>&1 | grep -v -e Defaults -e "\^~" -e sudoers; true
import os, json, psycopg2
c = psycopg2.connect(os.environ["DATABASE_URL"]); cur = c.cursor()
cur.execute("""select id, "projectId", status, stage, progress, "updatedAt", document->'autobuild' from t2v_drafts
 where document ? 'autobuild' order by "createdAt" desc limit $LIMIT""")
for i, p, st, stg, pr, up, ab in cur.fetchall():
    ab = ab or {}
    print(i, p, st, stg, pr, up, "| run:", ab.get("status"), "res", ab.get("renderResolution"), "err", ab.get("error"))
    for l in (ab.get("log") or [])[-6:]: print("   ", json.dumps(l)[:200])
PY
