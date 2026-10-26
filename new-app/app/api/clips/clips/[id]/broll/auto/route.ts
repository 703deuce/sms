import { NextResponse } from 'next/server'
import { normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { jsonError } from '@/lib/server/api-error'
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
    const aiMeta = (clip.aiMeta || {}) as { brollIdeas?: string[] }
    const { items, attempted, placed } = await buildAutoBrollItems(edits, words, aiMeta.brollIdeas || [])
    if (!items.length) {
      return NextResponse.json({
        data: {
          items,
          attempted,
          placed,
          message: 'No stock B-roll placements matched this clip (try manual search).',
        },
      })
    }

    const media = await resolveBrollMedia(items)
    return NextResponse.json({ data: { items, media, count: items.length, attempted, placed } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
