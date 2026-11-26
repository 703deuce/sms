"""Client for the host desktop control API at 127.0.0.1:6070."""
import json, os, sys, time, urllib.error, urllib.request

CONTROL = os.environ.get("DESKTOP_CONTROL", "http://127.0.0.1:6070")

from datetime import datetime
from zoneinfo import ZoneInfo
_ET = ZoneInfo("America/New_York")


def expire_stale_handoff():
    """If a waiting handoff is past expires_at, POST /handoff/done so the agent is not stuck."""
    try:
        req = urllib.request.Request(CONTROL + "/status")
        with urllib.request.urlopen(req, timeout=5) as r:
            rec = json.loads(r.read().decode() or "{}")
        if rec.get("status") != "waiting" or rec.get("kind") != "handoff":
            return False
        exp = rec.get("expires_at")
        if not exp:
            return False
        if datetime.now(_ET) <= datetime.fromisoformat(exp):
            return False
        req = urllib.request.Request(CONTROL + "/handoff/done", data=b"{}", method="POST",
                                     headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5).read()
        return True
    except Exception:
        return False



def die(name, msg):
    print(f"{name}: {msg}", file=sys.stderr)
    sys.exit(1)


def _job_browser(method, path):
    """This job's own browser info, or None for the shared desktop (DESKTOP_SHARED=1 forces shared)."""
    if os.environ.get("DESKTOP_SHARED") == "1" or path.startswith("/handoff") or path.startswith("/browser/") \
            or path == "/rick/active":
        return None
    try:
        sys.path.insert(0, "/opt/tools")
        import jobbrowser
    except Exception:
        return None
    info = jobbrowser.ensure(not (method == "GET" and path == "/status"))
    return info if info.get("mode") == "job" else None


def api(method, path, body=None, timeout=60):
    info = _job_browser(method, path)
    if info:
        import jobbrowser
        if not info.get("running"):
            rec = {"status": "idle", "rick_busy": False, "job_browser": True, "running": False}
            return rec, json.dumps(rec).encode(), {"Content-Type": "application/json"}
        res = jobbrowser.Desk(info).handle(method, path, body)
        if isinstance(res, bytes):
            return None, res, {"Content-Type": "image/png"}
        return res, json.dumps(res).encode(), {"Content-Type": "application/json"}
    return _shared_api(method, path, body, timeout)


def _shared_api(method, path, body=None, timeout=60):
    """Call the desktop service. If Rick is using the desktop (Live screen input in the last 30 s, or a sign-in
    handoff is waiting), agent input is paused: wait here, printing a heartbeat, until he is done, then act."""
    expire_stale_handoff()
    waited = 0.0
    while True:
        try:
            return _api(method, path, body, timeout)
        except RickBusy as e:
            if waited == 0:
                print("desktop: Rick is using the desktop right now; your input is paused until he stops "
                      "(30 s without input, or the handoff is finished). Waiting...", flush=True)
            elif int(waited) % 15 == 0:
                print(f"desktop: still waiting for Rick ({int(waited)} s)", flush=True)
            time.sleep(3); waited += 3


class RickBusy(RuntimeError):
    pass


def _api(method, path, body=None, timeout=60):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(CONTROL + path, data=data, method=method,
                                 headers={"Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ctype = r.headers.get("Content-Type") or ""
            raw = r.read()
            if "json" in ctype or raw[:1] == b"{":
                return json.loads(raw.decode() or "{}"), raw, r.headers
            return None, raw, r.headers
    except urllib.error.HTTPError as e:
        try:
            rec = json.loads(e.read().decode())
            detail = rec.get("error")
        except Exception:
            rec, detail = {}, None
        if e.code == 409 and rec.get("rick_busy"):
            raise RickBusy(detail)
        raise RuntimeError(f"HTTP {e.code} {path}" + (f": {detail}" if detail else "")) from e
    except Exception as e:
        raise RuntimeError(
            f"desktop service not reachable at {CONTROL} ({e}). "
            "On the host run: systemctl start agent-lab-desktop"
        ) from e


def shot(out, delay=0.4):
    """Save a desktop screenshot to out (PNG). Used by --shot on every action CLI."""
    time.sleep(delay)
    _, raw, headers = api("GET", "/shot")
    if (headers.get("Content-Type") or "").startswith("application/json") or not raw:
        raise RuntimeError("screenshot failed")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "wb") as f:
        f.write(raw)
    return out


def add_common(p):
    p.add_argument("--shot", nargs="?", const="auto", metavar="OUT.png",
                   help="take a screenshot after the action (default name: desktop-after-<time>.png); then agent_view it")
    p.add_argument("--wait", type=float, default=0.4, help="seconds to wait before the --shot (default 0.4)")


def run(name, path, body, args, done_msg):
    try:
        rec, _, _ = api("POST", path, body)
    except Exception as e:
        die(name, str(e))
    if not (rec or {}).get("ok"):
        die(name, (rec or {}).get("error") or "xdotool failed")
    print(done_msg)
    if getattr(args, "shot", None):
        out = args.shot if args.shot != "auto" else f"desktop-after-{time.strftime('%H%M%S')}.png"
        try:
            print(f"screenshot after: {shot(out, args.wait)}")
        except Exception as e:
            die(name, f"action done but screenshot failed: {e}")


def mods_list(s):
    return [m for m in (s or "").replace("+", ",").split(",") if m]
