import { normalizeEdits } from '@/lib/clips/edits'
import { buildNleCaptionsVtt } from '@/lib/clips/export-nle-captions'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { loadClipSourceWords } from '@/lib/server/clips/transcript'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const words = await loadClipSourceWords(clip)
    const edits = normalizeEdits(clip.edits, bounds)
    const vtt = buildNleCaptionsVtt(words, edits, bounds)
    return new NextResponse(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Content-Disposition': `attachment; filename="clip.vtt"`,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
