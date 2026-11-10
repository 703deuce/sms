import { normalizeEdits } from '../../../../../../lib/clips/edits'
import { buildNleCaptionsVtt } from '../../../../../../lib/clips/export-nle-captions'
import { jsonError } from '../../../../../../lib/server/api-error'
import { getClipForWorkspace } from '../../../../../../lib/server/clips/clips'
import { loadClipSourceWords } from '../../../../../../lib/server/clips/transcript'
import { resolveWorkspaceId } from '../../../../../../lib/server/workspace'

function jsonNotFound() {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return jsonNotFound()
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const words = await loadClipSourceWords(clip)
    const edits = normalizeEdits(clip.edits, bounds)
    const vtt = buildNleCaptionsVtt(words, edits, bounds)
    return new Response(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Content-Disposition': `attachment; filename="clip.vtt"`,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
