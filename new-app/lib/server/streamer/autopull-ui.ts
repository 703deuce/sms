/** UI + API gate for connected-channel auto-pull (worker/EventSub unchanged). Default off until ops enables. */
export function streamerAutopullUiEnabled(): boolean {
  const raw = process.env.STREAMER_AUTOPULL_ENABLED?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}
