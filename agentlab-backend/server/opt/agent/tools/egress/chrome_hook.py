"""CDP hook: when a main document is blocked, force the paid egress tier and reload.

Used by chrome-keeper. Decision uses HTTP status and challenge headers only
(no user text).
"""
from __future__ import annotations

import json, time, urllib.request
from urllib.parse import urlparse, urlencode

STATUS = "http://127.0.0.1:18081"
COOLDOWN = {}  # host -> last_ts
COOL_SEC = 60

try:
    from blockdetect import detect_block
except Exception:
    def detect_block(status=None, headers=None, body=None, error=None, curl_exit=None):
        try:
            status = int(status)
        except Exception:
            return False, None
        if status in (403, 429, 451):
            return True, f"http_{status}"
        return False, None


def _usage():
    try:
        return json.load(urllib.request.urlopen(STATUS + "/usage", timeout=2))
    except Exception:
        return {}


def _force(host, tier, job="chrome"):
    q = urlencode({"host": host, "tier": tier, "job": job, "ttl": "900"})
    try:
        return json.load(urllib.request.urlopen(STATUS + "/force?" + q, timeout=3))
    except Exception as e:
        return {"ok": False, "error": str(e)}


_DOC_URLS = {}      # requestId -> url of a main-document request (to name the host of a failed load)
# Chrome network errors that mean "this path did not reach a usable page" (structured errorText, not user text).
FAIL_ERRORS = ("ERR_CONNECTION_RESET", "ERR_CONNECTION_CLOSED", "ERR_CONNECTION_REFUSED", "ERR_CONNECTION_TIMED_OUT",
               "ERR_TIMED_OUT", "ERR_EMPTY_RESPONSE", "ERR_TUNNEL_CONNECTION_FAILED", "ERR_SSL_PROTOCOL_ERROR",
               "ERR_HTTP2_PROTOCOL_ERROR", "ERR_HTTP2_PING_FAILED")
_TWO_PART = {"co", "com", "org", "net", "gov", "ac", "edu"}


def base_domain(host):
    """Registrable-ish domain (npmjs.com, bbc.co.uk): the whole site moves tier together, so its challenge,
    assets and API hosts all leave through the same exit IP."""
    labels = [l for l in (host or "").lower().strip(".").split(".") if l]
    if len(labels) <= 2:
        return ".".join(labels)
    if len(labels[-1]) == 2 and labels[-2] in _TWO_PART:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def handle_event(ev, reload_fn, job="chrome", log=None):
    """If this CDP event is a blocked main document, force residential (then mobile) and reload.

    Signals (all structured): HTTP status 403/429/451, challenge headers (cf-mitigated, x-datadome, ...), or a failed
    main-document load with a connection-level Chrome error. The page's own text is never read."""
    if not isinstance(ev, dict):
        return False
    method = ev.get("method")
    params = ev.get("params") or {}
    if method == "Network.requestWillBeSent":
        if params.get("type") == "Document" and str((params.get("request") or {}).get("url", "")).startswith("http"):
            if len(_DOC_URLS) > 200:
                _DOC_URLS.clear()
            _DOC_URLS[params.get("requestId")] = params["request"]["url"]
        return False
    if method == "Network.loadingFailed":
        url = _DOC_URLS.get(params.get("requestId")) or ""
        err = str(params.get("errorText") or "")
        if params.get("canceled") or not url or not any(e in err for e in FAIL_ERRORS):
            return False
        status, headers, blocked, reason = None, {}, True, "chrome_" + err.replace("net::", "").lower()
    elif method == "Network.responseReceived":
        if params.get("type") != "Document":
            return False
        resp = params.get("response") or {}
        status = resp.get("status")
        url = resp.get("url") or ""
        headers = resp.get("headers") or {}
        if not url.startswith("http"):
            return False
        blocked, reason = detect_block(status, headers, b"")
        try:
            ok_status = 200 <= int(status) < 400
        except Exception:
            ok_status = False
        if blocked and ok_status and str(reason or "").startswith("header:x-datadome"):
            blocked = False  # DataDome stamps this header on normal pages too; only a 4xx/5xx with it is a challenge
    else:
        return False
    if not blocked:
        return False
    host = base_domain(urlparse(url).hostname or "")
    if not host:
        return False
    now = time.time()
    if now - COOLDOWN.get(host, 0) < COOL_SEC:
        return False
    COOLDOWN[host] = now
    # Escalate: if already forced to residential, try mobile when enabled.
    try:
        cur = json.load(urllib.request.urlopen(STATUS + "/force", timeout=2))
        existing = ((cur.get("forced") or {}).get(host) or {}).get("tier")
    except Exception:
        existing = None
    tier = "residential"
    if existing == "residential" and _usage().get("mobile_enabled"):
        tier = "mobile"
    info = _force(host, tier, job=job)
    if log:
        try:
            log(f"egress hook {host} status={status} reason={reason} force={info}")
        except Exception:
            pass
    if info.get("ok") and callable(reload_fn):
        try:
            time.sleep(0.6)  # let the gateway cut the stale tunnels so the reload opens a fresh one on the new tier
            reload_fn()
        except Exception:
            pass
    return True
