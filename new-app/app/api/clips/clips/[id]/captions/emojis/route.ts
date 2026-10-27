import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { suggestCaptionEmojisForClip } from '@/lib/server/clips/caption-emojis'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const emojiByWord = await suggestCaptionEmojisForClip(workspaceId, clipId)
    const picks = Object.entries(emojiByWord).map(([wordIndex, emoji]) => ({
      wordIndex: Number(wordIndex),
      emoji,
    }))
    return NextResponse.json({ data: { picks } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
