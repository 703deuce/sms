import { NextResponse } from 'next/server'
import { z } from 'zod'
import { searchSpeech } from '@/lib/clips/editor/speech-search'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { loadSpeechSources } from '@/lib/server/clips/speech-search'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
})

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const input = querySchema.parse({ q: url.searchParams.get('q') ?? '' })
    const loaded = await loadSpeechSources(workspaceId, projectId)
    if (!loaded) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const hits = searchSpeech(loaded.sources, input.q)
    return NextResponse.json({ data: { hits, untranscribed: loaded.untranscribed } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
