import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { searchStockAudioServer } from '@/lib/server/ai/stock-audio'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  try {
    await resolveWorkspaceId()
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const kind = url.searchParams.get('kind')
    const mood = url.searchParams.get('mood')?.trim() || undefined
    const genre = url.searchParams.get('genre')?.trim() || undefined
    const parsedKind = kind === 'music' || kind === 'sfx' ? kind : undefined
    const data = await searchStockAudioServer({ q, kind: parsedKind, mood, genre })
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}
