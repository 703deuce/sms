#!/usr/bin/env python3
"""GET <job>/render-status once and print a redacted summary. Credentials come from the environment only."""
import json, os, re, sys, urllib.request
SENS_K = re.compile(r"(token|secret|key|auth|password|lease|url|signed|href|location)", re.I)
SENS_V = re.compile(r"https?://\S+|Bearer\s+\S+|eyJ[A-Za-z0-9_-]{10,}", re.I)
def red(o):
    if isinstance(o, dict): return {k: ("[redacted]" if SENS_K.search(k) else red(v)) for k, v in o.items()}
    if isinstance(o, list): return [red(x) for x in o]
    return SENS_V.sub("[redacted]", o) if isinstance(o, str) else o
req = urllib.request.Request(os.environ["MOTION_JOB_URL"].rstrip("/") + "/render-status",
    headers={"Authorization": "Bearer " + os.environ["MOTION_JOB_TOKEN"], "Accept": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(json.dumps(red(json.loads(r.read().decode())), indent=1))
except Exception as e:
    print("status request failed: " + type(e).__name__ + (f" HTTP {e.code}" if hasattr(e, "code") else "")); sys.exit(1)
