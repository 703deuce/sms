import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { createClipUpload } from '@/lib/server/clips/uploads'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  filename: z.string().min(1).max(500),
  bytes: z.number().int().positive(),
  mime: z.string().min(1),
})

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const created = await createClipUpload(workspaceId, body)
    return NextResponse.json({
      data: {
        uploadId: created.uploadId,
        key: created.key,
        storage: created.storage,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
