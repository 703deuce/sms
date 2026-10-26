import { NextResponse } from 'next/server'
import { buildSrt, normalizeEdits, wordsAfterEdits, type ClipWord } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip?.wordsKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const storage = getClipStorage()
    const words = await storage.getJson<ClipWord[]>(clip.wordsKey)
    const durationMs = clip.endMs - clip.startMs
    const edits = normalizeEdits(clip.edits, durationMs)
    const { words: remapped } = wordsAfterEdits(words, edits)
    const srt = buildSrt(remapped)
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
