import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { listProjectMedia, registerProjectMedia } from '@/lib/server/clips/project-media'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** E5 project media library: GET list (uploads + Rooms angles, signed URLs), POST register a finished upload. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const items = await listProjectMedia(workspaceId, projectId)
    if (!items) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { items } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

const optInt = z.preprocess(
  (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined),
  z.number().int().min(0).max(2_147_483_647).optional(),
)
const bodySchema = z.object({
  uploadId: z.string().min(1).max(120),
  label: z.string().max(200).optional(),
  durationMs: optInt,
  width: optInt,
  height: optInt,
  hasAudio: z.boolean().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const item = await registerProjectMedia(workspaceId, projectId, body)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { item } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
