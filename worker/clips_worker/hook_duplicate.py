"""E6: detect an auto hook overlay that repeats the words the captions already show."""
from __future__ import annotations


def _hook_tokens(text: str) -> list[str]:
    import re as _re

    return [t for t in _re.sub(r"[^a-z0-9' ]+", " ", str(text or "").lower()).split() if t]


def hook_text_duplicates_captions(text: str, caption_words: list[dict], duration_ms: int) -> bool:
    """E6: True when the hook line is (mostly) the words spoken while it is on screen.

    Mirrored by ``hookTextDuplicatesCaptions`` in new-app/lib/clips/hook-duplicate.ts (preview).
    """
    hook = _hook_tokens(text)
    if not hook:
        return False
    window_s = max(0.5, duration_ms / 1000.0) + 1.5
    spoken: list[str] = []
    for w in caption_words or []:
        try:
            if float(w.get("s") or 0.0) > window_s:
                break
        except (TypeError, ValueError):
            continue
        spoken.extend(_hook_tokens(str(w.get("w") or "")))
    if not spoken:
        return False
    # In-order match (subsequence) of hook tokens within the spoken window.
    j = 0
    hits = 0
    for tok in hook:
        k = j
        while k < len(spoken) and spoken[k] != tok:
            k += 1
        if k < len(spoken):
            hits += 1
            j = k + 1
    import math

    return hits >= max(2, math.ceil(0.6 * len(hook) - 1e-9)) or (len(hook) == 1 and hits == 1)
