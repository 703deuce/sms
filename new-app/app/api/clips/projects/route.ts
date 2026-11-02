import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { clipperLog } from '@/lib/server/clips/clipper-log'
import {
  createBlankClipProject,
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
      includeSettingsAndWords: true,
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
  // G1b3: blank project (no source video).
  z.object({
    blank: z.object({
      aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5']).optional(),
      durationMs: z.number().int().positive().optional(),
    }),
    title: z.string().optional(),
  }),
])

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = createSchema.parse(await request.json())
    const project =
      'blank' in body
        ? await createBlankClipProject(workspaceId, body)
        : 'prompt' in body
        ? await createClipProjectFromPrompt(workspaceId, body)
        : 'sourceUrl' in body
          ? await createClipProjectFromImportUrl(workspaceId, body)
          : await createClipProject(workspaceId, body)
    const settings = (project.settings ?? {}) as Record<string, unknown>
    clipperLog('project', 'created', {
      projectId: project.id,
      workspaceId,
      status: project.status,
      mode: String(settings.mode ?? 'auto'),
      genre: String(settings.genre ?? 'auto'),
      source:
        settings.blank === true
          ? 'blank'
          : settings.fullVideo === true
          ? 'full_video'
          : settings.byo === true
          ? 'byo'
          : 'prompt' in body
            ? 'prompt'
            : 'sourceUrl' in body
              ? 'import'
              : 'upload',
    })
    return NextResponse.json({ data: serializeProject(project) })
  } catch (err) {
    console.error('[clipper:project] create_failed', {
      error: err instanceof Error ? err.message : 'unknown',
    })
    return jsonError(err, 400)
  }
}
