"""FV4a: ffmpeg expression helpers that stay inside libavutil/eval.c's nesting limit.

av_expr_parse() refuses expressions nested deeper than ~100 levels (``stack_index = 100``) with
EINVAL ("Invalid argument" when the filter is configured). A linear ``if(a, x, if(b, y, ...))``
chain adds one level per keyframe, so it broke once a long video had more than ~25 punch zooms
or ~100 envelope points. The same piecewise function as a balanced ``if(lt(...))`` tree has depth
ceil(log2(pieces)); 10 000 pieces → 14 levels. Same values, same thresholds, valid on ffmpeg 5.1.
"""
from __future__ import annotations


def balanced_piecewise(var: str, thresholds: list[str], pieces: list[str]) -> str:
    """Expression for: pieces[0] if var < thresholds[0]; pieces[i] if thresholds[i-1] <= var < thresholds[i];
    pieces[-1] if var >= thresholds[-1].

    ``len(pieces) == len(thresholds) + 1``; thresholds must be non-decreasing (already formatted numbers).
    """
    if len(pieces) != len(thresholds) + 1:
        raise ValueError("balanced_piecewise: need len(pieces) == len(thresholds) + 1")

    def build(lo: int, hi: int) -> str:
        # pieces[lo..hi]; boundary between piece k-1 and k is thresholds[k-1]
        if lo == hi:
            return pieces[lo]
        mid = (lo + hi + 1) // 2
        return f"if(lt({var},{thresholds[mid - 1]}),{build(lo, mid - 1)},{build(mid, hi)})"

    return build(0, len(pieces) - 1)


def nesting_depth(expr: str) -> int:
    """Max parenthesis depth (tests / guards)."""
    d = best = 0
    for ch in expr:
        if ch == "(":
            d += 1
            best = max(best, d)
        elif ch == ")":
            d -= 1
    return best
