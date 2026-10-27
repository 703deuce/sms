import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { listT2vMusicLibrary } from '@/lib/server/t2v/music'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function GET() {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const tracks = await listT2vMusicLibrary()
    return NextResponse.json({ data: { tracks } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
