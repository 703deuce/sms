import { NextResponse } from 'next/server'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { PollBusyError } from '@/lib/server/db-read-gate'
import { classifyPoolError } from '@/lib/server/db'

export function motionStudioJsonError(err: unknown) {
  // The browser went away (tab closed, navigation, component unmounted and aborted its fetch).
  // Nobody reads this response; it is not a server failure, so do not log a 500.
  if (isClientAbort(err)) {
    console.info('[motion-studio:api] client_aborted')
    return new NextResponse(null, { status: 499 })
  }
  // Polling backpressure: tell the client to skip this tick, without logging an error per request.
  if (err instanceof PollBusyError || classifyPoolError(err) === 'local_pool_timeout') {
    if (!(err instanceof PollBusyError)) console.warn('[motion-studio:api] pool_busy', { code: 'P2024' })
    return NextResponse.json({ error: 'The server is busy. This will refresh automatically.', code: 'BUSY' },
      { status: 503, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' } })
  }
  const error = err instanceof MotionStudioError ? err : new MotionStudioError('INTERNAL', 'Motion Studio could not complete the request.', 500)
  console.error('[motion-studio:api] request_failed', {
    code: error.code, status: error.status, type: err instanceof Error ? err.name : typeof err,
    detail: err instanceof MotionStudioError ? undefined : err instanceof Error ? err.message.slice(0, 200) : undefined,
  })
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
}

function isClientAbort(err: unknown): boolean {
  const e = err as { name?: unknown; message?: unknown; code?: unknown } | null
  if (!e) return false
  return e.message === 'aborted' || e.code === 'ECONNRESET'
}
