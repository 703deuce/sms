"""C3 eval harness: run the stream pick path on short labeled windows with flags OFF vs ON and score it.

  python -m clips_worker.tools.eval_clipfind run   --labels labels_c3.json --media-dir ~/c3_windows --out eval_out
  python -m clips_worker.tools.eval_clipfind score --labels labels_c3.json --picks eval_out/picks_on.json

Scoring is pure (score_case / score_all) and unit-tested. Nothing is hardcoded to pass: an unlabeled case
(any TODO time) is reported as "unlabeled" and excluded from the totals.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

TOLERANCE_S = 1.5
FOUND_IOU = 0.3


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def truth(case: dict) -> dict | None:
    e = case.get("expect") or {}
    s, p, r = _num(e.get("setup_start_s")), _num(e.get("payoff_s")), _num(e.get("reaction_end_s"))
    if case.get("expect_demote"):
        lo, hi = _num(e.get("span_start_s")), _num(e.get("span_end_s"))
        return {"span": (lo, hi)} if lo is not None and hi is not None and lo < hi else None
    if s is None or p is None or r is None or not (s < p <= r):
        return None
    return {"setup": s, "payoff": p, "reaction_end": r}


def iou(a0: float, a1: float, b0: float, b1: float) -> float:
    inter = max(0.0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return inter / union if union > 0 else 0.0


def score_case(case: dict, picks: list[dict], top_n: int = 3) -> dict:
    """picks: [{"start_s","end_s","tier"}] in rank order, window-relative seconds."""
    t = truth(case)
    out: dict[str, Any] = {"id": case.get("id"), "archetype": case.get("archetype"), "n_picks": len(picks)}
    if t is None:
        out["status"] = "unlabeled"
        return out
    if "span" in t:
        lo, hi = t["span"]
        bad = [i for i, p in enumerate(picks) if p.get("tier") == "primary"
               and iou(float(p["start_s"]), float(p["end_s"]), lo, hi) >= FOUND_IOU]
        out.update(status="scored", kind="false_alarm", passed=not bad, primary_hits=bad)
        return out
    s, pay, r = t["setup"], t["payoff"], t["reaction_end"]
    best_i, best_iou = None, 0.0
    for i, p in enumerate(picks):
        ps, pe = float(p["start_s"]), float(p["end_s"])
        v = iou(ps, pe, s, r)
        if (v >= FOUND_IOU or ps <= pay <= pe) and (best_i is None or v > best_iou):
            best_i, best_iou = i, v
    found = best_i is not None
    bp = picks[best_i] if found else None
    out.update(
        status="scored", kind="moment", found=found, rank=best_i,
        top_n=bool(found and best_i < top_n), iou=round(best_iou, 3),
        setup_kept=bool(found and float(bp["start_s"]) <= s + TOLERANCE_S),
        reaction_kept=bool(found and float(bp["end_s"]) >= r - TOLERANCE_S),
        start_err_s=round(float(bp["start_s"]) - s, 2) if found else None,
        end_err_s=round(float(bp["end_s"]) - r, 2) if found else None,
        primary=bool(found and bp.get("tier") == "primary"),
    )
    return out


def score_all(labels: dict, picks_by_case: dict[str, list[dict]], top_n: int = 3) -> dict:
    rows = [score_case(c, picks_by_case.get(str(c.get("id")), []), top_n) for c in labels.get("cases", [])]
    m = [r for r in rows if r.get("kind") == "moment"]
    fa = [r for r in rows if r.get("kind") == "false_alarm"]

    def rate(key: str, xs: list[dict]) -> float | None:
        return round(sum(1 for x in xs if x.get(key)) / len(xs), 3) if xs else None

    return {
        "cases": rows,
        "summary": {
            "scored": len(m) + len(fa), "unlabeled": sum(1 for r in rows if r["status"] == "unlabeled"),
            "found": rate("found", m), f"top{top_n}": rate("top_n", m), "setup_kept": rate("setup_kept", m),
            "reaction_kept": rate("reaction_kept", m),
            "mean_iou": round(sum(r["iou"] for r in m) / len(m), 3) if m else None,
            "false_alarm_pass": rate("passed", fa),
        },
    }


def compare(off: dict, on: dict) -> list[str]:
    """Human diff lines: which metrics got better/worse with flags ON."""
    lines = []
    for k, v_on in on["summary"].items():
        v_off = off["summary"].get(k)
        if isinstance(v_on, (int, float)) and isinstance(v_off, (int, float)) and v_on != v_off:
            lines.append(f"{k}: off={v_off} on={v_on} ({'better' if v_on > v_off else 'worse'})")
    return lines


# ------------------------------------------------------------------ runner (needs the worker env)
def _run_window(media: Path, mode: str) -> list[dict]:
    """Run transcription + rank_moments + c3_seams.post_rank_stream on one local window file.
    mode 'off' => CLIPFIND_ALL_OFF=1. mode 'on' => project override on 'proj_eval'."""
    from clips_worker.clipfind.context import bind_clipfind, unbind_clipfind
    from clips_worker.clipfind.c3_seams import eval_pick_window              # added in C3a §4.6
    os.environ.pop("CLIPFIND_ALL_OFF", None)
    os.environ.pop("CLIPFIND_ON_PROJECTS", None)
    if mode == "off":
        os.environ["CLIPFIND_ALL_OFF"] = "1"
    else:
        os.environ["CLIPFIND_ON_PROJECTS"] = "proj_eval"
    bind_clipfind(workspace_id="ws_eval", job_type="EVAL", job_id=f"eval_{media.stem}_{mode}",
                  project_id="proj_eval")
    try:
        return eval_pick_window(media)
    finally:
        unbind_clipfind()


def cmd_run(a: argparse.Namespace) -> int:
    labels = json.loads(Path(a.labels).read_text())
    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    results = {}
    for mode in ("off", "on"):
        picks: dict[str, list[dict]] = {}
        for c in labels["cases"]:
            media = Path(a.media_dir) / f"{c['id']}.mp4"
            if not media.is_file():
                print(f"[eval] missing {media}; run download_c3_windows.sh", file=sys.stderr)
                continue
            picks[c["id"]] = _run_window(media, mode)
        (out_dir / f"picks_{mode}.json").write_text(json.dumps(picks, indent=1))
        results[mode] = score_all(labels, picks, a.top_n)
        (out_dir / f"score_{mode}.json").write_text(json.dumps(results[mode], indent=1))
    print(json.dumps({"off": results["off"]["summary"], "on": results["on"]["summary"]}, indent=1))
    print("\n".join(compare(results["off"], results["on"])) or "no metric changed")
    return 0


def cmd_score(a: argparse.Namespace) -> int:
    labels = json.loads(Path(a.labels).read_text())
    picks = json.loads(Path(a.picks).read_text())
    print(json.dumps(score_all(labels, picks, a.top_n), indent=1))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="eval_clipfind")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--labels", required=True)
    r.add_argument("--media-dir", required=True)
    r.add_argument("--out", default="eval_out")
    r.add_argument("--top-n", type=int, default=3)
    s = sub.add_parser("score")
    s.add_argument("--labels", required=True)
    s.add_argument("--picks", required=True)
    s.add_argument("--top-n", type=int, default=3)
    a = ap.parse_args(argv)
    return cmd_run(a) if a.cmd == "run" else cmd_score(a)


if __name__ == "__main__":
    raise SystemExit(main())
