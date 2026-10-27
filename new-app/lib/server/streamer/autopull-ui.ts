/** UI + API gate for connected-channel auto-pull (worker/EventSub unchanged). */
export function streamerAutopullUiEnabled(): boolean {
  const raw = process.env.STREAMER_AUTOPULL_ENABLED?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}
