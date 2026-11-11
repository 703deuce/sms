import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getReadableClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

function posterContentType(key: string): string {
  const lower = key.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip?.posterKey) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const storage = await getReadableClipStorage(clip.posterKey)
    const bytes = await storage.getObjectBytes(clip.posterKey)
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': posterContentType(clip.posterKey),
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
