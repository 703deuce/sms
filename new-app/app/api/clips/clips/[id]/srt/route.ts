import { NextResponse } from 'next/server'
import { buildSrtFromCaptionWords, normalizeEdits } from '@/lib/clips/edits'
import { buildCaptionWords } from '@/lib/clips/caption-words'
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
    const srt = buildSrtFromCaptionWords(buildCaptionWords(words, edits))
    return new NextResponse(srt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="clip.srt"`,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
