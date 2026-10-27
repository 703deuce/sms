import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import { applyTemplateStyleToDraft } from '@/lib/server/t2v/template-apply'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import type { T2vTemplateStylePatch } from '@/lib/t2v/m9-contracts'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

const bodySchema = z.object({ draftId: z.string().min(1) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const { id: templateId } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const template = await prisma.t2vTemplate.findFirst({
      where: { id: templateId, isPublished: true, OR: [{ workspaceId: null }, { workspaceId }] },
    })
    if (!template) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const draft = await prisma.t2vDraft.findFirst({ where: { id: body.draftId, workspaceId } })
    if (!draft) return NextResponse.json({ error: 'draft_not_found' }, { status: 404 })
    const doc = draft.document as T2vDraftV1
    const patch = template.settings as T2vTemplateStylePatch
    const next = applyTemplateStyleToDraft(doc, patch, templateId)
    const saved = await saveT2vDraft(workspaceId, body.draftId, draft.revision, next)
    return NextResponse.json({ data: saved })
  } catch (err) {
    return jsonError(err, 400)
  }
}
