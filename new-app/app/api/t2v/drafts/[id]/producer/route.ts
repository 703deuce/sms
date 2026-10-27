import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { enqueueT2vAssemble, saveT2vDraft } from '@/lib/server/t2v/drafts'
import { applyT2vProducerTools, type T2vProducerToolCall } from '@/lib/server/t2v/producer-tools'
import { runT2vProducerTurn } from '@/lib/server/t2v/producer-run'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'
import { listVoices } from '@/lib/server/ai/elevenlabs-tts'
import { createId } from '@/lib/supabase/id'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import type { Prisma } from '@prisma/client'

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  confirmDestructive: z.boolean().optional(),
  proposalId: z.string().min(1).optional(),
})

const DESTRUCTIVE_TOOLS = new Set(['delete_scene', 'shorten_to'])

type ProducerProposal = {
  id: string
  message: string
  reply: string
  tools: T2vProducerToolCall[]
}

function isDestructiveTool(t: T2vProducerToolCall): boolean {
  if (t.name === 'delete_scene') return true
  if (t.name === 'shorten_to') {
    const sec = Number(t.args.seconds ?? t.args.durationS ?? 0)
    return sec > 0
  }
  return false
}

function parseProposal(raw: unknown): ProducerProposal | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string' || typeof p.message !== 'string' || typeof p.reply !== 'string') return null
  if (!Array.isArray(p.tools)) return null
  return { id: p.id, message: p.message, reply: p.reply, tools: p.tools as T2vProducerToolCall[] }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    let row = await prisma.t2vDraft.findFirst({ where: { id, workspaceId } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    if (body.proposalId || body.confirmDestructive) {
      const proposal = parseProposal(row.producerProposal)
      if (!proposal) return NextResponse.json({ error: 'no_pending_proposal' }, { status: 400 })
      if (body.proposalId && body.proposalId !== proposal.id) {
        return NextResponse.json({ error: 'proposal_mismatch' }, { status: 409 })
      }
      const applied = await applyT2vProducerTools(row.document as T2vDraftV1, proposal.tools, { workspaceId })
      const saved = await saveT2vDraft(workspaceId, id, row.revision, applied.document)
      await prisma.t2vDraft.update({
        where: { id },
        data: { producerProposal: null },
      })
      let jobId: string | null = null
      if (applied.requestRebuild) {
        const enq = await enqueueT2vAssemble(workspaceId, id)
        jobId = enq.jobId
      }
      return NextResponse.json({
        data: {
          reply: proposal.reply,
          summaries: applied.summaries,
          revision: saved.revision,
          document: saved.document,
          requestRebuild: applied.requestRebuild,
          jobId,
        },
      })
    }

    const doc = row.document as T2vDraftV1
    const savedVoices = await getPrisma().t2vSavedVoice.findMany({
      where: { workspaceId },
      take: 50,
      select: { name: true, voiceId: true },
    })
    let libraryVoices: Array<{ name: string; voiceId: string }> = []
    try {
      const listed = await listVoices({ search: undefined })
      libraryVoices = listed.voices
    } catch {
      /* continue with saved voices only */
    }
    const voiceCatalog = [
      ...savedVoices.map((v) => `${v.name}=${v.voiceId}`),
      ...libraryVoices.map((v) => `${v.name}=${v.voiceId}`),
    ].join(', ')
    const turn = await runT2vProducerTurn({ document: doc, userMessage: body.message, voiceCatalog })
    const destructive = turn.tools.filter(isDestructiveTool)
    if (destructive.length) {
      const proposalId = createId('t2vprop')
      const proposal: ProducerProposal = {
        id: proposalId,
        message: body.message,
        reply: turn.reply,
        tools: turn.tools,
      }
      await prisma.t2vDraft.update({
        where: { id },
        data: { producerProposal: proposal as Prisma.InputJsonValue },
      })
      return NextResponse.json({
        data: {
          needsConfirm: true,
          proposalId,
          reply: turn.reply,
          destructiveTools: destructive.map((t) => t.name),
          message: 'This will remove scenes or shorten the script. Confirm to apply.',
        },
      })
    }
    const fresh = await prisma.t2vDraft.findFirst({ where: { id, workspaceId } })
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
