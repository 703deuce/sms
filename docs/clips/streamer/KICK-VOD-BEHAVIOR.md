# Kick VOD behavior (stream clipper)

**Rick facts (product source of truth, 2026-10-27):**

| Topic | Behavior |
|--------|----------|
| **Where replays live** | Completed streams appear under the channel **Videos** tab on Kick (`kick.com/{slug}/videos/{uuid}`). |
| **Retention** | **7 days** for non-verified channels; **up to 30 days** for verified streamers. |
| **Publish delay** | Typically **15–30 minutes** after shorter streams; **up to ~1 hour** after long streams. |
| **Official Kick API** | OAuth + **`livestream.status.updated`** webhook (stream start/end). **No official VOD-list or VOD-metadata endpoint** in the public Kick developer API. |
| **Growing VOD while live** | **Not confirmed** (unlike Twitch archive playlists). Treat **Kick rolling** as a later track. |

---

## Stage 1 — Paste replay link

**URLs:** `kick.com/{channel}/videos/{uuid}`, `kick.com/video/{uuid}`, clips query paths (see `new-app/lib/streamer/url.ts`, `worker/clips_worker/streamer/urls.py`).

**Download:** Worker uses **yt-dlp** with the Kick extractor (`curl-cffi` impersonation in the worker image).

| Step | Implementation |
|------|----------------|
| Metadata | `yt-dlp -J --no-download` (`ytdlp.metadata`) — rejects **live** / **upcoming** with replay-only copy. |
| Audio import | `yt-dlp -f "audio_only/ba/bestaudio/b"` → opus mono 16 kHz (`ytdlp.download_audio`). Prefer Kick’s `audio_only` rendition when present; fall back to best audio. |
| Video segments (render) | Same as Twitch: bounded `bv*+ba` + `--download-sections` per clip. |

**Reliability:** Paste path does not depend on the undocumented channel videos API; it only needs a **published** replay URL.

---

## Stage 2 — Auto-pull after `livestream.status.updated` (`is_live: false`)

1. Webhook (`new-app/app/api/streamer/webhooks/kick/route.ts`) enqueues `STREAM_AUTOPULL` with `runAfter = now + KICK_VOD_DELAY_S` (default **300 s**).
2. Worker polls the channel replay list with exponential backoff for up to **~90 minutes** total (`BACKOFF_MIN_KICK` + max attempts in `autopull_job.py`).
3. **Primary discovery:** `GET https://kick.com/api/v2/channels/{slug}/videos` (`kick_videos.py`) — **undocumented** JSON used today by the Kick site; not part of `api.kick.com/public/v1`.
4. **Fallback:** `yt-dlp --flat-playlist -J` on `kick.com/{slug}/videos` if the v2 list is empty or errors.
5. **Match:** Replay `start_time` within **±15 min** of webhook stream **start** (`platformState.live.startedAt`); wider window for long sessions + publish lag.
6. On success → set `stream_vods.url` → enqueue `STREAM_IMPORT` (audio-only pipeline).
7. On exhaustion → `kick_replay_pending` skip + notify; user can paste link or upload.

**UI:** Auto-import rows in `waiting_replay` show **“Waiting for Kick to publish your replay”** (`pipeline-status.ts`, Kick platform only).

**Channel connect / VOD health:** `checkKickChannelReplays` uses the same v2 videos URL (best-effort “has replays” check).

---

## Kick rolling (deferred)

Twitch stage 2 can poll a **growing archive VOD** while live. For Kick:

- There is **no confirmed** equivalent growing replay manifest during the live session.
- **Near-live** would require capturing **live HLS** (`source` on livestream payloads / channel player), which is a different ingest mode (bandwidth, reconnects, ToS).
- **Alignment to final VOD:** When rolling is built, map live-captured audio timeline to the published replay using the same **`align_segment_ms()`** cross-correlation used at render time (PCM from live chunk vs final VOD `audio.opus` near nominal cut). Design detail: `STREAMER-ROLLING-READY.md` § Kick rolling.

**Rick gate:** Ship Kick **post-stream autopull + paste** first; **do not** block stage 2 Twitch rolling on Kick live HLS.

---

## Stream clipper report — Kick approach & risks

### Approach summary

| Path | Mechanism |
|------|-----------|
| **Paste VOD** | yt-dlp Kick extractor, audio-only import, no full VOD video retention on our side. |
| **Auto-pull** | Official **stream end** webhook + **poll** channel videos (v2 API + yt-dlp fallback) up to **~90 min**. |
| **Rolling** | **Later** — live HLS + correlation to final replay; not in current stage 2 scope. |

### Terms of service & reliability

| Risk | Mitigation / product stance |
|------|-----------------------------|
| **yt-dlp uses unofficial site behavior** (Twitch and Kick). May conflict with platform ToS; extractors break on site changes. | Pin/rebuild worker image with current `yt-dlp[default,curl-cffi]`; paste + autopull failure messages ask user to **upload** recording. |
| **`kick.com/api/v2/.../videos` is undocumented** — not in Kick DevDocs; can change, rate-limit, or block datacenter IPs without notice. | Prefer v2 for autopull latency; **yt-dlp fallback**; do not assume SLA. |
| **No Helix-style VOD id at stream end** — only slug + stream start time for matching. | Poll until match or timeout; user notification on failure. |
| **Retention 7d / 30d** — auto-pull jobs that run late may find an empty list. | Surface `kick_no_replays` / skip reasons on dashboard; encourage paste within retention window. |
| **Sub-only / private replays** | Rare on Kick; failures at yt-dlp → upload path (same as Twitch sub-only). |
| **Publish delay up to ~1 h** | Backoff schedule + Kick-specific waiting copy; do not mark failed before ~90 min poll window. |

### Logging

- `[clipper:stream] stream_skipped … code=kick_replay_pending` when autopull exhausts polls.
- Standard import / cleanup logs unchanged (`[clipper:stream] cleanup_storage …` on success/failure).

---

## Related docs

- `STREAMER-RICK-STAGES.md` — stage gates (one 2–6 h paste VOD before auto-pull).
- `STREAMER_BUILD_SPEC.md` §0.5 — platform ToS note for UI.
- `RELIABILITY-RUNS.md` — acceptance checklist.
