import { NextResponse } from 'next/server'
import { clipWhySummary, type ClipAiMeta } from '@/lib/clips/clip-results-chips'
import { generateClipPostCopy } from '@/lib/server/clips/clips-copy-llm'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { loadClipSourceWords } from '@/lib/server/clips/transcript'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

function wordsToTranscript(words: { w: string }[]): string {
  return words.map((x) => x.w).join(' ').trim()
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let summaryHint: string | undefined
    try {
      const raw = await request.json()
      if (raw && typeof raw === 'object' && typeof (raw as { summaryHint?: string }).summaryHint === 'string') {
        summaryHint = (raw as { summaryHint: string }).summaryHint.slice(0, 6000)
      }
    } catch {
      /* empty body ok */
    }

    const words = await loadClipSourceWords(clip)
    const transcript = wordsToTranscript(words)
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript available for this clip' }, { status: 422 })
    }

    const aiMeta = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as ClipAiMeta
    const bundle = await generateClipPostCopy({
      workspaceId,
      clipId: clip.id,
      projectId: clip.projectId,
      title: clip.title,
      hook: aiMeta.hook,
      why: clipWhySummary(aiMeta) ?? undefined,
      transcript:
        summaryHint && (clip.endMs - clip.startMs) / 1000 > 180
          ? `${summaryHint}\n\n${transcript.slice(0, 6000)}`
          : transcript,
      durationSec: (clip.endMs - clip.startMs) / 1000,
    })

    const prisma = getPrisma()
    const prev = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as Record<string, unknown>
    const nextMeta = {
      ...prev,
      postCopy: {
        hookText: bundle.hookText,
        platforms: bundle.platforms,
        generatedAt: new Date().toISOString(),
        provider: bundle.provider,
        model: bundle.model,
        costUsdMicros: bundle.costUsdMicros,
      },
    }
    await prisma.clip.update({
      where: { id: clip.id },
      data: { aiMeta: nextMeta },
    })

    return NextResponse.json({ data: bundle })
  } catch (e) {
    return jsonError(e)
  }
}
