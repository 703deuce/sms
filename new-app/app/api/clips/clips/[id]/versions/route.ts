import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import {
  createClipEditVersion,
  listClipEditVersions,
} from '@/lib/server/clips/clip-edit-versions'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const result = await listClipEditVersions(workspaceId, id)
    if (!result.ok) {
      return NextResponse.json({ code: result.code }, { status: 503 })
    }
    return NextResponse.json({ items: result.items })
  } catch (err) {
    return jsonError(err, 500)
  }
}

const postSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(['manual', 'auto']).default('manual'),
  edits: z.record(z.unknown()),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = postSchema.parse(await request.json())
    const result = await createClipEditVersion(workspaceId, clip, body)
    if (!result.ok) {
      if (result.code === 'VERSIONS_UNAVAILABLE') {
        return NextResponse.json({ code: result.code }, { status: 503 })
      }
      if (result.code === 'LIMIT') {
        return NextResponse.json({ error: 'Delete a version first' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
    return NextResponse.json({ id: result.id })
  } catch (err) {
    return jsonError(err, 400)
  }
}
