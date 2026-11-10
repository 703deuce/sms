import { NextResponse } from 'next/server'
import { isStudioError } from './errors'

export function studioJsonError(err: unknown, fallbackStatus = 500) {
  if (isStudioError(err)) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus })
  }
  const authStatus =
    err && typeof err === 'object' && 'status' in err && typeof (err as { status?: number }).status === 'number'
      ? (err as { status: number }).status
      : null
  if (authStatus === 401 || authStatus === 403) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: authStatus })
  }
  const message = err instanceof Error ? err.message : 'Request failed'
  return NextResponse.json({ error: message, code: 'STORAGE_ERROR' }, { status: fallbackStatus })
}
