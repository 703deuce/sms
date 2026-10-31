"""Shared keep-segment logic (matches web keepSegments; drops out-of-range cuts)."""
from __future__ import annotations

MIN_BLOCK_MS = 300
# G1b: main-track drag reorder (was 12; mirror of edits.ts SECTION_ORDER_MAX_BLOCKS).
SECTION_ORDER_MAX_BLOCKS = 64
MIN_SEGMENT_MS = 80


def keep_segments(trim_in: int, trim_out: int, cut_ranges: list) -> list[tuple[int, int]]:
    segs: list[tuple[int, int]] = []
    t = int(trim_in)
    hi = int(trim_out)
    for s, e in sorted(cut_ranges, key=lambda x: x[0]):
        s, e = int(s), int(e)
        if e <= t or s >= hi:
            continue
        s = max(s, t)
        e = min(e, hi)
        if e <= s:
            continue
        if s > t:
            segs.append((t, s))
        t = max(t, e)
    if t < hi:
        segs.append((t, hi))
    return [(a, b) for a, b in segs if b - a >= MIN_SEGMENT_MS]


def normalize_section_order(raw, trim_in: int, trim_out: int) -> list[tuple[int, int]] | None:
    if not raw or not isinstance(raw, list) or not raw:
        return None
    if len(raw) > SECTION_ORDER_MAX_BLOCKS:
        print("[clipper:reorder] invalid_dropped", flush=True)
        return None
    blocks: list[tuple[int, int]] = []
    for row in raw:
        if not isinstance(row, (list, tuple)) or len(row) != 2:
            print("[clipper:reorder] invalid_dropped", flush=True)
            return None
        s, e = int(row[0]), int(row[1])
        if e <= s:
            print("[clipper:reorder] invalid_dropped", flush=True)
            return None
        cs, ce = max(s, trim_in), min(e, trim_out)
        if ce - cs < MIN_BLOCK_MS:
            continue
        blocks.append((cs, ce))
    if not blocks:
        print("[clipper:reorder] invalid_dropped", flush=True)
        return None

    earliest = min(range(len(blocks)), key=lambda i: blocks[i][0])
    latest = max(range(len(blocks)), key=lambda i: blocks[i][1])
    blocks[earliest] = (trim_in, blocks[earliest][1])
    blocks[latest] = (blocks[latest][0], trim_out)

    clipped = [(max(a, trim_in), min(b, trim_out)) for a, b in blocks if min(b, trim_out) - max(a, trim_in) >= MIN_BLOCK_MS]
    if not clipped:
        print("[clipper:reorder] invalid_dropped", flush=True)
        return None

    sorted_blocks = sorted(clipped, key=lambda x: x[0])
    if sorted_blocks[0][0] > trim_in + 1 or sorted_blocks[-1][1] < trim_out - 1:
        print("[clipper:reorder] invalid_dropped", flush=True)
        return None
    for i in range(1, len(sorted_blocks)):
        if sorted_blocks[i][0] - sorted_blocks[i - 1][1] > 1:
            print("[clipper:reorder] invalid_dropped", flush=True)
            return None

    natural = True
    for i in range(1, len(clipped)):
        if clipped[i][0] < clipped[i - 1][0]:
            natural = False
            break
    if natural and len(clipped) == 1 and clipped[0][0] == trim_in and clipped[0][1] == trim_out:
        return None
    if natural:
        return None
    return clipped


def ordered_keep_segments(edits: dict) -> list[tuple[int, int]]:
    trim_in = int(edits["trim"]["in"])
    trim_out = int(edits["trim"]["out"])
    cuts = edits.get("cutRanges") or []
    try:
        blocks = normalize_section_order(edits.get("sectionOrder"), trim_in, trim_out)
        if not blocks:
            return keep_segments(trim_in, trim_out, cuts)
        out: list[tuple[int, int]] = []
        for bs, be in blocks:
            for seg in keep_segments(bs, be, cuts):
                if seg[1] - seg[0] >= MIN_SEGMENT_MS:
                    out.append(seg)
        print(f"[clipper:reorder] applied blocks={len(blocks)} segs={len(out)}", flush=True)
        return out
    except Exception as e:
        print(f"[clipper:reorder] fallback err={type(e).__name__}", flush=True)
        return keep_segments(trim_in, trim_out, cuts)
