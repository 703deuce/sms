import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { listVoices } from '@/lib/server/ai/elevenlabs-tts'
import { listVoicesCached } from '@/lib/server/t2v/voices-cache'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function GET(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const search = url.searchParams.get('search') ?? undefined
    let voices
    let nextPageToken: string | null = null
    if (search) {
      const listed = await listVoices({ search })
      voices = listed.voices
      nextPageToken = listed.nextPageToken
    } else {
      voices = await listVoicesCached()
    }
    const saved = await getPrisma().t2vSavedVoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const defaultRow = saved.find((s) => (s.labels as { role?: string } | null)?.role === 'default')
    return NextResponse.json({
      data: { voices, saved, nextPageToken, defaultVoiceId: defaultRow?.voiceId ?? null },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
