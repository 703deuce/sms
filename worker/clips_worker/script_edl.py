"""Script composition EDL (mirrors new-app/lib/clips/script-edl/derive-edl.ts)."""
from __future__ import annotations

from typing import Any, TypedDict

DEFAULT_EDL_PAD_MS = 80


class SourceSeg(TypedDict):
    kind: str  # "source"
    srcInMs: int
    srcOutMs: int
    outInMs: int
    outOutMs: int


class GapSeg(TypedDict):
    kind: str  # "gap"
    durMs: int
    freezeSrcMs: int
    outInMs: int


EdlSegment = SourceSeg | GapSeg


def _effective_bounds(w: dict, document: dict) -> tuple[int, int]:
    adj = (document.get("wordSourceAdjust") or {}).get(w["id"]) or {}
    head = max(0, int(adj.get("headTrimMs") or 0))
    tail = max(0, int(adj.get("tailTrimMs") or 0))
    t0 = int(w["t0Ms"]) + head
    t1 = max(t0 + 1, int(w["t1Ms"]) - tail)
    return t0, t1


def _pad_before(document: dict, word_id: str, default_pad: int) -> int:
    custom = (document.get("padBeforeMs") or {}).get(word_id)
    if isinstance(custom, (int, float)) and custom >= 0:
        return int(custom)
    return default_pad


def _gaps_after_word(document: dict, word_id: str) -> list[int]:
    gaps = document.get("gapInserts") or []
    out: list[int] = []
    for g in gaps:
        if g.get("afterWordId") == word_id:
            out.append(max(1, int(g.get("durMs") or 1)))
    return out


def _gaps_at_out_ms(document: dict, out_ms: int, tolerance: int = 2) -> list[int]:
    gaps = document.get("gapInserts") or []
    out: list[int] = []
    for g in gaps:
        at = g.get("atOutMs")
        if isinstance(at, (int, float)) and abs(int(at) - out_ms) <= tolerance:
            out.append(max(1, int(g.get("durMs") or 1)))
    return out


def derive_edl(document: dict, words_by_id: dict[str, dict], pad_ms: int = DEFAULT_EDL_PAD_MS) -> list[EdlSegment]:
    deleted = set(document.get("deletedWordIds") or [])
    ignored = set(document.get("ignoredWordIds") or [])
    order = document.get("wordOrder") or (
        list(document.get("keptWordIds") or []) + list(document.get("deletedWordIds") or [])
    )
    kept: list[dict] = []
    for wid in order:
        w = words_by_id.get(wid)
        if not w or wid in deleted or wid in ignored:
            continue
        kept.append(w)
    kept.sort(key=lambda w: int(w["t0Ms"]))

    segments: list[EdlSegment] = []
    out_ms = 0
    prev_src_out = 0

    def push_gap(dur_ms: int, freeze_src_ms: int) -> None:
        nonlocal out_ms
        segments.append(
            {"kind": "gap", "durMs": dur_ms, "freezeSrcMs": freeze_src_ms, "outInMs": out_ms},
        )
        out_ms += dur_ms

    for i, w in enumerate(kept):
        prev = kept[i - 1] if i > 0 else None
        t0, t1 = _effective_bounds(w, document)
        pad_before = _pad_before(document, w["id"], pad_ms) if prev else 0
        src_in_raw = max(0, t0 - pad_before)
        src_in = max(src_in_raw, prev_src_out) if prev else src_in_raw
        src_out = t1 + pad_ms
        prev_src_out = src_out
        dur = max(1, src_out - src_in)
        out_out = out_ms + dur
        segments.append(
            {
                "kind": "source",
                "srcInMs": src_in,
                "srcOutMs": src_out,
                "outInMs": out_ms,
                "outOutMs": out_out,
            },
        )
        out_ms = out_out
        for g in _gaps_after_word(document, w["id"]):
            push_gap(g, t1)
        for g in _gaps_at_out_ms(document, out_ms):
            push_gap(g, t1)

    return _merge_adjacent_source(segments)


def _merge_adjacent_source(segments: list[EdlSegment]) -> list[EdlSegment]:
    out: list[EdlSegment] = []
    for seg in segments:
        if seg["kind"] != "source":
            out.append(seg)
            continue
        if out and out[-1]["kind"] == "source":
            last = out[-1]
            if last["srcOutMs"] >= seg["srcInMs"] - 1:
                last["srcOutMs"] = max(last["srcOutMs"], seg["srcOutMs"])
                last["outOutMs"] = seg["outOutMs"]
                continue
        out.append(dict(seg))
    return out


def output_duration_ms(edl: list[EdlSegment]) -> int:
    max_out = 0
    for seg in edl:
        if seg["kind"] == "source":
            max_out = max(max_out, int(seg["outOutMs"]))
        else:
            max_out = max(max_out, int(seg["outInMs"]) + int(seg["durMs"]))
    return max_out


def _merged_source_spans(edl: list[EdlSegment]) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    for seg in edl:
        if seg["kind"] != "source":
            continue
        s_in = int(seg["srcInMs"])
        s_out = int(seg["srcOutMs"])
        if spans and spans[-1][1] >= s_in - 1:
            spans[-1] = (spans[-1][0], max(spans[-1][1], s_out))
        else:
            spans.append((s_in, s_out))
    return spans


def _merge_cut_ranges(cuts: list[list[int]]) -> list[list[int]]:
    pairs = sorted([[int(c[0]), int(c[1])] for c in cuts if c and len(c) >= 2], key=lambda x: x[0])
    out: list[list[int]] = []
    for s, e in pairs:
        if e <= s:
            continue
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out


def edl_to_trim_and_cut_ranges(
    edl: list[EdlSegment],
    range_start_ms: int,
    range_end_ms: int,
) -> tuple[int, int, list[list[int]]]:
    """Cut silences between EDL kept source spans (matches editor preview)."""
    spans = _merged_source_spans(edl)
    if not spans:
        return range_start_ms, range_end_ms, []
    trim_in = max(range_start_ms, spans[0][0])
    trim_out = min(range_end_ms, spans[-1][1])
    cuts: list[list[int]] = []
    if spans[0][0] > trim_in:
        cuts.append([trim_in, spans[0][0]])
    for i in range(len(spans) - 1):
        gap_start, gap_end = spans[i][1], spans[i + 1][0]
        if gap_end > gap_start + 1:
            cuts.append([gap_start, gap_end])
    if spans[-1][1] < trim_out:
        cuts.append([spans[-1][1], trim_out])
    return trim_in, trim_out, _merge_cut_ranges(cuts)


def sum_merged_source_span_ms(edl: list[EdlSegment]) -> int:
    return sum(max(0, b - a) for a, b in _merged_source_spans(edl))


def edl_to_cut_ranges_and_trim(
    document: dict,
    words_by_id: dict[str, dict],
    range_start_ms: int,
    range_end_ms: int,
) -> tuple[int, int, list[list[int]]]:
    """Legacy: prefer edl_to_trim_and_cut_ranges(derive_edl(...), ...)."""
    edl = derive_edl(document, words_by_id)
    return edl_to_trim_and_cut_ranges(edl, range_start_ms, range_end_ms)
