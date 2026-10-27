import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { moveProjectsToFolder, restoreProjects, softDeleteProjects } from '@/lib/server/clips/drive-projects'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  projectIds: z.array(z.string().min(1)).min(1),
  action: z.enum(['move', 'trash', 'restore']),
  folderId: z.string().nullable().optional(),
})

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    if (body.action === 'move') {
      await moveProjectsToFolder(workspaceId, body.projectIds, body.folderId ?? null)
    } else if (body.action === 'trash') {
      await softDeleteProjects(workspaceId, body.projectIds)
    } else {
      await restoreProjects(workspaceId, body.projectIds)
    }
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
