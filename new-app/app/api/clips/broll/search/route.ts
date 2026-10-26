import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { searchVideos } from '@/lib/server/ai/pixabay'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  try {
    await resolveWorkspaceId()
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim() || ''
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    if (!q) return NextResponse.json({ data: { hits: [] } })
    const hits = await searchVideos(q, page)
    return NextResponse.json({ data: { hits } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
