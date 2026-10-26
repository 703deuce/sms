import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TTL_SEC = 900

export interface CollabTokenPayload {
  scriptId: string
  actorId: string
  role: 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER'
  exp: number
}

function secret(): string {
  return (
    process.env.SW_COLLAB_SECRET ||
    process.env.SW_COLLAB_HMAC_SECRET ||
    process.env.INTERNAL_JOB_HMAC_SECRET ||
    'dev-sw-collab-secret'
  )
}

export function signCollabToken(payload: Omit<CollabTokenPayload, 'exp'>, ttlSec = DEFAULT_TTL_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const body = JSON.stringify({ ...payload, exp })
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${Buffer.from(body).toString('base64url')}.${sig}`
}

export function verifyCollabToken(token: string): CollabTokenPayload | null {
  const [bodyB64, sig] = token.split('.')
  if (!bodyB64 || !sig) return null
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

export function isReadOnlyRole(role: CollabTokenPayload['role']): boolean {
  return role === 'VIEWER' || role === 'COMMENTER'
}
