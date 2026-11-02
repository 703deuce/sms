import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { TEXT_MAX_CHARS } from '@/lib/clips/editor/text-items'
import { TTS_STOCK_VOICES, ttsStockVoice } from '@/lib/clips/tts-voices'
import { ttsWithTimestamps } from '@/lib/server/ai/elevenlabs-tts'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getClipExportUserPrefs } from '@/lib/server/clips/clip-export-user-prefs'
import { applyTtsPronunciation } from '@/lib/clips/tts-pronunciation'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  text: z.string().min(1).max(TEXT_MAX_CHARS),
  voiceId: z.string(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    if (!TTS_STOCK_VOICES.some((v) => v.id === body.voiceId)) {
      return NextResponse.json({ error: 'Invalid voice' }, { status: 400 })
    }
    const voice = ttsStockVoice(body.voiceId)
    if (!voice) return NextResponse.json({ error: 'Invalid voice' }, { status: 400 })

    const prefs = await getClipExportUserPrefs(workspaceId, await resolveInternalUserId())
    const spoken = applyTtsPronunciation(body.text.trim(), prefs.vocabulary)

    const { audio } = await ttsWithTimestamps({ text: spoken, voice })
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('elevenlabs')) {
      return NextResponse.json({ error: 'tts_failed' }, { status: 502 })
    }
    return jsonError(err, 400)
  }
}
