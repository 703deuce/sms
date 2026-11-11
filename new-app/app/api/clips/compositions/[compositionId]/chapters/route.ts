import { NextResponse } from 'next/server'
import { scriptEditorOpenAiJson } from '@/lib/server/ai/script-editor-openai'
import { jsonError } from '@/lib/server/api-error'
import { logEditor } from '@/lib/server/clips/script-editor-log'
import { getCompositionAudioContext } from '@/lib/server/clips/composition-audio'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const SYSTEM = `You suggest chapter markers for a podcast/video transcript.
Return JSON {"chapters":[{"outMs":number,"label":string}]}.
The transcript includes [seconds] timestamps on the edited output clock, after cuts and inserts.\nUse those timestamps to choose outMs in output-timeline milliseconds. Do not return all chapters at 0.\nUse 3-8 chapters. Labels are short (2-5 words).`

export async function POST(_request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const ctxAudio = await getCompositionAudioContext(workspaceId, compositionId)
    if (!ctxAudio) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const timedTranscript = ctxAudio.timedKeptWords
      .map((w) => `[${(w.outMs / 1000).toFixed(2)}s] ${w.text}`)
      .join(' ').slice(0, 12000)
    const started = Date.now()
    const result = await scriptEditorOpenAiJson<{ chapters: { outMs: number; label: string }[] }>(
      SYSTEM,
      JSON.stringify({ durationMs: ctxAudio.chapterDurationMs, transcript: timedTranscript }),
    )
    logEditor('chapters', 'ok', { compositionId, count: result.chapters?.length ?? 0, latencyMs: Date.now() - started })
    const chapters = (result.chapters ?? [])
      .map((c) => ({
        outMs: Math.max(0, Math.min(ctxAudio.chapterDurationMs, Math.round(Number(c.outMs) || 0))),
        label: String(c.label || 'Chapter').slice(0, 80),
      }))
      .filter((c, i, arr) => i === 0 || c.outMs > arr[i - 1].outMs)
      .slice(0, 12)

    return NextResponse.json({ data: { chapters } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
