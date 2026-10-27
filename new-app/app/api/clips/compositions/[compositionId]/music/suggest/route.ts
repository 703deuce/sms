import { NextResponse } from 'next/server'
import { stripArtistSongNames } from '@/lib/clips/audio'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionAudioContext } from '@/lib/server/clips/composition-audio'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const SYSTEM = `You suggest instrumental background music for a short social video clip.
Return JSON {"prompt":string,"mood":string,"bpmHint":number}.
Rules: no artist, song or label names; describe genre, instruments, energy and tempo only; keep prompt under 80 words; instrumental only.`

export async function POST(_request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const ctxAudio = await getCompositionAudioContext(workspaceId, compositionId)
    if (!ctxAudio) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result = await openAiJsonResponse<{ prompt: string; mood: string; bpmHint: number }>(
      SYSTEM,
      `Transcript:\n${ctxAudio.transcriptText || '(no words)'}`,
    )
    const prompt = stripArtistSongNames(String(result.prompt || '').slice(0, 500))
    return NextResponse.json({
      data: {
        prompt,
        mood: String(result.mood || 'neutral'),
        bpmHint: Number(result.bpmHint) || 90,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
