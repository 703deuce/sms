import type { ClipWord } from '@/lib/clips/edits'
import { mergeClipWordsWithProjectTranscript } from '@/lib/clips/editor-words-merge'
import { MAX_EDITOR_WORDS_CONTEXT_MS, MAX_TRIM_EXTEND_MS } from '@/lib/clips/trim-bounds'
import { loadSourceWords, wordsInRange, type SourceWord } from '@/lib/clips/source-words'
import type { getClipStorage } from '@/lib/storage'

export function normalizeTranscriptWord(raw: unknown, pos: number): ClipWord | null {
  if (!raw || typeof raw !== 'object') return null
  const w = raw as Record<string, unknown>
  const text = w.w ?? w.word
  const s = w.s ?? w.start
  const e = w.e ?? w.end
  if (typeof text !== 'string' || s == null || e == null) return null
  const p = w.p ?? w.prob ?? w.probability
  return {
    w: text,
    s: Number(s),
    e: Number(e),
    p: p != null ? Number(p) : undefined,
    i: typeof w.i === 'number' ? w.i : pos,
  }
}

export function normalizeTranscriptJson(raw: unknown): ClipWord[] {
  if (!Array.isArray(raw)) return []
  const out: ClipWord[] = []
  raw.forEach((item, pos) => {
    const word = normalizeTranscriptWord(item, pos)
    if (word) out.push(word)
  })
  return out
}

function clipWordsStorageKey(workspaceId: string, projectId: string, clipId: string) {
  return `ws/${workspaceId}/projects/${projectId}/clips/${clipId}/words.json`
}

async function readClipWordJson(
  storage: ReturnType<typeof getClipStorage>,
  key: string | null,
): Promise<ClipWord[]> {
  if (!key) return []
  try {
    const data = await storage.getJson<unknown>(key)
    return normalizeTranscriptJson(data)
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
  const clipLenMs = clipEndMs - clipStartMs
  const maxEndMs = Math.max(...words.map((w) => w.e * 1000))
  const minStartMs = Math.min(...words.map((w) => w.s * 1000))
  const looksRelative =
    maxEndMs <= clipLenMs + 2000 &&
    minStartMs >= -500 &&
    maxEndMs < clipStartMs - 250
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
  opts?: {
    trimInMs?: number
    trimOutMs?: number
    contextMs?: number
    trimLimits?: { minMs: number; maxMs: number }
  },
): Promise<SourceWord[]> {
  let clipRaw = await readClipWordJson(storage, clip.wordsKey)
  if (!clipRaw.length) {
    clipRaw = await readClipWordJson(storage, clipWordsStorageKey(workspaceId, clip.projectId, clip.id))
  }

  if (clipRaw.length) {
    const absolute = clipWordsToAbsolute(clipRaw, clip.startMs, clip.endMs)
    const clipLoaded = loadSourceWords(absolute)
    if (projectTranscript.length) {
      const projectLoaded = loadSourceWords(projectTranscript)
      const extendMs =
        opts?.contextMs != null && Number.isFinite(opts.contextMs)
          ? Math.min(MAX_EDITOR_WORDS_CONTEXT_MS, Math.max(0, Math.floor(opts.contextMs)))
          : MAX_TRIM_EXTEND_MS
      return mergeClipWordsWithProjectTranscript(
        clipLoaded,
        projectLoaded,
        clip.startMs,
        clip.endMs,
        extendMs,
        opts?.trimInMs != null && opts?.trimOutMs != null
          ? { startMs: opts.trimInMs, endMs: opts.trimOutMs }
          : undefined,
        opts?.trimLimits,
      )
    }
    return clipLoaded
  }

  if (projectTranscript.length) {
    const projectWords = loadSourceWords(projectTranscript)
    const sliced = wordsInRange(projectWords, clip.startMs, clip.endMs)
    if (sliced.length) return sliced
    return []
  }

  return []
}
