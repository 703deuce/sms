import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { deleteCaptionPreset } from '@/lib/server/clips/caption-presets'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    await deleteCaptionPreset(workspaceId, id)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
