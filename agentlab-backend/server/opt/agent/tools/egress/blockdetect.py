"""Decide whether a fetch was blocked, from structured response signals only.

Never inspect the user's text. Look at the HTTP status, response headers,
the response body, and curl/transport error codes.
"""
from __future__ import annotations

# Transport failures that mean "this path did not reach a usable page".
# curl: 7 failed connect, 28 timeout, 35 SSL, 52 empty reply, 56 recv failure/reset
# 18 partial file is not automatically a bot-block.
RESET_EXITS = {7, 28, 35, 52, 56}

BLOCK_STATUSES = {403, 429, 451}

# Header names/values that are a bot or captcha challenge (lowercase keys).
CHALLENGE_HEADERS = (
    ("cf-mitigated", "challenge"),
    ("cf-mitigated", "yes"),
    ("x-datadome", None),  # any value
    ("x-amzn-waf-action", "captcha"),
    ("x-amzn-waf-action", "challenge"),
    ("x-cdn", "cloudflare"),  # not enough alone; used with status 403/503
)

# Literal markers in the RESPONSE body or server-set title, not user text.
# Keep these specific so ordinary pages are not treated as challenges.
BODY_MARKERS = (
    "cdn-cgi/challenge-platform",
    "cdn-cgi/l/chk_captcha",
    "attention required! | cloudflare",
    "why_captcha",
    "px-captcha",
    "g-recaptcha-response",
    "h-captcha",
    "hcaptcha.com/1/api.js",
    "sorry, you have been blocked",
    "robot check",
    "robots or unusual traffic",
    "unusual traffic from your computer",
    "enable javascript and cookies to continue",
    "please verify you are a human",
    "access denied" ,  # only with a second signal — see detect()
    "not available in your country",
    "not available in your region",
    "is not available in your country",
    "geo-restricted",
    "blocked for legal reasons",  # 451-style
)

ACCESS_DENIED_COMPANION = ("cloudflare", "datadome", "akamai", "captcha", "bot detect", "just a moment")


def _norm_headers(headers) -> dict[str, str]:
    out = {}
    if not headers:
        return out
    if isinstance(headers, dict):
        items = headers.items()
    else:
        items = headers
    for k, v in items:
        out[str(k).lower()] = str(v or "")
    return out


def _body_text(body) -> str:
    if body is None:
        return ""
    if isinstance(body, bytes):
        return body[:80000].decode("utf-8", "replace").lower()
    return str(body)[:80000].lower()


def challenge_headers(headers: dict[str, str], status: int | None) -> str | None:
    for name, want in CHALLENGE_HEADERS:
        val = (headers.get(name) or "").lower()
        if name not in headers and name not in {k.lower() for k in headers}:
            continue
        # handle already lowercased
        val = (headers.get(name) or "").lower()
        if want is None and val:
            return f"header:{name}"
        if want and want in val:
            return f"header:{name}={want}"
    # Cloudflare often sends 403/503 with cf-ray and a challenge body; cf-ray alone is not enough.
    if status == 503 and "cf-ray" in headers:
        return "http_503_cf"
    return None


def challenge_body(text: str, status: int | None) -> str | None:
    if not text:
        return None
    for m in BODY_MARKERS:
        if m == "access denied":
            if m in text and any(c in text for c in ACCESS_DENIED_COMPANION):
                return "body:access_denied_challenge"
            continue
        if m in text:
            return f"body:{m[:40]}"
    return None


def detect_block(status=None, headers=None, body=None, error=None, curl_exit=None):
    """Return (blocked: bool, reason: str|None)."""
    hdrs = _norm_headers(headers)
    text = _body_text(body)
    err = (str(error) if error else "").lower()

    if curl_exit in RESET_EXITS:
        return True, f"transport_exit_{curl_exit}"
    if error:
        for tok, tag in (
            ("connection reset", "connection_reset"),
            ("connection refused", "connection_refused"),
            ("timed out", "timeout"),
            ("timed out", "timeout"),
            ("timeout", "timeout"),
            ("eof occurred", "connection_reset"),
            ("network is unreachable", "unreachable"),
        ):
            if tok in err:
                return True, tag
        if "certificate" in err or "ssl" in err:
            return True, "ssl_error"

    try:
        status = int(status) if status is not None and status != "" else None
    except (TypeError, ValueError):
        status = None

    if status in BLOCK_STATUSES:
        return True, f"http_{status}"

    ch = challenge_headers(hdrs, status)
    if ch and status in (None, 200, 403, 429, 451, 503):
        return True, ch

    if status == 503:
        cb = challenge_body(text, status)
        if cb:
            return True, "http_503_challenge"
        # bare 503 (origin down) is not automatically a bot block
        return False, None

    cb = challenge_body(text, status)
    if cb:
        return True, cb

    return False, None
