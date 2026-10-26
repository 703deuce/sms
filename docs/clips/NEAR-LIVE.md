# Near-live streamer (WIP, local)

**Flag:** `STREAMER_NEAR_LIVE_ENABLED=true` (web + worker).  
**Not the same as** `STREAMER_LIVE_REALTIME_ENABLED` (live HLS clipping stays frozen; we never pull Twitch/Kick live playback).

## Twitch

1. **stream.online** (EventSub): if channel `autoProcess` and flag on → `startNearLiveSession` (project `sourceType=near_live`, `STREAM_NEAR_LIVE_POLL` every ~12 min).
2. **Poll job:** Helix `videos?type=archive&first=1` (in-progress archive grows while live). Plan chunk from `processedEndMs` → enqueue **section** `STREAM_IMPORT` (yt-dlp `--continue`, existing retry path).
3. **stream.offline:** `finalizeNearLiveSession` → `STREAM_NEAR_LIVE_FINALIZE` (full archive import + dedupe hook).
4. **Chat:** EventSub chat ingest when near-live OR live-realtime flag; hype buckets unchanged.
5. **!clip:** Helix `POST /clips` (`clips:edit` scope on channel OAuth — add to Twitch OAuth scopes before prod).

## Kick

Kick does **not** expose a reliable in-progress archive VOD API equivalent to Twitch’s growing archive recording. Near-live on Kick is **disabled** until Kick documents a stable “live VOD” or segment URL; after-stream `STREAM_AUTOPULL` remains the path.

## Reliability

- Poll jobs use `RetryableError` on Helix failures; chunk watermarks in `platformState.nearLive.processedEndMs` + vod `state` (idempotent re-poll).
- No near-live code runs unless flag is set.
