"""Candidate ledger — track every clipfind candidate to terminal state (C1)."""
from __future__ import annotations

import hashlib
import json
import threading
from typing import Any

from clips_worker.decision_log import decision_log

MAX_LEDGER_CANDIDATES = 2000


def cf_id_for(
    *,
    source: str,
    start_ms: int,
    end_ms: int,
    peak_ms: int | None = None,
) -> str:
    peak = int(peak_ms if peak_ms is not None else (start_ms + end_ms) // 2)
    raw = f"{source}|{int(start_ms)}|{int(end_ms)}|{peak}"
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


class CandidateLedger:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._candidates: dict[str, dict[str, Any]] = {}
        self._terminal: dict[str, str] = {}
        self._logged_error = False

    def _ensure(self, cf_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            row = self._candidates.setdefault(cf_id, {"cf_id": cf_id, "events": []})
            for k, v in fields.items():
                if v is not None and k not in row:
                    row[k] = v
            return row

    def register(
        self,
        cf_id: str,
        *,
        provenance: str,
        start_ms: int,
        end_ms: int,
        peak_ms: int | None = None,
        **extra: Any,
    ) -> None:
        try:
            self._ensure(
                cf_id,
                provenance=provenance,
                start_ms=int(start_ms),
                end_ms=int(end_ms),
                peak_ms=int(peak_ms if peak_ms is not None else (start_ms + end_ms) // 2),
                **extra,
            )
            self._event(cf_id, "created", provenance=provenance, start_ms=start_ms, end_ms=end_ms, **extra)
        except Exception as exc:
            self._log_once(exc)

    def merged_into(self, cf_id: str, winner: str, reason: str, **extra: Any) -> None:
        self._terminal_event(cf_id, "merged_into", winner=winner, reason=reason, **extra)

    def dropped(self, cf_id: str, stage: str, reason: str, **extra: Any) -> None:
        self._terminal_event(cf_id, "dropped", stage=stage, reason=reason, **extra)

    def demoted(self, cf_id: str, stage: str, reason: str, from_tier: str, to_tier: str, **extra: Any) -> None:
        self._terminal_event(
            cf_id,
            "demoted",
            stage=stage,
            reason=reason,
            from_tier=from_tier,
            to_tier=to_tier,
            **extra,
        )

    def advanced(self, cf_id: str, gate: str, channels: list[str] | None = None, **extra: Any) -> None:
        self._event(cf_id, "advanced", gate=gate, channels=channels or [], **extra)

    def investigate(self, cf_id: str, channel: str, **extra: Any) -> None:
        self._event(cf_id, "investigate", channel=channel, **extra)

    def ranked(self, cf_id: str, old_rank: int | None, new_rank: int | None, **extra: Any) -> None:
        self._event(cf_id, "ranked", old_rank=old_rank, new_rank=new_rank, **extra)

    def returned(self, cf_id: str, tier: str, **extra: Any) -> None:
        self._terminal_event(cf_id, "returned", tier=tier, **extra)

    def old_fate(self, cf_id: str) -> str | None:
        with self._lock:
            row = self._candidates.get(cf_id)
            if not row:
                return None
            for ev in reversed(row.get("events") or []):
                if ev.get("event") in ("dropped", "merged_into", "demoted"):
                    return f"{ev.get('event')}:{ev.get('reason') or ev.get('stage')}"
            return None

    def dropped_candidates(self) -> list[dict[str, Any]]:
        with self._lock:
            out: list[dict[str, Any]] = []
            for cf_id, term in self._terminal.items():
                if term != "dropped":
                    continue
                row = self._candidates.get(cf_id)
                if row:
                    out.append(dict(row))
            return out

    def summary(self) -> dict[str, Any]:
        with self._lock:
            items = list(self._candidates.values())[:MAX_LEDGER_CANDIDATES]
            drop_counts: dict[str, int] = {}
            for row in items:
                for ev in row.get("events") or []:
                    if ev.get("event") == "dropped":
                        key = f"{ev.get('stage')}:{ev.get('reason')}"
                        drop_counts[key] = drop_counts.get(key, 0) + 1
            orphans = [
                c["cf_id"]
                for c in items
                if c["cf_id"] not in self._terminal and c.get("events")
            ]
            return {
                "v": 1,
                "candidateCount": len(items),
                "terminalCount": len(self._terminal),
                "orphanCount": len(orphans),
                "dropCountsBySite": drop_counts,
                "candidates": items,
            }

    def write_artifacts(self, *, ledger_path: str | None, shadow_path: str | None, shadow_payload: dict | None) -> None:
        if not ledger_path and not shadow_path:
            return
        try:
            from pathlib import Path

            if ledger_path:
                p = Path(ledger_path)
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(json.dumps(self.summary(), ensure_ascii=False), encoding="utf-8")
            if shadow_path and shadow_payload is not None:
                sp = Path(shadow_path)
                sp.parent.mkdir(parents=True, exist_ok=True)
                sp.write_text(json.dumps(shadow_payload, ensure_ascii=False), encoding="utf-8")
        except Exception as exc:
            self._log_once(exc)

    def _terminal_event(self, cf_id: str, event: str, **fields: Any) -> None:
        try:
            self._event(cf_id, event, **fields)
            with self._lock:
                self._terminal[cf_id] = event
        except Exception as exc:
            self._log_once(exc)

    def _event(self, cf_id: str, event: str, **fields: Any) -> None:
        with self._lock:
            row = self._candidates.setdefault(cf_id, {"cf_id": cf_id, "events": []})
            ev = {"event": event, **{k: v for k, v in fields.items() if v is not None}}
            row["events"].append(ev)
        try:
            decision_log("clipfind_ledger", event, cf_id=cf_id, **fields)
        except Exception as exc:
            self._log_once(exc)

    def _log_once(self, exc: Exception) -> None:
        if self._logged_error:
            return
        self._logged_error = True
        try:
            decision_log("clipfind", "fallback", site="ledger", reason=type(exc).__name__)
        except Exception:
            pass


def ledger_register_moment(
    moment: dict,
    *,
    provenance: str,
    source: str | None = None,
) -> str | None:
    from clips_worker.clipfind.context import get_ledger

    led = get_ledger()
    if not led:
        return None
    try:
        if moment.get("start_ms") is not None:
            start_ms = int(moment["start_ms"])
            end_ms = int(moment["end_ms"])
            peak_ms = int(moment.get("peak_ms") or moment.get("peakMs") or (start_ms + end_ms) // 2)
        else:
            start_ms = int(float(moment.get("start_s", 0)) * 1000)
            end_ms = int(float(moment.get("end_s", 0)) * 1000)
            peak_ms = int(float(moment.get("peak_s", (start_ms + end_ms) / 2000)) * 1000)
        src = source or provenance
        cf_id = cf_id_for(source=src, start_ms=start_ms, end_ms=end_ms, peak_ms=peak_ms)
        led.register(
            cf_id,
            provenance=provenance,
            start_ms=start_ms,
            end_ms=end_ms,
            peak_ms=peak_ms,
            score=moment.get("score") or moment.get("gemini_score"),
        )
        moment["cf_id"] = cf_id
        return cf_id
    except Exception:
        return None


def ledger_drop_moment(moment: dict, stage: str, reason: str, **extra: Any) -> None:
    from clips_worker.clipfind.context import get_ledger
    from clips_worker.clipfind.flags import clipfind_flag

    if not clipfind_flag("CLIPFIND_DROP_LEDGER"):
        return
    led = get_ledger()
    if not led:
        return
    cf_id = moment.get("cf_id")
    if not cf_id:
        return
    led.dropped(cf_id, stage=stage, reason=reason, **extra)


def ledger_if_enabled(fn):
    """Decorator — no-op when ledger flag off."""

    def wrapper(*args, **kwargs):
        from clips_worker.clipfind.flags import clipfind_flag

        if not clipfind_flag("CLIPFIND_DROP_LEDGER"):
            return
        return fn(*args, **kwargs)

    return wrapper


def _peak_ms_from_pick(pick: Any) -> int:
    sm = (getattr(pick, "ai_meta", None) or {}).get("streamer") or {}
    peak = sm.get("peakMs") or getattr(pick, "peak_ms", None)
    if peak is not None:
        return int(peak)
    return (int(pick.start_ms) + int(pick.end_ms)) // 2


def ledger_ensure_fusion_pick(
    pick: Any,
    *,
    provenance: str = "fusion",
    source: str = "stream",
) -> str | None:
    from clips_worker.clipfind.context import get_ledger
    from clips_worker.clipfind.flags import clipfind_flag

    if not clipfind_flag("CLIPFIND_DROP_LEDGER"):
        return None
    led = get_ledger()
    if not led:
        return None
    try:
        meta = dict(getattr(pick, "ai_meta", None) or {})
        cf = dict(meta.get("clipfind") or {})
        if cf.get("cf_id"):
            return str(cf["cf_id"])
        start_ms = int(pick.start_ms)
        end_ms = int(pick.end_ms)
        peak_ms = _peak_ms_from_pick(pick)
        cf_id = cf_id_for(source=source, start_ms=start_ms, end_ms=end_ms, peak_ms=peak_ms)
        cf["cf_id"] = cf_id
        meta["clipfind"] = cf
        pick.ai_meta = meta
        led.register(
            cf_id,
            provenance=provenance,
            start_ms=start_ms,
            end_ms=end_ms,
            peak_ms=peak_ms,
            score=float(getattr(pick, "score", 0) or 0),
        )
        return cf_id
    except Exception:
        return None


def ledger_drop_fusion_pick(pick: Any, stage: str, reason: str, **extra: Any) -> None:
    cf_id = ledger_ensure_fusion_pick(pick)
    if not cf_id:
        return
    from clips_worker.clipfind.context import get_ledger

    led = get_ledger()
    if led:
        led.dropped(cf_id, stage=stage, reason=reason, **extra)


def ledger_merged_fusion_picks(loser: Any, winner: Any, reason: str, **extra: Any) -> None:
    loser_id = ledger_ensure_fusion_pick(loser)
    winner_id = ledger_ensure_fusion_pick(winner)
    if not loser_id or not winner_id:
        return
    from clips_worker.clipfind.context import get_ledger

    led = get_ledger()
    if led:
        led.merged_into(loser_id, winner_id, reason, **extra)


def ledger_drop_candidate(cand: dict, stage: str, reason: str, **extra: Any) -> None:
    from clips_worker.clipfind.context import get_ledger
    from clips_worker.clipfind.flags import clipfind_flag

    if not clipfind_flag("CLIPFIND_DROP_LEDGER"):
        return
    led = get_ledger()
    if not led:
        return
    try:
        start_ms = int(cand["start_ms"])
        end_ms = int(cand["end_ms"])
        peak_ms = int(cand.get("peak_ms") or (start_ms + end_ms) // 2)
        cf_id = str(cand.get("cf_id") or "")
        if not cf_id:
            cf_id = cf_id_for(source="fusion_cand", start_ms=start_ms, end_ms=end_ms, peak_ms=peak_ms)
            led.register(
                cf_id,
                provenance="fusion",
                start_ms=start_ms,
                end_ms=end_ms,
                peak_ms=peak_ms,
            )
            cand["cf_id"] = cf_id
        led.dropped(cf_id, stage=stage, reason=reason, **extra)
    except Exception:
        return


def ledger_ensure_plan_dict(p: dict, *, provenance: str = "upload", source: str = "upload") -> str | None:
    from clips_worker.clipfind.context import get_ledger
    from clips_worker.clipfind.flags import clipfind_flag

    if not clipfind_flag("CLIPFIND_DROP_LEDGER"):
        return None
    led = get_ledger()
    if not led:
        return None
    try:
        ai = p.get("ai_meta") if isinstance(p.get("ai_meta"), dict) else {}
        cf = dict((ai or {}).get("clipfind") or p.get("clipfind") or {})
        if cf.get("cf_id"):
            p.setdefault("clipfind", cf)
            return str(cf["cf_id"])
        start_ms = int(p["start_ms"])
        end_ms = int(p["end_ms"])
        peak_ms = int(p.get("peak_ms") or (start_ms + end_ms) // 2)
        cf_id = cf_id_for(source=source, start_ms=start_ms, end_ms=end_ms, peak_ms=peak_ms)
        cf["cf_id"] = cf_id
        p["clipfind"] = cf
        if isinstance(ai, dict):
            ai = {**ai, "clipfind": cf}
            p["ai_meta"] = ai
        led.register(
            cf_id,
            provenance=provenance,
            start_ms=start_ms,
            end_ms=end_ms,
            peak_ms=peak_ms,
            score=float(p.get("final_score") or p.get("score") or 0),
        )
        return cf_id
    except Exception:
        return None


def ledger_drop_plan_dict(p: dict, stage: str, reason: str, **extra: Any) -> None:
    cf_id = ledger_ensure_plan_dict(p)
    if not cf_id:
        return
    from clips_worker.clipfind.context import get_ledger

    led = get_ledger()
    if led:
        led.dropped(cf_id, stage=stage, reason=reason, **extra)


def ledger_returned_fusion_pick(pick: Any, tier: str) -> None:
    cf_id = ledger_ensure_fusion_pick(pick)
    if not cf_id:
        return
    from clips_worker.clipfind.context import get_ledger

    led = get_ledger()
    if led:
        led.returned(cf_id, tier=tier)
