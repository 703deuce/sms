import type { ClipWord } from '@/lib/clips/edits'
import { loadSourceWords, wordsInRange, type SourceWord } from '@/lib/clips/source-words'
import type { getClipStorage } from '@/lib/storage'

function clipWordsStorageKey(workspaceId: string, projectId: string, clipId: string) {
  return `ws/${workspaceId}/projects/${projectId}/clips/${clipId}/words.json`
}

async function readClipWordJson(
  storage: ReturnType<typeof getClipStorage>,
  key: string | null,
): Promise<ClipWord[]> {
  if (!key) return []
  try {
    const data = await storage.getJson<ClipWord[]>(key)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** Shift clip-relative word times (seconds) to absolute source timeline ms. */
export function clipWordsToAbsolute(
  words: ClipWord[],
  clipStartMs: number,
  clipEndMs: number,
): ClipWord[] {
  if (!words.length) return words
  const maxEndMs = Math.max(...words.map((w) => w.e * 1000))
  const clipLen = clipEndMs - clipStartMs
  const looksRelative = maxEndMs <= clipLen + 2000 && maxEndMs < clipStartMs
  if (!looksRelative) return words
  const offsetSec = clipStartMs / 1000
  return words.map((w) => ({ ...w, s: w.s + offsetSec, e: w.e + offsetSec }))
}

/**
 * Clip-specific words first; otherwise project transcript sliced to the clip range.
 */
export async function resolveEditorWords(
  storage: ReturnType<typeof getClipStorage>,
  workspaceId: string,
  clip: { id: string; projectId: string; startMs: number; endMs: number; wordsKey: string | null },
  projectTranscript: ClipWord[],
): Promise<SourceWord[]> {
  let clipRaw = await readClipWordJson(storage, clip.wordsKey)
  if (!clipRaw.length) {
    clipRaw = await readClipWordJson(storage, clipWordsStorageKey(workspaceId, clip.projectId, clip.id))
  }

  if (clipRaw.length) {
    const absolute = clipWordsToAbsolute(clipRaw, clip.startMs, clip.endMs)
    return loadSourceWords(absolute)
  }

  if (projectTranscript.length) {
    const projectWords = loadSourceWords(projectTranscript)
    const sliced = wordsInRange(projectWords, clip.startMs, clip.endMs)
    return sliced.length ? sliced : projectWords
  }

  return []
}
