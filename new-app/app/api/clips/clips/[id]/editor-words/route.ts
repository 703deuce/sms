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
    if (
      url.searchParams.has('trimInMs') &&
      url.searchParams.has('trimOutMs') &&
      Number.isFinite(trimInMs) &&
      Number.isFinite(trimOutMs) &&
      trimOutMs > trimInMs
    ) {
      opts.trimInMs = trimInMs
      opts.trimOutMs = trimOutMs
    }
    if (url.searchParams.has('contextMs') && Number.isFinite(contextMs) && contextMs >= 0) opts.contextMs = contextMs
    const data = await getClipEditorWords(workspaceId, id, Object.keys(opts).length ? opts : undefined)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // clipsFetch unwraps the standard { data } envelope; returning data bare strands the editor with no words.
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}
