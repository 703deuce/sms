import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { enqueueT2vAssemble, saveT2vDraft } from '@/lib/server/t2v/drafts'
import { applyT2vProducerTools } from '@/lib/server/t2v/producer-tools'
import { runT2vProducerTurn } from '@/lib/server/t2v/producer-run'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'
import type { T2vDraftV1 } from '@/lib/t2v/types'

const bodySchema = z.object({ message: z.string().min(1).max(4000) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const row = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const doc = row.document as T2vDraftV1
    const voiceRows = await getPrisma().t2vSavedVoice.findMany({
      where: { workspaceId },
      take: 24,
      select: { name: true, voiceId: true },
    })
    const voiceCatalog = voiceRows.map((v) => `${v.name}=${v.voiceId}`).join(', ')
    const turn = await runT2vProducerTurn({ document: doc, userMessage: body.message, voiceCatalog })
    const fresh = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
    if (!fresh) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const applied = await applyT2vProducerTools(fresh.document as T2vDraftV1, turn.tools, { workspaceId })
    const saved = await saveT2vDraft(workspaceId, id, fresh.revision, applied.document)
    let jobId: string | null = null
    if (applied.requestRebuild) {
      const enq = await enqueueT2vAssemble(workspaceId, id)
      jobId = enq.jobId
    }
    return NextResponse.json({
      data: {
        reply: turn.reply,
        summaries: applied.summaries,
        revision: saved.revision,
        document: saved.document,
        requestRebuild: applied.requestRebuild,
        jobId,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
