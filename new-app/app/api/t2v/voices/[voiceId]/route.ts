import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getElevenLabsApiKey } from '@/lib/server/ai/elevenlabs'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

/** Delete a workspace voice clone (DB + ElevenLabs provider). */
export async function DELETE(_: Request, { params }: { params: Promise<{ voiceId: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const { voiceId } = await params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const row = await prisma.t2vSavedVoice.findFirst({
      where: { workspaceId, voiceId, isClone: true },
    })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    try {
      const key = getElevenLabsApiKey()
      const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': key },
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => '')
        throw new Error(text.slice(0, 200) || `elevenlabs_delete_${res.status}`)
      }
    } catch (err) {
      return jsonError(err instanceof Error ? err : new Error('provider_delete_failed'), 502)
    }
    const saved = await prisma.t2vSavedVoice.findMany({ where: { workspaceId } })
    for (const r of saved) {
      const labels = (r.labels ?? {}) as Record<string, unknown>
      if (r.voiceId === voiceId && labels.role === 'default') {
        await prisma.t2vSavedVoice.update({
          where: { id: r.id },
          data: { labels: { ...labels, role: undefined } },
        })
      }
    }
    await prisma.t2vSavedVoice.delete({ where: { id: row.id } })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
