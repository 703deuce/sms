import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import {
  deleteClipEditVersion,
  getClipEditVersion,
} from '@/lib/server/clips/clip-edit-versions'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string; vid: string }> },
) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id, vid } = await ctx.params
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = await getClipEditVersion(workspaceId, id, vid)
    if (row && 'unavailable' in row) {
      return NextResponse.json({ code: 'VERSIONS_UNAVAILABLE' }, { status: 503 })
    }
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        kind: row.kind,
        createdAt: row.createdAt.toISOString(),
        edits: row.edits,
        editsSaveVersion: row.editsSaveVersion,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string; vid: string }> },
) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id, vid } = await ctx.params
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const result = await deleteClipEditVersion(workspaceId, id, vid)
    if (!result.ok) {
      if (result.code === 'VERSIONS_UNAVAILABLE') {
        return NextResponse.json({ code: result.code }, { status: 503 })
      }
      if (result.code === 'ORIGINAL') {
        return NextResponse.json({ error: 'Cannot delete original version' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
