import { createHmac, timingSafeEqual } from 'node:crypto'

export interface CollabTokenPayload {
  scriptId: string
  actorId: string
  role: string
  exp: number
}

function secret(): string {
  return process.env.SW_COLLAB_SECRET || process.env.SW_COLLAB_HMAC_SECRET || ''
}

export function verifyCollabToken(token: string): CollabTokenPayload | null {
  const [bodyB64, sig] = token.split('.')
  if (!bodyB64 || !sig || !secret()) return null
  const body = Buffer.from(bodyB64, 'base64url').toString('utf8')
  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  const payload = JSON.parse(body) as CollabTokenPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

export function internalAuthHeader(): string {
  const secret = process.env.SW_COLLAB_SECRET || ''
  const token = createHmac('sha256', secret).update('sw-collab-internal').digest('hex')
  return `Bearer ${token}`
}
