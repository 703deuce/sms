#!/usr/bin/env python3
"""GET /render-status for a job and print a redacted JSON summary. Secrets stay in env.
Env: MOTION_JOB_URL, MOTION_JOB_TOKEN
"""
import json, os, re, urllib.request

SENSITIVE_KEY = re.compile(r"(token|secret|key|auth|password|lease|url|signed|href|location)", re.I)
SENSITIVE_VAL = re.compile(r"https?://\S+|Bearer\s+\S+|eyJ[A-Za-z0-9_-]{10,}", re.I)

def redact(obj):
    if isinstance(obj, dict):
        return {k: ("[REDACTED]" if SENSITIVE_KEY.search(k) else redact(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(x) for x in obj]
    if isinstance(obj, str):
        return SENSITIVE_VAL.sub("[REDACTED]", obj)
    return obj

def main():
    url = os.environ["MOTION_JOB_URL"].rstrip("/") + "/render-status"
    token = os.environ["MOTION_JOB_TOKEN"]
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    print(json.dumps(redact(data), indent=2))

if __name__ == "__main__":
    main()
