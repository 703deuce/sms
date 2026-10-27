import { NextResponse } from 'next/server'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionAudioContext } from '@/lib/server/clips/composition-audio'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const SYSTEM = `You edit a spoken transcript for clarity (remove filler phrasing, tighten wording).
Return JSON {"edits":[{"wordId":string,"text":string}]}.
Only change words that benefit from rewording; keep meaning. wordId must be from input. Max 40 edits. Do not merge or split words.`

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const body = (await request.json().catch(() => ({}))) as { intensity?: string }
    const intensity = body.intensity === 'heavy' ? 'heavy' : body.intensity === 'low' ? 'low' : 'medium'
    const workspaceId = await resolveWorkspaceId()
    const ctxAudio = await getCompositionAudioContext(workspaceId, compositionId)
    if (!ctxAudio) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rows = ctxAudio.keptWords.map((w) => ({
      id: w.id,
      text: w.text,
    }))

    const result = await openAiJsonResponse<{ edits: { wordId: string; text: string }[] }>(
      `${SYSTEM}\nIntensity: ${intensity}.`,
      JSON.stringify({ words: rows.slice(0, 2500) }),
    )

    const valid = new Set(rows.map((w) => w.id))
    const edits = (result.edits ?? [])
      .map((e) => ({
        wordId: String(e.wordId),
        text: String(e.text || '').trim().slice(0, 120),
      }))
      .filter((e) => valid.has(e.wordId) && e.text.length > 0)
      .slice(0, 40)

    return NextResponse.json({ data: { edits } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
