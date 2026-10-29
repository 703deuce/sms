import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipEditorWords } from '@/lib/server/clips/clip-detail'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const trimInMs = Number(url.searchParams.get('trimInMs'))
    const trimOutMs = Number(url.searchParams.get('trimOutMs'))
    const opts =
      Number.isFinite(trimInMs) && Number.isFinite(trimOutMs)
        ? { trimInMs, trimOutMs }
        : undefined
    const data = await getClipEditorWords(workspaceId, id, opts)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    return jsonError(err, 500)
  }
}
