import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { AiCaptionsError } from '@/lib/ai-captions/errors'

export function aiCaptionsErrorResponse(err: unknown) {
  if (err instanceof AiCaptionsError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  return jsonError(err, 500)
}
