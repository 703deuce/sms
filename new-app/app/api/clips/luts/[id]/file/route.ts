import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { lutFile } from '@/lib/server/clips/luts'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** G4a: the .cube text, same-origin, for the editor preview / scopes. A LUT id never changes. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const text = await lutFile(workspaceId, id)
    if (text == null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, max-age=31536000, immutable' } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
