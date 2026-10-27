"""Dedupe clip picks for overlapping Twitch rolling windows and within-run peaks."""
from __future__ import annotations

import json
from typing import Any

from clips_worker.streamer.fusion import FusionPick
from psycopg2.extras import RealDictCursor


def _iou_ms(a0: int, a1: int, b0: int, b1: int) -> float:
    inter = max(0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return inter / union if union > 0 else 0.0


def _peak_ms(pick: FusionPick) -> int:
    sm = (pick.ai_meta or {}).get("streamer") or {}
    return int(sm.get("peakMs") or pick.peak_ms or (pick.start_ms + pick.end_ms) // 2)


def dedupe_picks_within_run(
    picks: list[FusionPick],
    *,
    min_peak_sep_ms: int = 45_000,
    iou_threshold: float = 0.35,
) -> list[FusionPick]:
    """Stricter than fusion IoU dedupe — rolling overlap often repeats the same moment."""
    ordered = sorted(picks, key=lambda p: p.score, reverse=True)
    kept: list[FusionPick] = []
    for p in ordered:
        peak = _peak_ms(p)
        if any(abs(peak - _peak_ms(k)) < min_peak_sep_ms for k in kept):
            continue
        if any(_iou_ms(p.start_ms, p.end_ms, k.start_ms, k.end_ms) > iou_threshold for k in kept):
            continue
        kept.append(p)
    kept.sort(key=lambda p: p.score, reverse=True)
    return kept


def _absolute_span(pick: FusionPick, vod_range_start_ms: int) -> tuple[int, int, int]:
    peak = vod_range_start_ms + _peak_ms(pick)
    start = vod_range_start_ms + pick.start_ms
    end = vod_range_start_ms + pick.end_ms
    return start, end, peak


def load_prior_channel_clip_spans(
    conn,
    *,
    workspace_id: str,
    channel_id: str,
    exclude_vod_id: str,
    lookback_days: int = 14,
) -> list[dict[str, int]]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT c."startMs", c."endMs", c."aiMeta", v."rangeStartMs"
            FROM clips c
            JOIN stream_vods v ON v."projectId" = c."projectId"
            WHERE v."workspaceId" = %s
              AND v."channelId" = %s
              AND v.id <> %s
              AND c."deletedAt" IS NULL
              AND v."createdAt" > NOW() - (%s || ' days')::interval
            ORDER BY c."createdAt" DESC
            LIMIT 500
            """,
            (workspace_id, channel_id, exclude_vod_id, str(lookback_days)),
        )
        rows = cur.fetchall() or []
    spans: list[dict[str, int]] = []
    for row in rows:
        meta = row.get("aiMeta") or {}
        if isinstance(meta, str):
            meta = json.loads(meta)
        sm = (meta or {}).get("streamer") or {}
        rs = int(row.get("rangeStartMs") or 0)
        peak_rel = int(sm.get("peakMs") or (int(row["startMs"]) + int(row["endMs"])) // 2)
        spans.append(
            {
                "start": rs + int(row["startMs"]),
                "end": rs + int(row["endMs"]),
                "peak": rs + peak_rel,
            }
        )
    return spans


def dedupe_picks_against_channel_history(
    picks: list[FusionPick],
    prior_spans: list[dict[str, int]],
    *,
    vod_range_start_ms: int,
    min_peak_sep_ms: int = 60_000,
    iou_threshold: float = 0.4,
) -> tuple[list[FusionPick], int]:
    """Drop picks that match a recent clip on the same channel (rolling window overlap)."""
    if not prior_spans:
        return picks, 0
    kept: list[FusionPick] = []
    dropped = 0
    for p in picks:
        start, end, peak = _absolute_span(p, vod_range_start_ms)
        duplicate = False
        for prior in prior_spans:
            if abs(peak - int(prior["peak"])) < min_peak_sep_ms:
                duplicate = True
                break
            if _iou_ms(start, end, int(prior["start"]), int(prior["end"])) > iou_threshold:
                duplicate = True
                break
        if duplicate:
            dropped += 1
            continue
        kept.append(p)
    return kept, dropped


def dedupe_stream_picks(
    conn,
    vod: dict[str, Any],
    picks: list[FusionPick],
) -> list[FusionPick]:
    """Within-run + cross-VOD channel dedupe for rolling ingest."""
    picks = dedupe_picks_within_run(picks)
    channel_id = vod.get("channelId")
    if not channel_id:
        return picks
    prior = load_prior_channel_clip_spans(
        conn,
        workspace_id=str(vod["workspaceId"]),
        channel_id=str(channel_id),
        exclude_vod_id=str(vod["id"]),
    )
    range_start = int(vod.get("rangeStartMs") or 0)
    picks, dropped = dedupe_picks_against_channel_history(picks, prior, vod_range_start_ms=range_start)
    if dropped:
        print(
            f"[clipper:stream] rolling_dedupe vodId={vod.get('id')} dropped={dropped} "
            f"prior_spans={len(prior)}",
            flush=True,
        )
    return picks
