# Streamer v1 scope (VOD-first)

**Product decision (Rick):** Ship a rock-solid **after-stream** path before any live real-time clipping.

## In scope (v1)

- Paste Twitch / Kick **VOD** links and file **uploads**
- **Auto-import** when a connected channel’s stream ends (`stream.offline` / Kick status → `STREAM_AUTOPULL` → `STREAM_IMPORT`)
- **Chat replay** on VODs (Twitch GQL, Kick where supported) for hype / `!clip` / “clip that” signals
- Transcript + fusion ranking, layouts, montages, exports

## Frozen (behind flag, default off)

- **Live real-time clipping** (S13/S14): EventSub / Kick **live chat ingest**, in-memory chat aggregator, using `stream_chat_lines` as a VOD chat source
- Env: `STREAMER_LIVE_REALTIME_ENABLED` — must be `true` / `1` / `yes` on **web and workers** to enable
- UI: “Live clipping — coming soon” when the flag is off

## Not in v1

- Always-on GPUs / live monitoring workers beyond the existing **VOD job** `clips-worker-stream` lane
- New investment in live-only UX or infra

## Ops

- `clips-worker-stream` remains the **streamer VOD job lane** (import, analyze, render, autopull), not “live GPU.”
- Do not disable `stream.online` / `stream.offline` webhooks; they drive VOD auto-import.
