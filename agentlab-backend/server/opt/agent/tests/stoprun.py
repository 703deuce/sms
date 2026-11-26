import sys,os,sqlite3
sys.path.insert(0,"/opt/agent/runner"); sys.path.insert(0,"/opt/agent/tools")
for l in open("/opt/agent/.env"):
    if "=" in l and not l.startswith("#"):
        k,v=l.rstrip("\n").split("=",1); os.environ.setdefault(k,v.strip("\"'"))
import agentd as A
db=sqlite3.connect("/opt/agent/workspace/runs/runs.db"); db.row_factory=sqlite3.Row
front=sys.argv[1]
fr=db.execute("select * from runs where id=?",(front,)).fetchone()
root=fr["working_dir"]
rows=db.execute("select * from runs where working_dir=? or working_dir like ?",(root,root+"/%")).fetchall()
for r in rows:
    c=r["conversation_id"]
    if not c: continue
    try: A.api("POST",f"/api/conversations/{c}/pause",{},timeout=20); print("paused",r["id"])
    except Exception as e: print("pause err",r["id"],str(e)[:80])
    db.execute("update runs set status='stopped', finished_at=coalesce(finished_at,datetime('now')) where id=? and status in ('running','queued')",(r["id"],))
db.commit()
