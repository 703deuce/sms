import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import {
  createClipProject,
  createClipProjectFromImportUrl,
  createClipProjectFromPrompt,
  listClipProjects,
} from '@/lib/server/clips/projects'
import { serializeProject } from '@/lib/server/clips/serialize'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const data = await listClipProjects(workspaceId, {
      q: url.searchParams.get('q') || undefined,
      status: url.searchParams.get('status') || undefined,
      limit: Number(url.searchParams.get('limit') || 50),
    })
    return NextResponse.json({ data: { projects: data.map(serializeProject) } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

const createSchema = z.union([
  z.object({
    uploadId: z.string().min(1),
    title: z.string().optional(),
    settings: z.unknown().optional(),
  }),
  z.object({
    sourceUrl: z.string().min(8).max(2000),
    title: z.string().optional(),
    settings: z.unknown().optional(),
  }),
  z.object({
    prompt: z.string().min(1).max(2000),
    title: z.string().optional(),
    settings: z.unknown().optional(),
  }),
])

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = createSchema.parse(await request.json())
    const project =
      'prompt' in body
        ? await createClipProjectFromPrompt(workspaceId, body)
        : 'sourceUrl' in body
          ? await createClipProjectFromImportUrl(workspaceId, body)
          : await createClipProject(workspaceId, body)
    return NextResponse.json({ data: serializeProject(project) })
  } catch (err) {
    return jsonError(err, 400)
  }
}
