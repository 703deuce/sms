import { NextResponse } from 'next/server'
import { normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { generateExportHeadline, persistExportTemplatePatch } from '@/lib/server/clips/export-headline'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const result = await generateExportHeadline({
      workspaceId,
      clipId,
      projectId: clip.projectId,
      title: clip.title,
      startMs: clip.startMs,
      endMs: clip.endMs,
      edits,
      aiMeta: clip.aiMeta as Record<string, unknown> | null,
    })
    const saved = await persistExportTemplatePatch(
      clipId,
      bounds,
      result.exportTemplate,
      clip.edits,
      clip.projectId,
    )
    return NextResponse.json({
      data: {
        headline: result.headline,
        generations: result.generations,
        exportTemplate: saved.exportTemplate,
      },
    })
  } catch (e) {
    return jsonError(e, 400)
  }
}
