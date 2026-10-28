import 'server-only'

import { EMOJI_WHITELIST_SET } from '@/lib/clips/emoji-whitelist'
import { normalizeEdits } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { openAiJsonWithGeminiFallback } from '@/lib/server/ai/openai-json'

const SYSTEM = `Pick caption emojis for a short video. Return JSON {"picks":[{"wordIndex":number,"emoji":string}]}.
Rules:
- At most 1 emoji per 3 seconds of clip duration
- Tie picks to emphasis / important words when possible
- Only use emoji from the allowed list
- wordIndex is the word's index field from the transcript`

export async function suggestCaptionEmojisForClip(
  workspaceId: string,
  clipId: string,
): Promise<Record<string, string>> {
  const prisma = getPrisma()
  const clip = await prisma.clip.findFirst({ where: { id: clipId, workspaceId, deletedAt: null } })
  if (!clip) throw new Error('Clip not found')
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
    /* project transcript */
  }

  const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
  const edits = normalizeEdits(clip.edits, bounds)
  const segs = edits.cutRanges
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const inSpan = words.filter((w) => {
    const mid = ((w.s + w.e) / 2) * 1000
    if (mid < trimIn || mid >= trimOut) return false
    return !segs.some(([a, b]) => mid >= a && mid < b)
  })
  const durationS = Math.max(1, (trimOut - trimIn) / 1000)
  const maxPicks = Math.max(1, Math.floor(durationS / 3))
  const excerpt = inSpan
    .slice(0, 160)
    .map((w, i) => `${w.i ?? i}:${w.w}`)
    .join(' ')
    .slice(0, 4000)

  const raw = await openAiJsonWithGeminiFallback<{ picks?: { wordIndex: number; emoji: string }[] }>(
    'caption_emojis',
    SYSTEM,
    JSON.stringify({
      allowed: [...EMOJI_WHITELIST_SET].slice(0, 150),
      maxPicks,
      words: excerpt,
    }),
    {
      type: 'object',
      properties: {
        picks: {
          type: 'array',
          items: {
            type: 'object',
            properties: { wordIndex: { type: 'number' }, emoji: { type: 'string' } },
          },
        },
      },
    },
  )

  const map: Record<string, string> = {}
  for (const p of (raw.picks || []).filter((x) => EMOJI_WHITELIST_SET.has(x.emoji)).slice(0, maxPicks)) {
    const idx = Number(p.wordIndex)
    const byPos = words[idx]
    const key = String(byPos?.i ?? idx)
    map[key] = p.emoji
  }
  return map
}

export async function applyProjectAutoEmojis(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
  })
  if (!project) throw new Error('Project not found')
  const settings = (project.settings ?? {}) as Record<string, unknown>
  if (!settings.autoEmojis) return { clipsUpdated: 0 }

  const clips = await prisma.clip.findMany({ where: { projectId, deletedAt: null } })
  let clipsUpdated = 0
  for (const clip of clips) {
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    if (edits.captions.autoEmojis && Object.keys(edits.captions.emojiByWord || {}).length) continue
    const emojiByWord = await suggestCaptionEmojisForClip(workspaceId, clip.id)
    if (!Object.keys(emojiByWord).length) continue
    await prisma.clip.update({
      where: { id: clip.id },
      data: {
        edits: {
          ...edits,
          captions: { ...edits.captions, autoEmojis: true, emojiByWord },
        } as object,
      },
    })
    clipsUpdated += 1
  }
  return { clipsUpdated }
}
