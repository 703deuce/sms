import { NextResponse } from 'next/server'
import { normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { jsonError } from '@/lib/server/api-error'
import { mergeAutoBrollItems } from '@/lib/clips/broll-auto-utils'
import { buildAutoBrollItems } from '@/lib/server/clips/broll-auto'
import { resolveBrollMedia } from '@/lib/server/clips/broll-media'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const prisma = getPrisma()
    const project = await prisma.clipProject.findUnique({ where: { id: clip.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const storage = getClipStorage()
    let transcript: ClipWord[] = []
    if (project.transcriptKey) {
      try {
        transcript = await storage.getJson<ClipWord[]>(project.transcriptKey)
      } catch {
        transcript = []
      }
    }
    const words = loadSourceWords(transcript)
    const { items, attempted, placed, queriesUsed } = await buildAutoBrollItems(edits, words, {
      clipTitle: clip.title,
    })
    if (!items.length) {
      return NextResponse.json({
        data: {
          items,
          attempted,
          placed,
          queriesUsed,
          message: 'No stock B-roll placements matched this clip (try manual search).',
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
