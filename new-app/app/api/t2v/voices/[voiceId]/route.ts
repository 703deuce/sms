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
      await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': key },
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      // still remove workspace row if provider delete fails
    }
    await prisma.t2vSavedVoice.delete({ where: { id: row.id } })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
