"""Redact secret values and common key patterns from text. Never logs the values."""
from __future__ import annotations

import os, re
from pathlib import Path

ENV_PATH = Path(os.environ.get("AGENT_LAB_ENV", "/opt/agent/.env"))
REPLACEMENT = "***REDACTED***"

# Patterns for values that look like secrets even if they are not in .env.
# Do not use patterns so broad they wreck ordinary prose or hashes in filenames.
PATTERNS = [
    re.compile(r"(?i)(sk-[A-Za-z0-9_-]{16,})"),
    re.compile(r"(?i)(AIza[0-9A-Za-z_-]{20,})"),
    re.compile(r"(?i)(gsk_[A-Za-z0-9]{20,})"),
    re.compile(r"(?i)(xox[baprs]-[A-Za-z0-9-]{20,})"),
    re.compile(r"(?i)(ghp_[A-Za-z0-9]{20,})"),
    re.compile(r"(?i)(github_pat_[A-Za-z0-9_]{20,})"),
    re.compile(r"(AKIA[0-9A-Z]{16})"),
    re.compile(r"(?i)((Bearer|token|api[_-]?key|secret)['\"]?\s*[:=]\s*['\"]?)([A-Za-z0-9_\-.]{16,})"),
]


def load_secret_values(path: Path = ENV_PATH):
    values = []
    try:
        text = path.read_text()
    except FileNotFoundError:
        return values
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        _, v = line.split("=", 1)
        v = v.strip().strip("'").strip('"')
        if len(v) >= 8:
            values.append(v)
    # Longest first so overlapping values redact fully.
    values.sort(key=len, reverse=True)
    return values


def redact_text(text: str, extra_values=None) -> str:
    if not text:
        return text
    values = list(extra_values or [])
    values.extend(load_secret_values())
    seen = set()
    for v in values:
        if not v or v in seen:
            continue
        seen.add(v)
        if v in text:
            text = text.replace(v, REPLACEMENT)
    def _sub_keyed(m):
        # Keep the label ("api_key="), hide the value.
        if m.lastindex and m.lastindex >= 3:
            return m.group(1) + REPLACEMENT
        return REPLACEMENT
    for pat in PATTERNS:
        if pat.groups >= 3:
            text = pat.sub(_sub_keyed, text)
        else:
            text = pat.sub(REPLACEMENT, text)
    return text


def redact_bytes(data: bytes) -> tuple[bytes, bool]:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = data.decode("utf-8", "replace")
        except Exception:
            return data, False
    new = redact_text(text)
    if new == text:
        return data, False
    return new.encode("utf-8"), True
