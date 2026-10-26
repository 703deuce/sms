import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'

const bodySchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    await getScriptForOwner(id, actor.id)
    const body = bodySchema.parse(await request.json())
    const key = process.env.ELEVENLABS_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 503 })
    }
    const voice = body.voiceId || process.env.SW_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: body.text,
        model_id: 'eleven_multilingual_v2',
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err.slice(0, 500) }, { status: 502 })
    }
    const audio = Buffer.from(await res.arrayBuffer())
    return new NextResponse(audio, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
