import { NextResponse } from 'next/server'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'

export function motionStudioJsonError(err: unknown) {
  const error = err instanceof MotionStudioError ? err : new MotionStudioError('INTERNAL', 'Motion Studio could not complete the request.', 500)
  console.error('[motion-studio:api] request_failed', {
    code: error.code, status: error.status, type: err instanceof Error ? err.name : typeof err,
    detail: err instanceof MotionStudioError ? undefined : err instanceof Error ? err.message.slice(0, 200) : undefined,
  })
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
}
