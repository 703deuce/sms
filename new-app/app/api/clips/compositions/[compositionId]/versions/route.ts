import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import {
  createCompositionVersion,
  listCompositionVersions,
} from '@/lib/server/clips/composition-versions'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { compositionId } = await ctx.params
    const rows = await listCompositionVersions(workspaceId, compositionId)
    if (!rows) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ items: rows })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { compositionId } = await ctx.params
    const body = (await request.json().catch(() => ({}))) as { name?: string }
    const id = await createCompositionVersion(workspaceId, compositionId, body.name)
    if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ id })
  } catch (err) {
    return jsonError(err, 500)
  }
}
