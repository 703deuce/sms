import { NextResponse } from 'next/server'
import { cheapSuggestedHeadline } from '@/lib/clips/export-template'
import { normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { persistExportTemplate } from '@/lib/server/clips/export-headline'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** Rule-based headline hint when clip preview is ready (no LLM). */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip?.previewKey) return NextResponse.json({ error: 'Not ready' }, { status: 409 })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    if (edits.exportTemplate?.suggestedHeadline) {
      return NextResponse.json({ data: { exportTemplate: edits.exportTemplate, skipped: true } })
    }
    const suggested = cheapSuggestedHeadline({ title: clip.title, aiMeta: clip.aiMeta })
    const saved = await persistExportTemplate(clipId, bounds, { suggestedHeadline: suggested }, clip.edits)
    return NextResponse.json({ data: { exportTemplate: saved.exportTemplate } })
  } catch (e) {
    return jsonError(e, 400)
  }
}
