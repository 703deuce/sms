import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { createFolder, listFolders } from '@/lib/server/clips/drive-projects'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
})

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const parentId = new URL(request.url).searchParams.get('parentId')
    const folders = await listFolders(workspaceId, parentId === 'null' ? null : parentId)
    return NextResponse.json({ data: { folders } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = createSchema.parse(await request.json())
    const folder = await createFolder(workspaceId, body.name, body.parentId ?? null)
    return NextResponse.json({ data: { folder } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
