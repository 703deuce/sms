import 'server-only'

import { normalizeEdits, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import { clipWordsToSnapWords, repairClipBoundsIfNeeded } from '@/lib/clips/editor/snap-clip-bounds'
import type { SourceWord } from '@/lib/clips/source-words'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

/** Q3: one-time repair when opening the editor — snap stored clip bounds to sentence edges (±3 s). */
export async function repairClipSentenceBoundsOnOpen(
  clip: { id: string; startMs: number; endMs: number; edits: unknown },
  words: SourceWord[],
  bounds: ClipBounds,
): Promise<{ bounds: ClipBounds; edits: ClipEditsV2; startMs: number; endMs: number } | null> {
  if (!words.length || clip.endMs <= clip.startMs) return null
  const snapWords = clipWordsToSnapWords(words)
  const rangeStart = bounds.trimMinMs ?? bounds.clipStartMs
  const rangeEnd = bounds.trimMaxMs ?? bounds.clipEndMs
  const pick = { startMs: clip.startMs, endMs: clip.endMs }
  const { startMs, endMs, changed } = repairClipBoundsIfNeeded(pick, snapWords, rangeStart, rangeEnd)
  if (!changed || endMs - startMs < 500) return null

  const nextBounds: ClipBounds = { ...bounds, clipStartMs: startMs, clipEndMs: endMs }
  const baseEdits = normalizeEdits(clip.edits, bounds)
  const nextEdits = normalizeEdits(
    {
      ...baseEdits,
      trim: { in: startMs, out: endMs },
    },
    nextBounds,
  )

  const prisma = getPrisma()
  await prisma.clip.update({
    where: { id: clip.id },
    data: {
      startMs,
      endMs,
      edits: toPrismaJson(nextEdits),
    },
  })

  return { bounds: nextBounds, edits: nextEdits, startMs, endMs }
}
