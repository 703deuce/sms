import { NextResponse } from 'next/server'
import { AdStudioError } from '@/lib/ad-studio/errors'

export function adStudioJsonError(err: unknown) {
  const error = err instanceof AdStudioError ? err : new AdStudioError('STORAGE_ERROR','Ad Studio could not complete the request.',500)
  console.error('[ad-studio:api] request_failed', { code: error.code, status: error.status, type: err instanceof Error ? err.name : typeof err })
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
}
