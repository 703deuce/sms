import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { listVoices } from '@/lib/server/ai/elevenlabs-tts'
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
    const { voices, nextPageToken } = await listVoices({ search })
    const saved = await getPrisma().t2vSavedVoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ data: { voices, saved, nextPageToken } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
