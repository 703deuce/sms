import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

type StatePayload = { workspaceId: string; nonce: string; exp: number; sig?: string }

function secret(): string {
  return (
    process.env.WORKER_SHARED_SECRET?.trim() ||
    process.env.INTEGRATION_SECRET_KEY?.trim() ||
    'streamer-oauth-dev'
  )
}

export function createStreamerOAuthState(workspaceId: string, ttlSec = 600): string {
  const payload: StatePayload = {
    workspaceId,
    nonce: randomBytes(16).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  }
  const body = JSON.stringify({ workspaceId: payload.workspaceId, nonce: payload.nonce, exp: payload.exp })
  const sig = createHmac('sha256', secret()).update(body).digest('hex')
  return Buffer.from(JSON.stringify({ ...payload, sig }), 'utf8').toString('base64url')
}

export function verifyStreamerOAuthState(raw: string): StatePayload {
  let parsed: StatePayload
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as StatePayload
  } catch {
    throw new Error('Invalid OAuth state')
  }
  if (!parsed.workspaceId || !parsed.nonce || !parsed.exp || !parsed.sig) {
    throw new Error('Invalid OAuth state')
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) throw new Error('OAuth state expired')
  const body = JSON.stringify({ workspaceId: parsed.workspaceId, nonce: parsed.nonce, exp: parsed.exp })
  const expected = createHmac('sha256', secret()).update(body).digest('hex')
  if (!timingSafeEqual(Buffer.from(parsed.sig), Buffer.from(expected))) {
    throw new Error('OAuth state signature mismatch')
  }
  return parsed
}
