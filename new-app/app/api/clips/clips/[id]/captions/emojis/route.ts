import { NextResponse } from 'next/server'
import { EMOJI_WHITELIST_SET } from '@/lib/clips/emoji-whitelist'
import { loadSourceWords } from '@/lib/clips/source-words'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const SYSTEM = `Pick caption emojis for a short video. Return JSON {"picks":[{"wordIndex":number,"emoji":string}]}.
Rules:
- At most 1 emoji per 3 seconds of clip duration
- Tie picks to emphasis / important words when possible
- Only use emoji from the allowed list
- wordIndex is the word's index field from the transcript`

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const prisma = getPrisma()
    const project = await prisma.clipProject.findUnique({ where: { id: clip.projectId } })
    const storage = getClipStorage()
    let words = loadSourceWords([])
    if (project?.transcriptKey) {
      try {
        words = loadSourceWords(await storage.getJson(project.transcriptKey))
      } catch {
        words = []
      }
    }
    const clipWordsKey = `ws/${workspaceId}/projects/${clip.projectId}/clips/${clipId}/words.json`
    try {
      const clipWords = await storage.getJson<{ w: string; s: number; e: number; i?: number }[]>(clipWordsKey)
      words = loadSourceWords(clipWords)
    } catch {
      /* use project words */
    }

    const durationS = Math.max(1, (clip.endMs - clip.startMs) / 1000)
    const maxPicks = Math.max(1, Math.floor(durationS / 3))
    const excerpt = words
      .slice(0, 120)
      .map((w, i) => `${w.i ?? i}:${w.w}`)
      .join(' ')

    const raw = await openAiJsonResponse<{ picks?: { wordIndex: number; emoji: string }[] }>(
      SYSTEM,
      JSON.stringify({
        allowed: [...EMOJI_WHITELIST_SET].slice(0, 150),
        maxPicks,
        words: excerpt,
      }),
    )

    const picks = (raw.picks || [])
      .filter((p) => EMOJI_WHITELIST_SET.has(p.emoji))
      .slice(0, maxPicks)

    return NextResponse.json({ data: { picks } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
