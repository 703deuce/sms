import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { listClipRenders } from '@/lib/server/clips/renders'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const q = (url.searchParams.get('status') || 'all').toLowerCase()
    const exports = await listClipRenders(workspaceId, q as 'all' | 'ready' | 'failed')
    return NextResponse.json({ data: { exports } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
