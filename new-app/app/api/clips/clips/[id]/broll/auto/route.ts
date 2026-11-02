import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'
import { jsonError } from '@/lib/server/api-error'
import { mergeAutoBrollItems } from '@/lib/clips/broll-auto-utils'
import { filterAutoBrollSuggestions } from '@/lib/clips/editor/broll-approve-first'
import { buildAutoBrollItems } from '@/lib/server/clips/broll-auto'
import { resolveBrollMedia } from '@/lib/server/clips/broll-media'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  /** Q6.5: return suggestions only — nothing written until the editor accepts. */
  suggestOnly: z.boolean().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let suggestOnly = true
    try {
      const raw = await request.json()
      suggestOnly = bodySchema.parse(raw).suggestOnly !== false
    } catch {
      suggestOnly = true
    }

    const prisma = getPrisma()
    const project = await prisma.clipProject.findUnique({ where: { id: clip.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const storage = getClipStorage()
    let transcript: ClipWord[] = normalizeTranscriptJson(project.transcriptWords)
    if (project.transcriptKey) {
      try {
        const fromKey = normalizeTranscriptJson(await storage.getJson(project.transcriptKey))
        if (fromKey.length) transcript = fromKey
      } catch {
        /* fall back to transcriptWords */
      }
    }
    const words = loadSourceWords(transcript)
    const {
      items: rawItems,
      attempted,
      placed,
      queriesUsed,
      rawCount,
      dropReasons,
      providerError,
    } = await buildAutoBrollItems(edits, words, {
      clipTitle: clip.title,
      deferStockCache: suggestOnly,
    })
    const filtered = filterAutoBrollSuggestions(edits.broll || [], rawItems)
    const items = filtered.accepted
    if (!items.length) {
      return NextResponse.json({
        data: {
          items,
          attempted,
          placed: 0,
          queriesUsed,
          rawCount,
          dropReasons,
          providerError,
          rejected: filtered.rejected,
          message: providerError
            ? providerError
            : filtered.rejected.length
              ? 'All suggestions blocked (same asset within 60 s or no matches).'
              : rawCount > 0 && dropReasons.length
                ? 'No placements passed transcript checks — try manual search.'
                : 'No stock B-roll placements matched this clip (try manual search).',
        },
      })
    }

    if (suggestOnly) {
      const media = await resolveBrollMedia(items, { materializeStock: false })
      return NextResponse.json({
        data: {
          items,
          attempted,
          placed: items.length,
          queriesUsed,
          rawCount,
          dropReasons,
          providerError,
          rejected: filtered.rejected,
          media,
          suggestOnly: true,
        },
      })
    }

    const mergedBroll = mergeAutoBrollItems(edits.broll || [], items)
    await prisma.clip.update({
      where: { id: clipId },
      data: { edits: { ...edits, broll: mergedBroll } as object },
    })

    const media = await resolveBrollMedia(items)
    return NextResponse.json({
      data: { items, mergedBroll, media, count: items.length, attempted, placed, queriesUsed },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
