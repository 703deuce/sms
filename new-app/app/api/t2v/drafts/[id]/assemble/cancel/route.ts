import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const draft = await prisma.t2vDraft.findFirst({ where: { id, workspaceId } })
    if (!draft) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    await prisma.$transaction([
      prisma.clipJob.updateMany({
        where: {
          projectId: draft.projectId,
          type: 'T2V_ASSEMBLE',
          status: { in: ['QUEUED', 'RUNNING'] },
        },
        data: { status: 'FAILED', error: 'Canceled by user', finishedAt: new Date() },
      }),
      prisma.t2vDraft.update({
        where: { id },
        data: { status: 'DRAFT', stage: 'canceled', progress: 0, error: null },
      }),
    ])
    return NextResponse.json({ data: { canceled: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
