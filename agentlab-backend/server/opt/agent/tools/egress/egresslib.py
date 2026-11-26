"""3-tier egress fallback: direct (free), then DataImpulse residential, then mobile.

All paid traffic goes through the local gateway (127.0.0.1:18080) so caps and
logs stay in one place. Mobile is used only when the gateway says it is enabled.
"""
from __future__ import annotations

import hashlib, json, os, random, re, socket, subprocess, tempfile, time, urllib.error, urllib.request
from urllib.parse import urlparse

from blockdetect import detect_block
try:
    import altroutes
except Exception:  # alternate routes are optional
    altroutes = None

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
        self.alt = None
        self.via = None

    def report(self):
        tried = ", ".join(
            f"{t.get('via') or t['tier']}={'blocked('+str(t['reason'])+')' if t.get('blocked') else 'ok'}"
            for t in self.tiers_tried
        )
        if self.ok:
            return f"ok via {self.final_tier} (tried: {tried})"
        alt = getattr(self, "alt", None)
        if alt and alt.get("routes"):
            tried += "; then " + ", ".join(f"{r['route']}={'ok' if r['ok'] else 'failed('+str(r.get('reason'))+')'}" for r in alt["routes"])
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


# ---------- TLS-impersonation fetch (curl_cffi: Chrome TLS/HTTP2 fingerprint) ----------
def _cffi_once(url, tier, job, timeout=45, head_only=False):
    """Same result shape as _curl_once, but through curl_cffi with a Chrome fingerprint. None if unavailable."""
    try:
        from curl_cffi import requests as cr
    except Exception:
        return None
    kw = {}
    if tier in ("residential", "mobile"):
        gw = urlparse(GATEWAY)
        px = f"http://{job}__tier.{tier}:@{gw.hostname}:{gw.port}"
        kw["proxies"] = {"http": px, "https": px}
    try:
        fn = cr.head if head_only else cr.get
        r = fn(url, impersonate="chrome", timeout=timeout, allow_redirects=True, **kw)
        body = b"" if head_only else (r.content or b"")
        headers = {k.lower(): v for k, v in r.headers.items()}
        blocked, reason = detect_block(r.status_code, headers, body)
        return {"ok": (not blocked) and 200 <= r.status_code < 400, "status": r.status_code, "body": body,
                "headers": headers, "blocked": blocked, "reason": reason, "exit": 0, "error": None}
    except Exception as e:
        msg = str(e)[:300]
        blocked, reason = detect_block(None, None, b"", error=msg)
        return {"ok": False, "status": None, "body": b"", "headers": {}, "blocked": True,
                "reason": reason or "tls_fetch_error", "exit": 1, "error": msg}


# ---------- 429: wait and retry on the SAME tier before spending on a paid one (audit S1) ----------
def retry_after_seconds(headers, default=3.0, cap=20.0):
    v = (headers or {}).get("retry-after")
    try:
        if v is not None and str(v).strip().isdigit():
            return min(float(v), cap)
        if v:
            from email.utils import parsedate_to_datetime
            import datetime
            dt = parsedate_to_datetime(v)
            return max(0.0, min((dt - datetime.datetime.now(dt.tzinfo)).total_seconds(), cap))
    except Exception:
        pass
    return default


def _with_429_backoff(call, tries=2, sleep=time.sleep):
    one = call()
    n = 0
    while one and one.get("status") == 429 and n < tries:
        n += 1
        sleep(retry_after_seconds(one.get("headers")) + random.uniform(0, 1.0))
        one = call()
    return one


# ---------- fetch cache + single-flight (audit S3) ----------
CACHE_DIR = os.environ.get("EGRESS_CACHE_DIR", "/workspace/usage/webcache")
CACHE_TTL = int(os.environ.get("EGRESS_CACHE_TTL", "1200"))  # 20 minutes
CACHE_MAX_BYTES = 5 * 1024 * 1024


def _cache_key(url):
    return hashlib.sha256(url.encode()).hexdigest()[:40]


def cache_get(url):
    try:
        k = os.path.join(CACHE_DIR, _cache_key(url))
        meta = json.load(open(k + ".json"))
        if time.time() - meta["t"] > CACHE_TTL:
            return None
        return meta, open(k + ".body", "rb").read()
    except Exception:
        return None


def cache_put(url, res):
    try:
        if len(res.body or b"") > CACHE_MAX_BYTES or res.status != 200 or res.final_tier in ("wayback",) \
                or str(res.final_tier or "").startswith("stealth"):
            return
        os.makedirs(CACHE_DIR, exist_ok=True)
        k = os.path.join(CACHE_DIR, _cache_key(url))
        open(k + ".body.tmp", "wb").write(res.body or b"")
        os.replace(k + ".body.tmp", k + ".body")
        json.dump({"t": time.time(), "url": url, "status": res.status, "headers": {h: v for h, v in (res.headers or {}).items()
                   if h in ("content-type", "content-length", "last-modified")}, "tier": res.final_tier}, open(k + ".json", "w"))
    except Exception:
        pass


class _Flight:
    """Cross-process single-flight: concurrent identical fetches wait for the first one, then read its cache."""
    def __init__(self, url, wait=60):
        self.path = os.path.join(CACHE_DIR, _cache_key(url) + ".lock")
        self.wait = wait
        self.f = None

    def __enter__(self):
        try:
            import fcntl
            os.makedirs(CACHE_DIR, exist_ok=True)
            self.f = open(self.path, "w")
            t0 = time.time()
            while True:
                try:
                    fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except OSError:
                    if time.time() - t0 > self.wait:
                        break
                    time.sleep(0.5)
        except Exception:
            self.f = None
        return self

    def __exit__(self, *a):
        try:
            if self.f:
                self.f.close()
        except Exception:
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


def _log(url, route, one, cwd=None):
    if altroutes is not None:
        altroutes.log_route(url, route, one.get("ok"), one.get("status"), one.get("reason"), cwd=cwd)


def _attempt(url, tier, job, timeout, head_only):
    """One tier = one or two routes. direct: curl, then Chrome-TLS curl_cffi. residential/mobile: Chrome-TLS first."""
    results = []
    if tier == "direct":
        one = _with_429_backoff(lambda: _curl_once(url, "direct", job, timeout=timeout, head_only=head_only))
        results.append(("direct", one))
        if not one["ok"] and one["blocked"]:
            two = _with_429_backoff(lambda: _cffi_once(url, "direct", job, timeout=timeout, head_only=head_only))
            if two is not None:
                results.append(("direct_tls", two))
    else:
        two = _with_429_backoff(lambda: _cffi_once(url, tier, job, timeout=timeout, head_only=head_only))
        if two is not None:
            results.append((tier + "_tls", two))
        if two is None or (not two["ok"] and two["blocked"] and two.get("status") is None):
            one = _with_429_backoff(lambda: _curl_once(url, tier, job, timeout=timeout, head_only=head_only))
            results.append((tier, one))
    return results


def fetch(url, job=None, force_tier=None, timeout=45, head_only=False, rescue=False, cache=True):
    """Fetch URL with automatic fallback: direct, Chrome-TLS, residential, mobile; optional rescue ladder
    (stealth browser, Wayback, search candidates). Cached 20 min (success only). Returns FetchResult."""
    job = job or job_from_cwd()
    cwd = os.getcwd()
    res = FetchResult()
    res.url = url
    res.alt = None
    use_cache = cache and not head_only and not os.environ.get("EGRESS_NOCACHE")
    host = (urlparse(url).hostname or "").lower()
    private = (not host or host in ("localhost",) or host.startswith("127.") or host.startswith("10.")
               or host.startswith("192.168.") or re.match(r"172\.(1[6-9]|2[0-9]|3[0-1])\.", host))
    if private:
        use_cache = False
    if use_cache:
        hit = cache_get(url)
        if hit:
            meta, body = hit
            res.ok, res.status, res.body, res.headers = True, meta.get("status"), body, meta.get("headers") or {}
            res.final_tier = "cache"
            res.tiers_tried.append({"tier": "cache", "status": res.status, "reason": None, "blocked": False})
            return res
    flight = _Flight(url) if use_cache else None
    if flight:
        flight.__enter__()
        hit = cache_get(url)  # another process may have filled it while we waited
        if hit:
            flight.__exit__()
            meta, body = hit
            res.ok, res.status, res.body, res.headers = True, meta.get("status"), body, meta.get("headers") or {}
            res.final_tier = "cache"
            res.tiers_tried.append({"tier": "cache", "status": res.status, "reason": None, "blocked": False})
            return res
    try:
        return _fetch_uncached(url, job, force_tier, timeout, head_only, rescue, use_cache, res, private, cwd)
    finally:
        if flight:
            flight.__exit__()


def _fetch_uncached(url, job, force_tier, timeout, head_only, rescue, use_cache, res, private, cwd):
    if private:
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
        if tier == "mobile" and not include_mobile:
            res.tiers_tried.append({"tier": "mobile", "status": None, "reason": "mobile_disabled", "blocked": True})
            if (force_tier or _force_tier()) == "mobile":
                last = {"ok": False, "status": None, "body": b"", "headers": {}, "blocked": True,
                        "reason": "mobile_disabled", "error": "mobile tier is disabled (no DataImpulse mobile plan in credentials)"}
            continue
        for route, one in _attempt(url, tier, job, timeout, head_only):
            last = one
            res.tiers_tried.append({"tier": tier, "via": route, "status": one["status"], "reason": one["reason"],
                                    "blocked": one["blocked"]})
            _log(url, route, one, cwd)
            if one["ok"]:
                res.ok = True
                res.status = one["status"]
                res.body = one["body"]
                res.headers = one["headers"]
                res.final_tier = tier
                res.via = route
                res.blocked = False
                res.reason = None
                if use_cache:
                    cache_put(url, res)
                return res
            # a non-block failure such as 404: stop, no need to spend proxy bytes
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
    tried_names = {t["tier"] for t in res.tiers_tried}
    if "mobile" not in tried_names:
        res.tiers_tried.append({"tier": "mobile", "status": None, "reason": "mobile_disabled", "blocked": True})
    res.ok = False
    res.blocked = True
    res.final_tier = None
    res.reason = "all_tiers_failed"
    if rescue and altroutes is not None and not force_tier and not head_only:
        try:
            altroutes.rescue(url, job, res)
        except Exception as e:
            res.error = f"rescue failed: {str(e)[:120]}"
    return res
