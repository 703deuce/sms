"""Rich per-candidate context for stream fusion LLM judge."""
from __future__ import annotations

from clips_worker.video_picker import absolute_moment_ms


def _peak_in_window(series: list[float] | None, start_ms: int, end_ms: int) -> float:
    if not series:
        return 0.0
    lo = max(0, start_ms // 1000)
    hi = min(len(series), end_ms // 1000 + 1)
    if lo >= hi:
        return 0.0
    return max(float(v) for v in series[lo:hi])


def _chat_lines_in_window(messages: list[dict], start_ms: int, end_ms: int, limit: int = 8) -> list[str]:
    lo = start_ms / 1000.0
    hi = end_ms / 1000.0
    lines: list[str] = []
    for msg in messages:
        t = float(msg.get("t_s", msg.get("t", 0)))
        if t < lo or t > hi:
            continue
        text = str(msg.get("text") or "").strip()
        if not text:
            continue
        user = str(msg.get("user") or msg.get("author") or "chat")
        lines.append(f"  @{t:.1f}s {user}: {text[:120]}")
        if len(lines) >= limit:
            break
    return lines


def _viewer_hits(viewer_clips: list[dict], start_ms: int, end_ms: int) -> list[str]:
    out: list[str] = []
    for vc in viewer_clips:
        off = int(vc.get("vod_offset_ms") or vc.get("startMs") or 0)
        if start_ms - 5000 <= off <= end_ms + 5000:
            title = str(vc.get("title") or vc.get("id") or "viewer clip")[:80]
            out.append(f"  viewer_clip @{off / 1000:.1f}s: {title}")
    return out[:6]


def _cue_hits(cue_events: list[dict], start_ms: int, end_ms: int) -> list[str]:
    lo = start_ms // 1000
    hi = end_ms // 1000
    out: list[str] = []
    for ev in cue_events:
        sec = int(ev.get("sec") or 0)
        if lo <= sec <= hi:
            kind = str(ev.get("kind") or "cue")
            label = "streamer !clip" if kind == "streamer_call" else (
                "chat !clip" if kind == "chat_call" else "viewer clip moment"
            )
            out.append(f"  {label} @{sec}s")
    return out[:8]


def _visual_hit(video_moments: list[dict], start_ms: int, end_ms: int, range_start_ms: int = 0) -> str:
    best: tuple[float, str] | None = None
    for m in video_moments:
        t_ms = absolute_moment_ms(m, range_start_ms)
        if t_ms < start_ms - 4000 or t_ms > end_ms + 4000:
            continue
        try:
            sc = float(m.get("score") or 0)
        except (TypeError, ValueError):
            sc = 0.0
        reason = str(m.get("reason") or "").strip()
        if best is None or sc > best[0]:
            best = (sc, reason)
    if not best or not best[1]:
        return "  (none in window)"
    return f"  score={best[0]:.2f} — {best[1][:200]}"


def format_stream_rank_batch(
    batch: list[dict],
    words: list[dict],
    signals: dict,
    *,
    words_excerpt_fn,
    video_moments: list[dict] | None = None,
    chat_messages: list[dict] | None = None,
    viewer_clips: list[dict] | None = None,
    cue_events: list[dict] | None = None,
    range_start_ms: int = 0,
) -> str:
    vm = video_moments or []
    chat = chat_messages or []
    vclips = viewer_clips or []
    cues = cue_events or []
    blocks: list[str] = []
    for c in batch:
        start_ms = int(c["start_ms"])
        end_ms = int(c["end_ms"])
        peak = float(c.get("signal_peak") or 0)
        excerpt = words_excerpt_fn(words, start_ms, end_ms)
        chat_peak = _peak_in_window(signals.get("chat"), start_ms, end_ms)
        viewer_peak = _peak_in_window(signals.get("viewerClips"), start_ms, end_ms)
        cue_peak = _peak_in_window(signals.get("clipCues"), start_ms, end_ms)
        video_peak = _peak_in_window(signals.get("video"), start_ms, end_ms)
        chat_n = sum(
            1
            for msg in chat
            if start_ms / 1000.0 <= float(msg.get("t_s", msg.get("t", 0))) <= end_ms / 1000.0
        )
        block = [
            f"id={c['id']} window={start_ms}-{end_ms}ms peak_ms={c.get('peak_ms')} fusion_peak={peak:.2f}",
            f"signal_peaks: chat={chat_peak:.2f} viewer_clips={viewer_peak:.2f} clip_cues={cue_peak:.2f} video={video_peak:.2f}",
            f"chat_messages_in_window: {chat_n}",
        ]
        if excerpt:
            block.append(f"transcript:\n{excerpt}")
        else:
            block.append("transcript: (quiet / none)")
        chat_lines = _chat_lines_in_window(chat, start_ms, end_ms)
        if chat_lines:
            block.append("chat_sample:\n" + "\n".join(chat_lines))
        vh = _viewer_hits(vclips, start_ms, end_ms)
        if vh:
            block.append("viewer_clips:\n" + "\n".join(vh))
        ch = _cue_hits(cues, start_ms, end_ms)
        if ch:
            block.append("clip_call_hits:\n" + "\n".join(ch))
        block.append("visual_watch:\n" + _visual_hit(vm, start_ms, end_ms, range_start_ms))
        blocks.append("\n".join(block))
    header = (
        "Rank these stream moments (use ALL signals together). "
        "For each candidate return setup_start_s and payoff_end_s (seconds from VOD slice start): "
        "setup_start_s includes lead-in; payoff_end_s holds through the visual payoff plus ~1-2s.\n\n"
    )
    return header + "\n---\n".join(blocks)
