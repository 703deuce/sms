import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { recordClipUploadPart } from '@/lib/server/clips/uploads'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  partNumber: z.number().int().positive(),
  etag: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const data = await recordClipUploadPart(workspaceId, id, body.partNumber, body.etag, body.sizeBytes)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}
