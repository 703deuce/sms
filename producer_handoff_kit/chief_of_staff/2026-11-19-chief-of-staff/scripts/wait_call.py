#!/usr/bin/env python3
"""Wait for a Modal FunctionCall while polling redacted /render-status.
Usage: wait_call.py <call_id> [timeout_seconds]
Env: MOTION_JOB_URL, MOTION_JOB_TOKEN, MODAL_TOKEN_ID, MODAL_TOKEN_SECRET
"""
from __future__ import annotations
import json, os, re, sys, time, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
import modal

ET = ZoneInfo("America/New_York")
SENSITIVE_KEY = re.compile(r"(token|secret|key|auth|password|lease|url|signed|href|location)", re.I)
SENSITIVE_VAL = re.compile(r"https?://\S+|Bearer\s+\S+|eyJ[A-Za-z0-9_-]{10,}", re.I)

def now():
    return datetime.now(ET).strftime("%Y-%m-%dT%H:%M:%S%z")

def redact(obj):
    if isinstance(obj, dict):
        return {k: ("[REDACTED]" if SENSITIVE_KEY.search(k) else redact(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(x) for x in obj]
    if isinstance(obj, str):
        return SENSITIVE_VAL.sub("[REDACTED]", obj)
    return obj

def render_status():
    url = os.environ["MOTION_JOB_URL"].rstrip("/") + "/render-status"
    token = os.environ["MOTION_JOB_TOKEN"]
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def main():
    call_id = sys.argv[1]
    timeout_s = int(sys.argv[2]) if len(sys.argv) > 2 else 1800
    started = time.time()
    print(f"{now()} waiting callId={call_id} timeout={timeout_s}s", flush=True)
    try:
        fc = modal.FunctionCall.from_id(call_id)
    except Exception:
        fc = modal.functions.FunctionCall.from_id(call_id)

    last_stage = None
    while True:
        elapsed = time.time() - started
        try:
            status = render_status()
            red = redact(status)
            key = (status.get("stage"), status.get("completed"), status.get("total"))
            if key != last_stage:
                print(f"{now()} elapsed={elapsed:.1f}s status={json.dumps(red)}", flush=True)
                last_stage = key
            if status.get("stage") == "qa_fail":
                print(f"{now()} RENDER_STATUS_FAILED", flush=True)
        except Exception as e:
            msg = type(e).__name__ + (f" HTTP {getattr(e, 'code')}" if hasattr(e, "code") else "")
            print(f"{now()} status_poll_error={msg}", flush=True)

        try:
            result = fc.get(timeout=15)
            print(f"{now()} CALL_DONE elapsed={time.time()-started:.1f}s", flush=True)
            print("RESULT " + json.dumps(redact(result), indent=2), flush=True)
            if isinstance(result, dict) and str(result.get("qa", "")).lower() in {"fail", "failed", "false"}:
                sys.exit(2)
            sys.exit(0)
        except Exception as e:
            name = type(e).__name__
            if "timeout" in name.lower() or "expired" in name.lower():
                pass
            else:
                print(f"{now()} CALL_ERROR type={name}", flush=True)
                if elapsed > 20 and name in {"RemoteError", "ExecutionError", "FunctionException", "Error"}:
                    sys.exit(3)

        if elapsed >= timeout_s:
            print(f"{now()} WAIT_TIMEOUT after {elapsed:.1f}s", flush=True)
            sys.exit(4)

if __name__ == "__main__":
    main()
