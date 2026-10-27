"""Parse Twitch Helix duration strings (e.g. 3h2m1s) to seconds."""
from __future__ import annotations

import re

_DURATION_RE = re.compile(
    r"^(?:(?P<hours>\d+)h)?(?:(?P<minutes>\d+)m)?(?:(?P<seconds>\d+)s)?$",
    re.I,
)


def parse_twitch_duration(value: str | int | float | None) -> float:
    """Return duration in seconds. Accepts numeric seconds or Helix duration string."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return 0.0
    if s.isdigit() or re.match(r"^\d+\.\d+$", s):
        return float(s)
    m = _DURATION_RE.match(s)
    if not m:
        raise ValueError(f"invalid twitch duration: {s}")
    hours = int(m.group("hours") or 0)
    minutes = int(m.group("minutes") or 0)
    seconds = int(m.group("seconds") or 0)
    return float(hours * 3600 + minutes * 60 + seconds)
