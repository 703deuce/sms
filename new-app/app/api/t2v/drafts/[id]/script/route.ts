import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import { writeScript } from '@/lib/server/t2v/script-llm'
import { scenesFromLlm, sourceTextOf } from '@/lib/t2v/defaults'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const { id } = await params
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = z.object({ instruction: z.string().optional() }).parse(await request.json().catch(() => ({})))
    const d = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
    if (!d) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const doc = d.document as T2vDraftV1
    const sourceText = (await sourceTextOf(doc.source)) + (body.instruction ? `\n\nInstruction: ${body.instruction}` : '')
    const out = await writeScript({ sourceKind: doc.source.kind, sourceText, settings: doc.settings })
    const next: T2vDraftV1 = {
      ...doc,
      title: doc.title || out.title,
      scenes: scenesFromLlm(out.scenes, doc),
      nextSlot: out.scenes.length,
    }
    return NextResponse.json({ data: await saveT2vDraft(workspaceId, id, d.revision, next) })
  } catch (err) {
    return jsonError(err, 400)
  }
}
