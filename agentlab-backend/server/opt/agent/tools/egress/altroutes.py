"""Alternate routes for a page that every egress tier failed to fetch (audit M1/M2).

Order after direct -> TLS-impersonation -> residential -> mobile have failed:
  1. stealth browser, direct            (tools/stealth-fetch; free)
  2. stealth browser, residential tier  (+ already-paid CapSolver when a captcha widget is on the page)
  3. Wayback copy                       (archive.org; free)
  4. search for other copies of the page (SearXNG; returns candidate URLs, the agent reads them)
  5. last resort: ask-user to open the page and save it into inputs/
Every attempt is appended to <job folder>/log/routes.jsonl (read by runner/goal_judge.py, M2).
Decisions use HTTP status, headers and response bytes only (never the user's words).
"""
from __future__ import annotations

import json, os, re, subprocess, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockdetect import detect_block

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
STEALTH = os.environ.get("STEALTH_FETCH", "/opt/tools/stealth-fetch")
SEARX = os.environ.get("SEARXNG_URL", "http://127.0.0.1:8888")
JOB_RE = re.compile(r"^(/workspace/jobs/[0-9a-f-]{36}(?:/helpers/[0-9a-f-]{36})*)")


def job_dir(cwd=None):
    m = JOB_RE.match(cwd or os.getcwd())
    return m.group(1) if m else None


def route_base(route):
    """Group variants: direct_tls -> direct family is still its own route type for M2 counting."""
    return route.split(":", 1)[0]


def log_route(url, route, ok, status=None, reason=None, extra=None, cwd=None):
    d = job_dir(cwd)
    if not d:
        return
    try:
        os.makedirs(d + "/log", exist_ok=True)
        rec = {"t": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "url": url[:300], "route": route, "ok": bool(ok),
               "status": status, "reason": reason}
        if extra:
            rec.update(extra)
        with open(d + "/log/routes.jsonl", "a") as f:
            f.write(json.dumps(rec) + "\n")
    except Exception:
        pass


def _get(url, timeout=25, headers=None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, dict((k.lower(), v) for k, v in r.getheaders()), r.read(), r.geturl()


def stealth(url, tier, job, solve_captcha=False):
    """Run tools/stealth-fetch. Returns dict(ok,status,body,reason) or None when the tool is missing."""
    if not os.path.exists(STEALTH):
        return None
    cmd = [STEALTH, "--json", "--tier", tier, "--job", job or "chrome", url]
    if solve_captcha:
        cmd.insert(1, "--solve-captcha")
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=120)
        out = json.loads(p.stdout.decode("utf-8", "replace") or "{}")
        body = b""
        if out.get("html_path") and os.path.exists(out["html_path"]):
            body = open(out["html_path"], "rb").read()
            try:
                os.unlink(out["html_path"])
            except OSError:
                pass
        return {"ok": bool(out.get("ok")), "status": out.get("status"), "body": body, "reason": out.get("reason"),
                "captcha": out.get("captcha")}
    except Exception as e:
        return {"ok": False, "status": None, "body": b"", "reason": f"stealth_error:{str(e)[:80]}"}


def wayback(url):
    """Closest archived copy, raw (id_ flag removes the Wayback toolbar). Returns (body, snapshot_ts, snapshot_url) or None."""
    try:
        q = "https://archive.org/wayback/available?url=" + urllib.parse.quote(url, safe="")
        _, _, body, _ = _get(q, timeout=20)
        snap = (json.loads(body).get("archived_snapshots") or {}).get("closest") or {}
        if not snap.get("available") or str(snap.get("status")) not in ("200", "203"):
            return None
        ts = snap.get("timestamp")
        raw = re.sub(r"/web/(\d+)/", lambda m: f"/web/{m.group(1)}id_/", snap["url"], count=1)
        st, _, data, _ = _get(raw, timeout=40)
        if st == 200 and len(data) > 500:
            return data, ts, snap["url"]
    except Exception:
        return None
    return None


def search_candidates(url, n=6):
    """Other pages that likely carry the same content: query = words of the URL path (deterministic)."""
    u = urllib.parse.urlparse(url)
    words = [w for w in re.split(r"[^A-Za-z0-9]+", urllib.parse.unquote(u.path)) if len(w) > 2 and not w.isdigit()]
    words = words[-8:]
    if not words:
        return []
    host = (u.hostname or "").lower()
    q = " ".join(words)
    try:
        _, _, body, _ = _get(f"{SEARX}/search?q={urllib.parse.quote(q)}&format=json", timeout=20)
        out = []
        for r in json.loads(body).get("results", []):
            ru = r.get("url") or ""
            rh = (urllib.parse.urlparse(ru).hostname or "").lower()
            if rh and rh != host and not rh.endswith("." + host) and len(out) < n:
                out.append({"url": ru, "title": (r.get("title") or "")[:120]})
        return out
    except Exception:
        return []


def paid_slot(url):
    """Slot for a future paid tier (cloud stealth browser, etc.). Not wired: no such service is paid for."""
    return None


def rescue(url, job, res, solve_captcha=True):
    """Try the alternate routes; fill `res` (egresslib.FetchResult) on success. Always sets res.alt."""
    alt = {"routes": [], "candidates": [], "next": None}
    res.alt = alt

    def done(route, ok, status=None, reason=None, extra=None):
        alt["routes"].append({"route": route, "ok": ok, "status": status, "reason": reason})
        log_route(url, route, ok, status, reason, extra)

    for tier in ("direct", "residential"):
        r = stealth(url, tier, job, solve_captcha=(solve_captcha and tier == "residential"))
        if r is None:
            break
        route = "stealth" if tier == "direct" else "stealth_residential"
        done(route, r["ok"], r.get("status"), r.get("reason"), {"captcha": r.get("captcha")} if r.get("captcha") else None)
        if r["ok"] and r["body"]:
            res.ok, res.blocked, res.body, res.status = True, False, r["body"], r.get("status") or 200
            res.headers = {"content-type": "text/html"}
            res.final_tier = route
            res.reason = None
            return res
    w = wayback(url)
    if w:
        body, ts, snap = w
        done("wayback", True, 200, None, {"snapshot": ts})
        res.ok, res.blocked, res.body, res.status = True, False, body, 200
        res.headers = {"content-type": "text/html"}
        res.final_tier = "wayback"
        res.reason = "archived_copy"
        alt["archived_at"] = ts
        alt["snapshot_url"] = snap
        return res
    done("wayback", False, None, "no_snapshot")
    cands = search_candidates(url)
    done("search_mirror", bool(cands), None, None if cands else "no_results", {"n": len(cands)})
    alt["candidates"] = cands
    alt["next"] = ("Read one of the candidate URLs with readpage (other sites may carry the same content), then, if the "
                   "exact page is required: ask-user \"open <URL> and save it as PDF or HTML into inputs/\"")
    return res
