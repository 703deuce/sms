# Kick VOD behavior (stream clipper)

**Summary for Rick / stage 2:** Kick does **not** expose a Twitch-style Helix `Get Videos (archive)` API. Replays are listed on the public channel after the stream ends.

## What we observe

| Topic | Behavior |
|--------|----------|
| **When replays appear** | After `stream.offline`, the replay usually shows on `kick.com/{channel}/videos` within **minutes**, but can take longer. Stage 2 autopull polls up to **~90 minutes** (worker backoff + Kick delay env). |
| **Paste flow** | Paste a **replay VOD URL** (`kick.com/{channel}/videos/{uuid}`), not the live channel page. Live / upcoming → blocked with “wait for replay”. |
| **Storage on Kick** | Kick hosts the replay; we **do not** store full VOD video (same contract as Twitch: audio chunks + short segments during processing only). |
| **Sub-only / private** | Less common than Twitch; failures often surface via yt-dlp (“not found”, login). Message: download while logged in and **upload** the file. |
| **Deleted / expired** | Replays may be removed by channel or policy; Helix-less detection → empty channel videos API or yt-dlp 404 → `vod_deleted` / `kick_no_replays`. |
| **Copyright / muted** | Rare; treat like Twitch muted path — `vod_muted_copyright` from import classifier. |

## Product copy

- Channel connect: `checkKickChannelReplays` uses `GET https://kick.com/api/v2/channels/{slug}/videos` (best-effort).
- Auto-clip skipped: append to `stream_channels.platformState.skippedStreams` with code + message (dashboard list).

## Stage 2

- Kick **polling** after offline (not EventSub parity with Twitch today).
- Re-verify channel has at least one recent replay before enqueueing autopull (same pattern as Twitch archive check).
