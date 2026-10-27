# Kick live capture — scale & probe appendix (Rick)

**Design only.** Probe run **2026-10-27** from a **single datacenter IP** (Cursor cloud VM, US). No login.

---

## Playback URL — official vs website

| Source | Exposes viewer HLS `.m3u8`? |
|--------|------------------------------|
| **`livestream.status.updated` webhook** | **No** — `is_live`, `started_at`, `channel_slug` only (Kick DevDocs). |
| **`GET api.kick.com/public/v1/channels`** | **No** — `stream.url` is **ingest**, not playback (Kick staff on GitHub #168). |
| **`GET api.kick.com/public/v2/livestreams`** (OAuth) | **No** — metadata only (title, slug, viewers, thumbnail). |
| **`GET kick.com/api/v2/channels/{slug}`** | **Yes** — top-level **`playback_url`**: AWS IVS signed URL (`*.playback.live-video.net?...token=JWT`). **Not** in official Dev API; **behind Cloudflare** on `kick.com`. |
| **Live listing** | `GET kick.com/stream/livestreams/en` (undocumented) → channel slugs for discovery. |

**Conclusion:** Production resolver must use **v2 channel JSON (or equivalent site API)** after webhook; **cannot** rely on OAuth public API alone. Store JWT expiry; refresh **playback_url** periodically.

**IVS fetch:** Master playlist requires **`Referer` / `Origin: https://kick.com`** (token embeds allowed origins). Plain `urllib` without headers → **403** on IVS in probe.

---

## Cloudflare probe (one IP, 5 live channels)

**Method:** Listed 5 live slugs from `stream/livestreams/en`; twice in a row hit `kick.com/api/v2/channels/{slug}`; then fetched one IVS master + lowest variant media playlist + **45 s** `ffmpeg -c copy`.

| Step | Result |
|------|--------|
| v2 channel ×5 (pass 1) | **HTTP 200**, `server: cloudflare`, `cf-ray` present, **43–550 ms** |
| v2 channel ×5 (pass 2, immediate) | **HTTP 200**, **52–110 ms** — **no challenge / no 429** in this short burst |
| IVS `master.m3u8` | **HTTP 200** with Referer/Origin |
| Lowest variant | **230 kbps** declared bandwidth (5 rungs on master) |

**Not observed in ~1 min:** HTML CF challenge, 1015 rate limit, or IP block. **Not proven safe** for 24×7 × 30 channels — treat as **lower bound**; prod needs egress diversity + backoff.

---

## Measured per-stream (lowest HLS rung, `-c copy`, 45 s)

| Metric | Value |
|--------|--------|
| **Ingress** | **~0.30 Mbps** avg (**~135 MB/h**, **~1.68 MB / 45 s**) |
| **CPU** | **~0.0 s** process CPU (ffmpeg copy; demux only) |

**Audio-only note:** Lowest rung here was **230 kbps** video+audio mux. Dedicated audio-only variant (if present on other channels) is often **~64–128 kbps** → budget **~0.06–0.13 Mbps** (~**30–60 MB/h**) for analyze-only; **720p rolling buffer** remains **~2–3 Mbps** if enabled separately.

---

## Cost @ 100 users, 10–30 live (design math)

Assume **analyze path = lowest rendition copy** (~**0.3 Mbps** measured), **no** 720p buffer on all channels (buffer only when a ranked moment needs video).

| Concurrent live | Ingress | Egress storage (chunks to object store) | GPU transcribe |
|-----------------|---------|----------------------------------------|----------------|
| **10** | **~3 Mbps** (~**1.3 GB/h**) | Same order as ingress (chunk upload) | **10 × ~$0.0114/h** ≈ **$0.11/h** |
| **30** | **~9 Mbps** (~**4 GB/h**) | ~4 GB/h upload | **≈ $0.34/h** |

**Worker fleet:** Prefer **dedicated `clips-worker-stream-live` pool**; cap **`KICK_LIVE_MAX_CONCURRENT_PER_WORKER=2`**, **~15 workers** for 30 streams with headroom.

**$ infra (rough):** 30 × **0.3 Mbps** ≈ **9 Mbps** sustained → **~1–2** modest VMs with bandwidth + **~$0.34/h** Modal ASR at full duty (upper bound if no idle-skip).

---

## Mitigation plan (100 users / 10–30 live)

1. **Opt-in only** — `autoProcess` + explicit **Kick live capture** toggle; OAuth broadcaster channel only.
2. **Spread egress** — multiple worker IPs / regions; **≤2 captures per VM**; avoid resolving all channels from one IP in a tight loop (jitter 2–10 s).
3. **Backoff** — on v2 **403/429**, IVS **403**, or playlist stall: exponential backoff, re-resolve `playback_url`; pause session before hammering.
4. **Disk guard** — existing **>85%** scratch block; no 720p buffer unless moment pipeline active.
5. **Fallback** — on sustained live block: stop reader, log `kick_live_blocked`, continue **chat/webhook** if any, finish via **post-stream VOD autopull** + replay render (`KICK-VOD-BEHAVIOR.md`); notify “live capture unavailable, clips after replay.”
6. **Rate limits** — global cap **`KICK_LIVE_MAX_CONCURRENT_GLOBAL`** (e.g. **30**); queue excess with user-visible “capacity” state.

---

## References

- `KICK-LIVE-CAPTURE-DESIGN.md` — buffer, batch, alignment.
- Probe artifact: single-channel slug `dhital08`, 45 s copy, lowest variant **230 kbps**.
