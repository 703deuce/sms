import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

/** Delete a workspace voice clone — ElevenLabs DELETE implemented by Agent B. */
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
    await prisma.t2vSavedVoice.delete({ where: { id: row.id } })
    return NextResponse.json({
      data: { deleted: true, pendingProviderDelete: true },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
