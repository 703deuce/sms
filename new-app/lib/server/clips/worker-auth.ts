import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWorkerHmac(request: Request, rawBody: string): boolean {
  const secret = process.env.WORKER_SHARED_SECRET?.trim()
  if (!secret) return process.env.NODE_ENV !== 'production'
  const sig = request.headers.get('x-worker-signature')?.trim()
  if (!sig) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

export function signWorkerBody(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}
