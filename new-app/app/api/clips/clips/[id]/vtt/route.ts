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
  console.info('[captions:vtt] request_begin')
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    console.info('[captions:vtt] clip_load_begin', { clipId: id })
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) {
      console.info('[captions:vtt] clip_not_found', { clipId: id })
      return jsonNotFound()
    }
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    console.info('[captions:vtt] transcript_load_begin', { clipId: id })
    const words = await loadClipSourceWords(clip)
    const edits = normalizeEdits(clip.edits, bounds)
    console.info('[captions:vtt] render_begin', { clipId: id, words: words.length })
    const vtt = buildNleCaptionsVtt(words, edits, bounds)
    console.info('[captions:vtt] request_complete', { clipId: id, bytes: vtt.length })
    return new Response(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Content-Disposition': 'attachment; filename="clip.vtt"',
      },
    })
  } catch (err) {
    console.error('[captions:vtt] request_error', { kind: err instanceof Error ? err.name : typeof err })
    return jsonError(err, 500)
  }
}
