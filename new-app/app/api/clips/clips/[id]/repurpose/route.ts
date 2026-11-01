import { NextResponse } from 'next/server'
import { z } from 'zod'
import { editsVersionHash, normalizeEdits, outputDurationMs } from '@/lib/clips/edits'
import { buildTimestampedLines, normalizeChapters, normalizeShowNotes } from '@/lib/clips/repurpose'
import { jsonError } from '@/lib/server/api-error'
import { getClipEditorWords } from '@/lib/server/clips/clip-detail'
import { clipBoundsForPatch } from '@/lib/server/clips/clip-patch-bounds'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { scriptEditorOpenAiJson } from '@/lib/server/ai/script-editor-openai'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

const bodySchema = z.object({
  kind: z.enum(['chapters', 'show_notes']),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const bounds = await clipBoundsForPatch(clip)
    const edits = normalizeEdits(clip.edits, bounds)
    const lengthMs = outputDurationMs(edits)
    if (lengthMs < 120_000) {
      return NextResponse.json({ error: 'Chapters need at least 2 minutes' }, { status: 422 })
    }

    const wordsPayload = await getClipEditorWords(workspaceId, clipId)
    const words = wordsPayload?.words ?? []
    if (!words.length) {
      return NextResponse.json({ error: 'No transcript available' }, { status: 422 })
    }

    const lines = buildTimestampedLines(words, edits)
    const transcript = lines.map((l) => `[${Math.floor(l.outMs / 60000)}:${String(Math.floor((l.outMs / 1000) % 60)).padStart(2, '0')}] ${l.text}`).join('\n')

    const hash = editsVersionHash(edits)
    let result: unknown
    let model = 'gpt-4o-mini'

    if (body.kind === 'chapters') {
      const raw = await scriptEditorOpenAiJson<{ chapters: { line: number; label: string }[] }>(
        'Return JSON {chapters:[{line:number,label:string}]}. line is the index in the numbered transcript lines (0-based).',
        transcript.slice(0, 120_000),
      )
      const norm = normalizeChapters(raw, lines, lengthMs)
      if ('error' in norm) return NextResponse.json({ error: norm.error }, { status: 422 })
      result = norm
    } else {
      const raw = await scriptEditorOpenAiJson<{ summary: string; bullets: string[] }>(
        'Return JSON {summary: string (2-3 sentences), bullets: string[3-7]}.',
        transcript.slice(0, 120_000),
      )
      result = { showNotes: normalizeShowNotes(raw) }
    }

    const prisma = getPrisma()
    const prev = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as Record<string, unknown>
    const repurpose = {
      ...(typeof prev.repurpose === 'object' && prev.repurpose ? prev.repurpose : {}),
      ...(body.kind === 'chapters' ? { chapters: (result as { chapters: unknown }).chapters } : {}),
      ...(body.kind === 'show_notes' ? { showNotes: (result as { showNotes: unknown }).showNotes } : {}),
      editsHash: hash,
      generatedAt: new Date().toISOString(),
      model,
    }
    await prisma.clip.update({
      where: { id: clipId },
      data: { aiMeta: toPrismaJson({ ...prev, repurpose }) },
    })

    return NextResponse.json({ data: { ...result, editsHash: hash } })
  } catch (e) {
    return jsonError(e, 400)
  }
}
