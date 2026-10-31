"""E5b: on-demand media transcripts joined into the clip transcript (export captions / SRT).

Mirror of new-app/lib/clips/editor/media-words.ts (parity: tests/fixtures/e5b_parity.json).
"""
from __future__ import annotations

MEDIA_WORD_INDEX_BASE = 1_000_000_000
_PER_MEDIA = 1_000_000


def _jsround(x: float) -> int:
    """JS Math.round (half up), not Python's half-even."""
    import math

    return int(math.floor(x + 0.5))


def media_bucket(ref_id: str) -> int:
    h = 0x811C9DC5
    for ch in ref_id:
        h ^= ord(ch) & 0xFFFF
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h % 1000


def media_word_index(ref_id: str, k: int) -> int:
    return MEDIA_WORD_INDEX_BASE + media_bucket(ref_id) * _PER_MEDIA + min(k, _PER_MEDIA - 1)


def _done(transcripts: dict[str, list[dict]] | None) -> dict[str, list[dict]]:
    return {k: v for k, v in (transcripts or {}).items() if v}


def merge_media_words(words: list[dict], edits: dict, transcripts: dict[str, list[dict]] | None) -> list[dict]:
    """transcripts: refId → media-time words [{w, s, e, p?}] (seconds)."""
    from clips_worker.media_sources import normalize_media_sources, normalize_source_segments, segment_audio

    by_ref = _done(transcripts)
    if not by_ref or not edits.get("sourceSegments"):
        return words
    sources = normalize_media_sources(edits.get("sources")) or []
    by_id = {s["id"]: s for s in sources}
    spans: list[tuple[int, int, list[dict]]] = []
    for seg in normalize_source_segments(edits.get("sourceSegments"), sources) or []:
        src = by_id.get(seg["sourceId"])
        if not src or src["mediaType"] != "video" or segment_audio(seg, src) != "source":
            continue
        tr = by_ref.get(src["refId"])
        if not tr:
            continue
        synced = src.get("syncMs") is not None and seg.get("inMs") is None
        delta = int(src.get("syncMs") or 0) if synced else int(seg.get("inMs") or 0) - int(seg["startMs"])
        add: list[dict] = []
        for k, w in enumerate(tr):
            s = _jsround(float(w["s"]) * 1000) - delta
            e = _jsround(float(w["e"]) * 1000) - delta
            mid = (s + e) / 2
            if mid < seg["startMs"] or mid >= seg["endMs"] or not str(w.get("w") or "").strip():
                continue
            item = {
                "w": w["w"],
                "s": max(seg["startMs"], s) / 1000.0,
                "e": min(seg["endMs"], max(s + 1, e)) / 1000.0,
                "i": media_word_index(src["refId"], k),
            }
            if w.get("p") is not None:
                item["p"] = w["p"]
            add.append(item)
        spans.append((int(seg["startMs"]), int(seg["endMs"]), add))
    if not spans:
        return words

    def in_span(w: dict) -> bool:
        mid = (float(w["s"]) + float(w["e"])) / 2 * 1000
        return any(a <= mid < b for a, b, _ in spans)

    out = [w for w in words if not in_span(w)]
    for _a, _b, add in spans:
        out.extend(add)
    out.sort(key=lambda w: (float(w["s"]), float(w["e"])))
    return out


def insert_words(windows: list[dict], edits: dict, transcripts: dict[str, list[dict]] | None) -> list[dict]:
    """Display-ms words heard during each insert (word fixes applied)."""
    from clips_worker.media_sources import normalize_media_sources

    by_ref = _done(transcripts)
    by_id = {s["id"]: s for s in (normalize_media_sources(edits.get("sources")) or [])}
    fixes = edits.get("wordFixes") or {}
    out: list[dict] = []
    for win in windows:
        if win["audio"] != "source":
            continue
        src = by_id.get(win["sourceId"])
        tr = by_ref.get(src["refId"]) if src else None
        if not tr:
            continue
        for k, w in enumerate(tr):
            s = _jsround(float(w["s"]) * 1000)
            e = _jsround(float(w["e"]) * 1000)
            mid = (s + e) / 2
            if mid < win["inMs"] or mid >= win["inMs"] + win["durMs"]:
                continue
            i = media_word_index(src["refId"], k)
            text = fixes.get(str(i), w.get("w"))
            if not str(text or "").strip():
                continue
            out.append(
                {
                    "w": text,
                    "startMs": win["startMs"] + max(0, s - win["inMs"]),
                    "endMs": win["startMs"] + min(win["durMs"], max(s + 1, e) - win["inMs"]),
                    "i": i,
                    "insertId": win["id"],
                }
            )
    return out


def load_media_transcripts(conn, project_id: str, workspace_id: str, ref_ids: list[str]) -> dict[str, list[dict]]:
    if not ref_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "refId", words FROM clip_media_transcripts '
            'WHERE "projectId" = %s AND "workspaceId" = %s AND status = %s AND "refId" = ANY(%s)',
            (project_id, workspace_id, "done", list(ref_ids)),
        )
        rows = cur.fetchall()
    out: dict[str, list[dict]] = {}
    for ref_id, words in rows:
        if isinstance(words, str):
            import json

            words = json.loads(words or "[]")
        if isinstance(words, list):
            out[str(ref_id)] = words
    return out
