import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyTwitchEventSubSignature(
  rawBody: string,
  headers: Headers,
): { ok: boolean; messageType: string; messageId: string } {
  const secret = process.env.TWITCH_EVENTSUB_SECRET?.trim()
  if (!secret) return { ok: false, messageType: '', messageId: '' }
  const id = headers.get('Twitch-Eventsub-Message-Id') || ''
  const ts = headers.get('Twitch-Eventsub-Message-Timestamp') || ''
  const sig = headers.get('Twitch-Eventsub-Message-Signature') || ''
  const type = headers.get('Twitch-Eventsub-Message-Type') || ''
  if (!id || !ts || !sig) return { ok: false, messageType: type, messageId: id }
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > 600) return { ok: false, messageType: type, messageId: id }
  const payload = id + ts + rawBody
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
  try {
    const ok = timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    return { ok, messageType: type, messageId: id }
  } catch {
    return { ok: false, messageType: type, messageId: id }
  }
}
