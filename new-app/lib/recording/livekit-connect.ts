/** Client-side LiveKit URL validation (must be wss:// cloud, not REST https). */

export function assertLiveKitWsUrl(url: string): string {
  const t = url?.trim()
  if (!t) throw new Error('LiveKit URL is missing — server LIVEKIT_URL is not configured.')
  if (t.startsWith('https://') || t.startsWith('http://')) {
    throw new Error(
      `LiveKit URL must be WebSocket (wss://), not HTTP API (${t.slice(0, 32)}…).`,
    )
  }
  if (!t.startsWith('wss://') && !t.startsWith('ws://')) {
    throw new Error(`LiveKit URL must start with wss:// (got ${t.slice(0, 24)}…).`)
  }
  return t
}

export function formatLiveKitConnectError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}
