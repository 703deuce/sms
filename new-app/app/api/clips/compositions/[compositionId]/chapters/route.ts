import { NextResponse } from 'next/server'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionAudioContext } from '@/lib/server/clips/composition-audio'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const SYSTEM = `You suggest chapter markers for a podcast/video transcript.
Return JSON {"chapters":[{"outMs":number,"label":string}]}.
outMs is output-timeline milliseconds (monotonic, 0 at start). Use 3-8 chapters. Labels are short (2-5 words).`

export async function POST(_request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const ctxAudio = await getCompositionAudioContext(workspaceId, compositionId)
    if (!ctxAudio) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const text = ctxAudio.keptWords.map((w) => w.text).join(' ').slice(0, 12000)
    const result = await openAiJsonResponse<{ chapters: { outMs: number; label: string }[] }>(
      SYSTEM,
      JSON.stringify({ durationMs: ctxAudio.lengthMs, transcript: text }),
    )
    const chapters = (result.chapters ?? [])
      .map((c) => ({
        outMs: Math.max(0, Math.round(c.outMs)),
        label: String(c.label || 'Chapter').slice(0, 80),
      }))
      .filter((c, i, arr) => i === 0 || c.outMs > arr[i - 1].outMs)
      .slice(0, 12)

    return NextResponse.json({ data: { chapters } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
