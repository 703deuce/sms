# Stream clipper — marathon / subathon design (Rick)

**Status:** Design + scaffolding (2026-10-27). Implements chunked pipeline contracts for **multi-day** streams (up to **~30 days** on Kick retention) without holding full VOD audio on worker disk.

**Related:** `STREAMER-RICK-STAGES.md`, `STREAMER-ROLLING-READY.md`, `STREAMER-COST-DESIGN.md`, `KICK-VOD-BEHAVIOR.md`.

---

## 1. Platform facts — long streams & VOD splits

### Twitch

| Topic | Finding | Source / confidence |
|--------|---------|---------------------|
| **Max continuous broadcast** | **48 hours** — Twitch ends the broadcast at the limit; streamer must go live again for a new session. Not “split into multiple VOD files” mid-broadcast; one archive VOD per continuous broadcast up to 48 h. | Help “Broadcast Requirements”, community + ingest tools (Upstream 48 h reconnect). **[verify]** if Twitch changes limit. |
| **Multiple archive VODs** | A **new** past broadcast starts when the broadcaster **stops** streaming, is **disconnected** long enough, or hits **48 h**. Brief OBS/network drops can produce **two VODs** for one “logical” stream. | Reddit / support threads; align with Helix `stream_id` per session when available. |
| **Past broadcast length** | No separate “max VOD hours” beyond broadcast length; retention is **7 / 14 / 60 days** by tier (not hourly cap on archives). | Twitch Help — On-Demand Content. |
| **Growing VOD while live** | Archive playlist can grow during live (stage 2 Twitch rolling). | `STREAMER-ROLLING-READY.md`. |

**Product implication:** A **30-day subathon on Twitch** is necessarily **many** 24–48 h segments (manual or scheduled reconnects). We **stitch** segments into one **logical session** when offline gaps are **≤ ~10 minutes** (§5).

### Kick

| Topic | Finding | Source / confidence |
|--------|---------|---------------------|
| **Live duration** | Help: scheduled stream **calendar** duration max **48 h** — **does not** auto-end the live stream. Community reports **multi-day** lives (3+ days). | Kick Help — scheduled streams; Reddit. |
| **Replay / VOD** | One replay per ended live session; **disconnect/reconnect** can yield **multiple replays** (Help: “VOD ends partway… splitting”). | Kick Help — missing VOD. |
| **Replay retention** | **7 days** (non-verified), **30 days** (verified); **count** caps (16 / 30 replays on channel). | Rick + Kick Help. |
| **Replay length cap (unofficial)** | Community reports **~48 h** of a single live may be reflected in replay; longer lives may truncate or split — treat as **risk** until verified on prod test. | Reddit **[unverified]** — log duration on first marathon Kick. |
| **Growing replay while live** | **Not confirmed** — post-stream poll only today (`KICK-VOD-BEHAVIOR.md`). | — |

**Product implication:** **30-day Kick subathons** are **rolling marathon mode** (live HLS or periodic reconnects + many replays). Autopull + session stitch + batch publish are **required**; single paste VOD link is wrong tool for the full event.

---

## 2. Paste cap vs marathon / rolling mode

| Mode | Trigger | Max single import | Disk |
|------|---------|-------------------|------|
| **Paste VOD link** | `triggeredBy=paste` | **`STREAMER_PASTE_MAX_VOD_HOURS`** (default **10 h**) — one-shot analyze + rank + render | Audio in object storage; worker slices chunks from `audio.opus` (not full video) |
| **Marathon / connected** | `triggeredBy=auto`, `processMode=marathon` or `rolling` | **No 10 h paste cap** — bounded by **monthly usage cap** (§4) | **One analysis chunk** on worker scratch at a time when `STREAM_MARATHON_SINGLE_CHUNK_DISK=1` (default) |

### Rolling chunk pipeline (marathon)

```
stream.online / marathon session start
    → StreamSession (logical id) + StreamVod processMode=marathon
    → every STREAMER_CHUNK_MIN (10–15 min env):
         fetch ONLY next audio window (HLS section or growing Twitch archive)
         → idle gate (§3) → maybe skip transcribe
         → transcribe + signals → object storage; delete local chunk
    → every N hours (default 6): STREAM_RANK_BATCH → clips READY (partial publish)
    → calendar day boundary (UTC/user TZ): STREAM_DAILY_RECAP batch
stream.offline (or segment end) → final batch + session close
```

**Never on worker:** full multi-day `audio.opus` download. Canonical timeline = **VOD-relative ms** per platform segment + **session offset** map in `StreamVod.state.sessionTimeline`.

**Env (planned / partial):**

| Env | Default | Meaning |
|-----|---------|---------|
| `STREAMER_PASTE_MAX_VOD_HOURS` | `10` | Paste-only duration reject |
| `STREAMER_MAX_VOD_HOURS` | `10` | Alias for paste cap in worker |
| `STREAM_MARATHON_BATCH_HOURS` | `6` | Highlight batch cadence |
| `STREAM_MARATHON_DAILY_RECAP_UTC` | `0` | Hour (0–23) for daily recap boundary |
| `STREAM_MARATHON_SINGLE_CHUNK_DISK` | `1` | Enforce one local chunk |
| `STREAM_IDLE_MIN_SKIP_MIN` | `20` | Min contiguous idle to skip transcribe |

---

## 3. Silence / idle skip

**Goal:** Skip GPU transcribe on long low-activity spans (sleep, AFK, BRB slate, near-silent audio + dead chat).

**Detection (per chunk, before `transcribe_chunk`):**

1. **Audio:** RMS / peak envelope from ffmpeg `astats` or existing `audio_signal_per_second` — flag seconds below `STREAM_IDLE_AUDIO_RMS_DB` (default **−45 dBFS**) for ≥ `STREAM_IDLE_MIN_SKIP_MIN` minutes contiguous.
2. **Chat (if available):** ≤ `STREAM_IDLE_CHAT_MAX_MSG_PER_MIN` (default **2**) over same window.
3. **Optional:** Vision BRB / static scene — **phase 2** (not v1).

**Action:**

- Do **not** call Modal/Deepgram for that window.
- Append to `state.idleSkippedRanges[]` `{ startMs, endMs, reason }`.
- Log: `[clipper:stream] idle_skip vodId=… sessionId=… startMs=… endMs=… hours=… reason=audio+chat`.
- **Metering:** `idleSkippedSeconds` ++ on `stream_usage` (§4); **does not** count toward monthly **processed** cap.

**Rank:** Fusion ignores skipped ranges; transcript merge inserts gaps or placeholder silence markers so timestamps stay monotonic.

**Code:** `worker/clips_worker/streamer/idle_skip.py` (v1: audio RMS stub + hook in analyze path).

---

## 4. Usage metering & monthly cap (no billing)

| Field | Meaning |
|-------|---------|
| `stream_usage.sourceSeconds` | **Billable-equivalent processed audio** (transcribed + signal-scored), calendar month UTC |
| `stream_usage.idleSkippedSeconds` | Skipped idle (informational; not charged against cap) |
| `stream_usage.vodCount` | Distinct VOD projects metered |
| `workspace_limits.limits.streamer.monthlyHours` | Per-workspace cap (`null` / `0` = unlimited) |

**Rules:**

- **Paste:** pre-check `check_cap` at import; meter once at analyze (`meter_vod_once`) — unchanged.
- **Marathon:** `meter_chunk_seconds` after each **transcribed** chunk (idempotent per `chunkIndex` in `state.meteredChunks[]`).
- **Limit reached:** `check_cap` returns error code `stream_cap` / message `Monthly stream-hour cap reached` — UI shows **limit reached** state (no Stripe). Rolling jobs **pause** (do not fail silently).

**UI:** `StreamerUsageMeter` — processed h, idle skipped h (optional line), cap bar, `limitReached` when `usedHours >= capHours`.

---

## 5. Session stitching (restarts & splits)

**Problem:** Twitch 48 h rollover, Kick disconnect, or OBS reset → multiple Helix videos / Kick replays.

**Rule:** Merge into one **`streamSessionId`** when:

- Same `channelId` + platform, and
- Gap between **end of previous segment** and **start of next** ≤ **`STREAM_SESSION_GAP_MAX_S`** (default **600** = 10 min).

**Data:**

```json
{
  "streamSessionId": "ssess_…",
  "segments": [
    { "vodExternalId": "123", "url": "…", "streamedAt": "…", "durationMs": … }
  ],
  "sessionStartedAt": "…",
  "sessionOffsetMs": 0
}
```

**Autopull / webhook:** On `stream.offline`, if previous offline within gap, **append** segment to open session instead of new `StreamVod` row; marathon processor continues timeline with `sessionOffsetMs += prev.durationMs`.

**Code:** `worker/clips_worker/streamer/marathon_session.py`, `new-app/lib/server/streamer/marathon-session.ts`.

---

## 6. Marathon cost math (per 24 h wall clock)

**Assumptions (Modal L4, `STREAM_EST_GPU_S_PER_AUDIO_MIN=0.35`, `MODAL_L4_USD_PER_GPU_S=0.000542`):**

- GPU transcribe ≈ **$0.00019 per audio minute** → **~$0.0114 per processed hour**.
- Deepgram fallback ≈ **$0.006/min** → **~$0.36/h** (emergency only).
- LLM rank: **1× per 6 h batch** + **1× daily recap** ≈ **$0.05–0.15 per batch** (Luna shortlist) — negligible vs ASR at scale.
- Render: unchanged (short video segments only).

### Per 24 h stream (GPU path)

| Scenario | Processed hours | Idle skipped | Transcribe GPU $ (est.) | Notes |
|----------|-----------------|--------------|-------------------------|--------|
| **Active 24 h** | 24 | 0 | **~$0.27** | 24 × 60 × 0.00019 |
| **Subathon 24 h (8 h sleep)** | 16 | 8 | **~$0.18** | 33% GPU savings |
| **Subathon 24 h (12 h sleep)** | 12 | 12 | **~$0.14** | 50% GPU savings |
| **+ 6 h highlight batch** | — | — | + **~$0.08** LLM | 4 batches/day max if rolling 24/7 |

### Per 30-day Kick marathon (upper bound, no idle skip)

- **720 h** processed if truly 24/7 active → **~$8.20** GPU transcribe alone.
- With **40% idle** (12 h/day sleep): **432 h** processed → **~$4.90** GPU.
- **Monthly cap default 40 h** (`STREAMER_DEFAULT_MONTHLY_HOURS`) forces product limit before cost runaway — raise per workspace for marathon creators.

### Worker / storage (order of magnitude)

- Object storage: ~**24–48 MB/h** opus @ 16 kHz mono → **~0.6–1.2 GB/day** chunk artifacts if retained; **bulk cleanup** after batch publish per Rick storage contract.
- Poll / Helix / Kick v2: **negligible** $ vs GPU.

---

## 7. Implementation checklist

| Item | Status |
|------|--------|
| Paste 10 h cap only (`import_job` + config) | Scaffolded |
| `idle_skip.py` + usage `idleSkippedSeconds` | Scaffolded |
| `marathon_session.py` gap merge | Scaffolded |
| Rolling single-chunk disk analyze path | Design + env flag |
| `STREAM_RANK_BATCH` / daily recap jobs | **Not built** |
| Marathon UI batches on dashboard | **Not built** |
| Kick 30-day replay retention test | **Ops** |

---

## 8. Logging

- `[clipper:stream] marathon_session_merge channelId=… gapS=… sessionId=…`
- `[clipper:stream] idle_skip … hours=…`
- `[clipper:stream] marathon_batch_publish sessionId=… batchIndex=… clips=…`
- `[clipper:stream] stream_cap_blocked workspaceId=… usedH=… capH=…`
