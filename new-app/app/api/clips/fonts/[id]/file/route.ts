import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { fontFile } from '@/lib/server/clips/fonts'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/**
 * G3b: the font bytes, same-origin, for the editor preview (JASSUB fetches them in its worker, so a
 * cross-origin B2 URL would need bucket CORS). A font id's bytes never change → long private cache.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const f = await fontFile(workspaceId, id)
    if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(f.body, { headers: { 'Content-Type': f.type, 'Cache-Control': 'private, max-age=31536000, immutable' } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
