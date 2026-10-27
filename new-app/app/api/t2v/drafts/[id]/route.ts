import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { RevisionConflict, saveT2vDraft } from '@/lib/server/t2v/drafts'
import { parseAndSanitizeT2vDraft } from '@/lib/server/t2v/validate-document'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'
import { getClipStorage } from '@/lib/storage'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Ctx) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const { id } = await params
  const workspaceId = await resolveWorkspaceId()
  const d = await getPrisma().t2vDraft.findFirst({
    where: { id, workspaceId },
    include: { project: { select: { uploadId: true } } },
  })
  if (!d) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  let builtVideoUrl: string | null = null
  if (d.project?.uploadId) {
    const upl = await getPrisma().clipUpload.findFirst({
      where: { id: d.project.uploadId, workspaceId },
      select: { key: true },
    })
    if (upl?.key) {
      try {
        builtVideoUrl = await getClipStorage().createSignedDownloadUrl(upl.key, 3600)
      } catch {
        builtVideoUrl = null
      }
    }
  }
  return NextResponse.json({ data: { ...d, builtVideoUrl } })
}

export async function PATCH(request: Request, { params }: Ctx) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const { id } = await params
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = z.object({ baseRevision: z.number().int(), document: z.unknown() }).parse(await request.json())
    const document = await parseAndSanitizeT2vDraft(workspaceId, body.document)
    return NextResponse.json({
      data: await saveT2vDraft(workspaceId, id, body.baseRevision, document),
    })
  } catch (err) {
    if (err instanceof RevisionConflict) {
      return NextResponse.json({ error: 'revision_conflict' }, { status: 409 })
    }
    return jsonError(err, 400)
  }
}
