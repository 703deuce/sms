#!/usr/bin/env python3
"""Borrow ready render artifacts (bundle zip + rendered segments) from an earlier job on the SAME project, so a retry job
skips re-uploading the bundle and re-rendering segments on Modal. Credentials come from the environment only
(MOTION_JOB_URL, MOTION_JOB_TOKEN via lib_env.sh load_job_env); nothing secret is printed.

usage: reuse_assets.py <jobDir> <sourceJobId> [--bundle render_bundle_v1.zip] [--no-segments] [--dry-run]
Writes <J>/state/receipts.json, reuse_req.json, reuse_resp.json.
"""
import json, os, sys, urllib.request, argparse, re

ap = argparse.ArgumentParser()
ap.add_argument("job_dir"); ap.add_argument("source_job_id")
ap.add_argument("--bundle", default="render_bundle_v1.zip")
ap.add_argument("--no-segments", action="store_true", help="reuse only the bundle zip (segments re-render)")
ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()
if not re.fullmatch(r"msaj_[0-9a-f-]{36}", a.source_job_id): sys.exit("sourceJobId must look like msaj_<uuid>")
J = os.path.abspath(a.job_dir); st = os.path.join(J, "state"); os.makedirs(st, exist_ok=True)
base = os.environ["MOTION_JOB_URL"].rstrip("/"); tok = os.environ["MOTION_JOB_TOKEN"]

def post(body):
    req = urllib.request.Request(base + "/assets", data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read().decode() or "{}")
    except Exception as e:
        sys.exit("POST /assets failed: " + type(e).__name__ + (f" HTTP {e.code}" if hasattr(e, "code") else ""))

rec = post({"action": "receipts", "sourceJobId": a.source_job_id})
json.dump(rec, open(os.path.join(st, "receipts.json"), "w"), indent=1)
items = rec.get("receipts", [])
want = [r for r in items if r.get("filename") == a.bundle or (not a.no_segments and str(r.get("filename", "")).startswith("modal_seg_"))]
nseg = sum(1 for r in want if str(r.get("filename", "")).startswith("modal_seg_"))
hasb = any(r.get("filename") == a.bundle for r in want)
print(f"receipts: {len(items)} on source job; reusing bundle={'yes' if hasb else 'NO'} + {nseg} rendered segments")
if not hasb: sys.exit(f"{a.bundle} not found among the source job's ready receipts; rebuild the bundle instead")
body = {"action": "reuse", "sourceJobId": a.source_job_id, "ids": [r["id"] for r in want]}
json.dump(body, open(os.path.join(st, "reuse_req.json"), "w"), indent=1)
if a.dry_run: print("DRY RUN: nothing reused"); sys.exit(0)
resp = post(body); json.dump(resp, open(os.path.join(st, "reuse_resp.json"), "w"))
print("reused:", resp.get("reused"))
