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
    const contextMs = Number(url.searchParams.get('contextMs'))
    const opts: { trimInMs?: number; trimOutMs?: number; contextMs?: number } = {}
    if (Number.isFinite(trimInMs) && Number.isFinite(trimOutMs)) {
      opts.trimInMs = trimInMs
      opts.trimOutMs = trimOutMs
    }
    if (Number.isFinite(contextMs)) opts.contextMs = contextMs
    const data = await getClipEditorWords(workspaceId, id, Object.keys(opts).length ? opts : undefined)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    return jsonError(err, 500)
  }
}
