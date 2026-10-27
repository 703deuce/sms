# Kick live capture — design (Rick)

**Gate:** Build **after** Twitch stage 1 (paste + chunked analyze) is **reliable**.  
**Correction:** **Growing-VOD rolling is Twitch-only.** Kick publishes the replay **only after stream end**, so marathon / near-live Kick requires a **live HLS capture** path.

**Related:** `KICK-VOD-BEHAVIOR.md`, `STREAMER-MARATHON-DESIGN.md`, `STREAMER-ROLLING-READY.md`.

---

## Platform split

| Platform | While live | After offline |
|----------|------------|---------------|
| **Twitch** | Poll **growing archive VOD** `audio_only` (official Helix + HLS) | Final archive URL; optional replay trim |
| **Kick** | **Live HLS** capture (this doc) | Poll replay (`kick_videos` / v2) + yt-dlp; optional **replay-based render** for normal-length streams |

---

## 1. Stream start → live audio chunks

**Trigger:** `livestream.status.updated` with `is_live: true` (official webhook; no HLS in payload — Kick DevDocs).

**Flow:**

1. Web app verifies channel `autoProcess` + marathon/connected mode → enqueue **`STREAM_KICK_LIVE_CAPTURE`** (worker) or extend marathon session (`processMode=kick_live`).
2. Worker resolves **playback master URL** (§5) and opens **long-running HLS reader** (ffmpeg or `streamlink` subprocess).
3. Every **`STREAMER_CHUNK_MIN`** (10–15 min, same env as Twitch chunks):
   - Demux **lowest audio** rendition (or dedicated audio variant from master `#EXT-X-STREAM-INF`).
   - Write **one** local `.opus` slice → transcribe + `score_chunk_signals` → upload chunk keys → **delete local audio**.
   - Advance **session timeline** `liveCaptureOffsetMs` (monotonic; gap markers on reconnect — §4).
4. **Chat:** reuse `chat.message.sent` webhook → same chat spike signals as S13/S14 (timestamp vs `started_at`).

**Jobs:** Heartbeat + lease; on `is_live: false` webhook → stop reader, enqueue autopull + optional **replay alignment** pass (§3).

**Logging:**

- `[clipper:stream] kick_live_start channelId=… sessionId=… playbackHost=…`
- `[clipper:stream] kick_live_chunk channelId=… chunkIndex=… liveOffsetMs=…`
- `[clipper:stream] kick_live_stop reason=offline|error|cap`

---

## 2. Rolling video buffer (clip render without waiting for replay)

**Problem:** Rank may find a moment **while live**; Kick replay is **hours away**.

**Design:** Per active capture, maintain a **ring buffer** of **last N minutes** of **720p** (not full source):

| Param | Default | Env |
|-------|---------|-----|
| Buffer depth | **15 min** | `KICK_ROLLING_VIDEO_BUFFER_MIN` |
| Rendition | **720p** max (lowest acceptable for clip) | `KICK_ROLLING_VIDEO_HEIGHT` |
| Storage | Worker scratch only; **segment files** in `buffer/{seq}.ts` or fmp4 fragments | — |
| Eviction | Delete segments older than N min continuously | — |

**On candidate moment** (from live chunk rank or partial batch):

1. Map moment → **wall-clock / liveOffsetMs** window `[t − pad, t + clipLen + pad]`.
2. **Copy** (not re-encode) matching `.ts` / fmp4 parts from buffer → temp `seg.mp4` (ffmpeg concat).
3. Upload `sourceSegKey` → render pipeline (same as VOD segment path).
4. If buffer missed (rank lag > N min): **fallback** §3 replay cut or notify “moment expired”.

**Disk budget (per channel):** ~15 min × ~2.5 Mbps 720p ≈ **280 MB** video buffer + one audio chunk (~30–50 MB) ≈ **<350 MB** — must pass **disk guard** (§4) before starting capture.

---

## 3. Replay vs buffer — which render path?

| Stream profile | Recommend render source | Why |
|----------------|-------------------------|-----|
| **Short / normal** (< ~6 h), user can wait | **Final replay** via yt-dlp `--download-sections` after autopull | **More reliable** video quality, keyframes, no buffer miss; audio timeline aligned with **`align_segment_ms()`** against live-captured `audio.opus` / chunk words |
| **Marathon / subathon**, clips while live | **Rolling buffer** for time-sensitive publishes; **replay** for re-render / export later | Buffer enables **6 h batch** + daily recap **before** replay exists |
| **Post-stream only** | **Replay only** | Simplest; live capture was for analyze only |

**Alignment (replay path):** After replay URL known, download **only** the clip section from replay; cross-correlate ~5 s PCM with live chunk audio near nominal cut (`align_segment_ms`) — same as Twitch segment drift fix.

**Default product rule:** Try **buffer** if `liveOffsetMs` within buffer window; else if replay ready use **replay**; else queue render until replay or fail with clear copy.

---

## 4. Reconnects, gaps, worker limits, disk guard

### Reconnects / ad breaks / offline blips

- Webhook may flip `is_live` false briefly → **do not** end session if gap **≤ `STREAM_SESSION_GAP_MAX_S`** (10 min) — reuse `marathon_session.should_merge_stream_segments`.
- HLS reader: on 404/410 playlist stall, **exponential backoff** reconnect (same playback URL resolve step).
- Record `state.liveGaps[]` `{ atMs, durationMs, reason: 'playlist_stall'|'webhook_offline' }` for rank/transcript continuity.

### Concurrent live captures

| Env | Default | Meaning |
|-----|---------|---------|
| `KICK_LIVE_MAX_CONCURRENT_PER_WORKER` | **2** | Long-running ffmpeg readers per worker VM |
| `KICK_LIVE_MAX_CONCURRENT_GLOBAL` | **20** | Fleet cap (Redis/DB counter) |

Claim job only if under caps; else requeue with delay.

### Disk guard

- Before **start** and each **chunk**: `disk_guard_blocks_new_stream_work()` (`DISK_GUARD_PCT` default 85%).
- On block: pause capture, log `[clipper:stream] kick_live_disk_guard channelId=…`, retry job — do not corrupt buffer.

---

## 5. How we get the Kick live HLS URL

| Source | Official? | Notes |
|--------|-----------|-------|
| **`livestream.status.updated` webhook** | ✅ Kick DevDocs | **`is_live`, `started_at`, `channel_slug` only** — **no playback URL**. |
| **`GET api.kick.com/public/v2/livestreams`** (OAuth) | ✅ Documented | **No playback URL** (metadata only). |
| **`GET https://kick.com/api/v2/channels/{slug}`** | ❌ Site API (**Cloudflare**) | Top-level **`playback_url`** (IVS JWT). Practical source. Probe: **`KICK-LIVE-CAPTURE-SCALE-PROBE.md`**. |
| **yt-dlp** `-g` | ❌ Unofficial | Fallback only. |

**Resolver order:** v2 **`playback_url`** + `livestream.is_live` → yt-dlp → fail closed. IVS needs **`Referer: https://kick.com`**.

**Refresh:** Re-resolve v2 every **30–60 min** or on IVS **403**.

### Cloudflare / ToS risk

| Risk | Detail |
|------|--------|
| **Cloudflare** | `kick.com` HTML/API may challenge datacenter IPs; worker image uses **`yt-dlp[default,curl-cffi]`** for VOD — live resolver should use **same impersonation** or **residential egress** if blocked. `stream.kick.com` / IVS hosts may be less restricted than `kick.com`. |
| **ToS** | Kick ToS restricts unauthorized recording/redistribution. **Mitigation:** OAuth-connected **broadcaster’s own** channel only; user attestation in product; no public arbitrary channel capture. |
| **No SLA** | v2 channel API is **not** in DevDocs — treat like Twitch unofficial endpoints; feature-flag + fallback messaging. |

---

## 6. Bandwidth & CPU per concurrent live channel

**Measured (probe 2026-10-27):** lowest HLS rung **230 kbps**, `ffmpeg -c copy` 45 s → **~0.30 Mbps** avg, **~0 CPU** — see **`KICK-LIVE-CAPTURE-SCALE-PROBE.md`**.

| Resource | Analyze-only (lowest rung) | + 720p rolling buffer |
|----------|----------------------------|------------------------|
| **Ingress** | **~0.3 Mbps** (~135 MB/h) | **+~2–3 Mbps** when buffer active |
| **CPU** | **negligible** (copy) | **~0.1–0.3 core** demux |
| **GPU** | **~$0.0114/h** transcribe | same |

**Scale:** **30** concurrent ≈ **~9 Mbps** ingress + **~$0.34/h** ASR (upper bound, no idle-skip).

---

## 7. Implementation checklist

| Item | Status |
|------|--------|
| `kick_playback.py` resolve HLS URL | Scaffold |
| `kick_live_capture.py` job skeleton + env | Scaffold |
| Webhook → enqueue live capture (feature flag) | Stub |
| Rolling video buffer manager | **Not built** |
| Render path picker (buffer vs replay) | **Not built** |
| Twitch growing VOD rolling | Separate track |

---

## 8. Logging checklist

- `[clipper:stream] kick_playback_resolved slug=… host=… live=true`
- `[clipper:stream] kick_live_buffer_evict bytesFreed=…`
- `[clipper:stream] kick_render_source source=buffer|replay clipId=…`
- `[clipper:stream] kick_live_cap_blocked concurrent=…`
