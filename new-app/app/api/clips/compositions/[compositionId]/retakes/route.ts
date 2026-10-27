import { NextResponse } from 'next/server'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionAudioContext } from '@/lib/server/clips/composition-audio'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const SYSTEM = `You find repeated takes / false starts in a podcast or interview transcript.
Return JSON {"ranges":[{"startMs":number,"endMs":number,"reason":string,"wordIds":string[]}]}.
Only include ranges you are confident are duplicate retakes (speaker restarts the same line). startMs/endMs are source milliseconds from the word list. wordIds must be ids from the input. Max 12 ranges.`

export async function POST(_request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const ctxAudio = await getCompositionAudioContext(workspaceId, compositionId)
    if (!ctxAudio) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rows = ctxAudio.keptWords.map((w) => ({
      id: w.id,
      t0Ms: w.t0Ms,
      t1Ms: w.t1Ms,
      text: w.text,
    }))

    const result = await openAiJsonResponse<{
      ranges: { startMs: number; endMs: number; reason: string; wordIds: string[] }[]
    }>(SYSTEM, JSON.stringify({ words: rows.slice(0, 2000) }))

    const validIds = new Set(rows.map((w) => w.id))
    const ranges = (result.ranges ?? [])
      .map((r) => ({
        startMs: Math.round(r.startMs),
        endMs: Math.round(r.endMs),
        reason: String(r.reason || 'Retake').slice(0, 200),
        wordIds: (r.wordIds ?? []).filter((id) => validIds.has(id)),
      }))
      .filter((r) => r.wordIds.length > 0 && r.endMs > r.startMs)
      .slice(0, 12)

    return NextResponse.json({ data: { ranges } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
