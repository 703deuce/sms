import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { createT2vDraft } from '@/lib/server/t2v/drafts'
import { defaultT2vDraft } from '@/lib/t2v/defaults'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

const createSchema = z.object({
  sourceKind: z.enum(['prompt', 'script', 'url', 'blog', 'ppt', 'audio']),
  text: z.string().max(100_000).default(''),
  url: z.string().url().optional(),
  uploadId: z.string().optional(),
  templateId: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = createSchema.parse(await request.json())
    const doc = defaultT2vDraft(body)
    if (body.templateId) doc.settings.templateId = body.templateId
    const draft = await createT2vDraft(workspaceId, doc)
    return NextResponse.json({
      data: { id: draft.id, projectId: draft.projectId, revision: draft.revision },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function GET() {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const rows = await getPrisma().t2vDraft.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, projectId: true, status: true, progress: true, updatedAt: true },
    })
    return NextResponse.json({ data: { drafts: rows } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
