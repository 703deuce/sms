"""3-tier egress fallback: direct (free), then DataImpulse residential, then mobile.

All paid traffic goes through the local gateway (127.0.0.1:18080) so caps and
logs stay in one place. Mobile is used only when the gateway says it is enabled.
"""
from __future__ import annotations

import json, os, re, socket, subprocess, tempfile, urllib.error, urllib.request
from urllib.parse import urlparse

from blockdetect import detect_block

GATEWAY = os.environ.get("EGRESS_PROXY", "http://127.0.0.1:18080")
STATUS = os.environ.get("EGRESS_STATUS", "http://127.0.0.1:18081")
REAL_CURL = os.environ.get("EGRESS_REAL_CURL", "/usr/bin/curl")
TIERS = ("direct", "residential", "mobile")


def job_from_cwd(cwd=None):
    cwd = cwd or os.getcwd()
    m = re.search(r"/jobs/([0-9a-f-]{36})", cwd)
    return m.group(1) if m else "chrome"


def _force_tier():
    return (os.environ.get("EGRESS_FORCE_TIER") or "").strip().lower() or None


def mobile_enabled():
    try:
        data = json.load(urllib.request.urlopen(STATUS + "/usage", timeout=3))
        return bool(data.get("mobile_enabled"))
    except Exception:
        return False


def usage():
    try:
        return json.load(urllib.request.urlopen(STATUS + "/usage", timeout=3))
    except Exception as e:
        return {"error": str(e)}


def _proxy_for(tier, job):
    # Local gateway; tier and job go in --proxy-user (CONNECT cannot carry custom headers).
    return GATEWAY if tier in ("residential", "mobile") else None


class FetchResult:
    def __init__(self):
        self.ok = False
        self.status = None
        self.body = b""
        self.headers = {}
        self.url = None
        self.tiers_tried = []  # list of {tier, status, reason, blocked}
        self.final_tier = None
        self.blocked = False
        self.error = None
        self.reason = None

    def report(self):
        tried = ", ".join(
            f"{t['tier']}={'blocked('+t['reason']+')' if t.get('blocked') else 'ok'}"
            for t in self.tiers_tried
        )
        if self.ok:
            return f"ok via {self.final_tier} (tried: {tried})"
        return f"blocked after {tried}" + (f" error={self.error}" if self.error and not self.tiers_tried else "")


def _parse_header_list(raw: bytes) -> dict:
    hdrs = {}
    if not raw:
        return hdrs
    # last response in a -L chain
    blocks = re.split(br"\r?\n\r?\n", raw.strip())
    text = blocks[-1].decode("latin1", "replace") if blocks else ""
    for line in text.splitlines()[1:]:
        if ":" in line:
            k, _, v = line.partition(":")
            hdrs[k.strip().lower()] = v.strip()
    return hdrs


def _status_from_headers(raw: bytes):
    if not raw:
        return None
    blocks = re.split(br"\r?\n\r?\n", raw.strip())
    first = (blocks[-1] if blocks else raw).split(b"\n", 1)[0].decode("latin1", "replace")
    m = re.search(r"HTTP/\S+\s+(\d{3})", first)
    return int(m.group(1)) if m else None


def _curl_once(url, tier, job, extra_args=None, timeout=45, method=None, head_only=False):
    hdr_file = tempfile.NamedTemporaryFile(prefix="eg-h-", delete=False)
    out_file = tempfile.NamedTemporaryFile(prefix="eg-o-", delete=False)
    hdr_file.close(); out_file.close()
    cmd = [REAL_CURL, "-sS", "-L", "--max-time", str(timeout),
           "-D", hdr_file.name, "-o", out_file.name,
           "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
           "-H", "Accept-Language: en-US,en;q=0.9"]
    if head_only:
        cmd.append("-I")
    if method:
        cmd += ["-X", method]
    if tier in ("residential", "mobile"):
        # HTTPS CONNECT cannot carry X-Egress-Tier (it would be inside TLS).
        # Put job + tier in the local proxy-user; the gateway parses them.
        proxy_user = f"{job}__tier.{tier}:"
        cmd += ["-x", GATEWAY, "--proxy-user", proxy_user]
    if extra_args:
        cmd += list(extra_args)
    cmd.append(url)
    env = os.environ.copy()
    env.pop("http_proxy", None); env.pop("https_proxy", None)
    env.pop("HTTP_PROXY", None); env.pop("HTTPS_PROXY", None)
    env.pop("ALL_PROXY", None); env.pop("all_proxy", None)
    try:
        p = subprocess.run(cmd, env=env, capture_output=True, timeout=timeout + 10)
        raw_h = open(hdr_file.name, "rb").read()
        body = open(out_file.name, "rb").read()
        status = _status_from_headers(raw_h)
        headers = _parse_header_list(raw_h)
        err = p.stderr.decode("utf-8", "replace")[:500] if p.returncode else None
        blocked, reason = detect_block(status, headers, body, error=err, curl_exit=p.returncode)
        if p.returncode and status is None and not blocked:
            blocked, reason = True, f"curl_exit_{p.returncode}"
        return {
            "ok": (not blocked) and (p.returncode == 0) and (status is None or 200 <= status < 400),
            "status": status,
            "body": body,
            "headers": headers,
            "blocked": blocked,
            "reason": reason or (None if p.returncode == 0 else f"curl_exit_{p.returncode}"),
            "exit": p.returncode,
            "error": err,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "status": None, "body": b"", "headers": {},
                "blocked": True, "reason": "timeout", "exit": 28, "error": "timeout"}
    finally:
        for n in (hdr_file.name, out_file.name):
            try:
                os.unlink(n)
            except OSError:
                pass


def _tier_order(force=None, include_mobile=None):
    force = force or _force_tier()
    if include_mobile is None:
        include_mobile = mobile_enabled()
    if force in TIERS:
        return [force]
    order = ["direct", "residential"]
    if include_mobile:
        order.append("mobile")
    return order


def fetch(url, job=None, force_tier=None, timeout=45, head_only=False):
    """Fetch URL with automatic 3-tier fallback. Returns FetchResult."""
    job = job or job_from_cwd()
    res = FetchResult()
    res.url = url
    # Local / private hosts stay direct only.
    host = (urlparse(url).hostname or "").lower()
    if not host or host in ("localhost",) or host.startswith("127.") or host.startswith("10.") \
            or host.startswith("192.168.") or re.match(r"172\.(1[6-9]|2[0-9]|3[0-1])\.", host):
        one = _curl_once(url, "direct", job, timeout=timeout, head_only=head_only)
        res.tiers_tried.append({"tier": "direct", "status": one["status"], "reason": one["reason"], "blocked": one["blocked"]})
        res.ok, res.status, res.body, res.headers = one["ok"], one["status"], one["body"], one["headers"]
        res.final_tier = "direct"
        res.blocked = not one["ok"]
        res.reason = one["reason"]
        return res

    include_mobile = mobile_enabled()
    order = _tier_order(force_tier, include_mobile=include_mobile)
    last = None
    for tier in order:
        if tier == "mobile" and not include_mobile and (force_tier or _force_tier()) != "mobile":
            res.tiers_tried.append({"tier": "mobile", "status": None, "reason": "mobile_disabled", "blocked": True})
            continue
        if tier == "mobile" and not include_mobile:
            res.tiers_tried.append({"tier": "mobile", "status": None, "reason": "mobile_disabled", "blocked": True})
            last = {"ok": False, "status": None, "body": b"", "headers": {}, "blocked": True,
                    "reason": "mobile_disabled", "error": "mobile tier is disabled (no DataImpulse mobile plan in credentials)"}
            continue
        one = _curl_once(url, tier, job, timeout=timeout, head_only=head_only)
        last = one
        res.tiers_tried.append({"tier": tier, "status": one["status"], "reason": one["reason"], "blocked": one["blocked"]})
        if one["ok"]:
            res.ok = True
            res.status = one["status"]
            res.body = one["body"]
            res.headers = one["headers"]
            res.final_tier = tier
            res.blocked = False
            res.reason = None
            return res
        # If this tier failed for a reason that is not a "block" (e.g. 404), stop — no need to spend proxy bytes.
        if not one["blocked"] and one["status"] and 400 <= one["status"] < 500 and one["status"] not in (403, 429, 451):
            res.ok = False
            res.status = one["status"]
            res.body = one["body"]
            res.headers = one["headers"]
            res.final_tier = tier
            res.blocked = False
            res.reason = one["reason"] or f"http_{one['status']}"
            res.error = one.get("error")
            return res
    # all attempted tiers failed
    if last:
        res.status = last.get("status")
        res.body = last.get("body") or b""
        res.headers = last.get("headers") or {}
        res.error = (last.get("error") or last.get("reason"))
    # If mobile was not in the order because it is disabled, record that.
    tried_names = {t["tier"] for t in res.tiers_tried}
    if "mobile" not in tried_names:
        res.tiers_tried.append({"tier": "mobile", "status": None, "reason": "mobile_disabled", "blocked": True})
    res.ok = False
    res.blocked = True
    res.final_tier = None
    res.reason = "all_tiers_failed"
    return res


def fmt_tiers(result: FetchResult) -> str:
    return result.report()
