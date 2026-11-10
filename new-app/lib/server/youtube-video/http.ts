import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'

export function youtubeVideoErrorResponse(err: unknown) {
  if (err instanceof YoutubeVideoError) {
    return NextResponse.json({ error: err.message, failureCode: err.code }, { status: err.status })
  }
  return jsonError(err, 500)
}
