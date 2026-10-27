import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { saveT2vDraft, RevisionConflict } from '@/lib/server/t2v/drafts'

type Ctx = { params: Promise<{ id: string }> } // Next 16: params is a Promise

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params
  const workspaceId = await resolveWorkspaceId()
  const d = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
  if (!d) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ data: d })
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = z.object({ baseRevision: z.number().int(), document: z.any() }).parse(await request.json())
    return NextResponse.json({ data: await saveT2vDraft(workspaceId, id, body.baseRevision, body.document) })
  } catch (err) {
    if (err instanceof RevisionConflict) return NextResponse.json({ error: 'revision_conflict' }, { status: 409 })
    return jsonError(err, 400)
  }
}
