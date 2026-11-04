import type { ClipWord } from '@/lib/clips/edits'
import { dedupeAdjacentEditorWords } from '@/lib/clips/editor-words-dedupe'
import { loadSourceWords, wordsInRange, type SourceWord } from '@/lib/clips/source-words'
import { mergeClipWordsWithProjectTranscript } from '@/lib/clips/editor-words-merge'
import { MAX_TRIM_EXTEND_MS } from '@/lib/clips/trim-bounds'
import type { getClipStorage } from '@/lib/storage'

/** Deepgram / DB / S3 may wrap the word array. */
export function unwrapTranscriptArray(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    for (const key of ['words', 'transcript', 'results'] as const) {
      if (Array.isArray(o[key])) return o[key]
    }
  }
  return raw
}

export function normalizeTranscriptWord(raw: unknown, pos: number): ClipWord | null {
  if (!raw || typeof raw !== 'object') return null
  const w = raw as Record<string, unknown>
  const text = w.w ?? w.word ?? w.text
  const s = w.s ?? w.start
  const e = w.e ?? w.end
  if (typeof text !== 'string' || !text.trim() || s == null || e == null) return null
  const p = w.p ?? w.prob ?? w.probability
  const spkRaw = w.spk ?? w.speaker
  const spkNum = spkRaw != null ? Number(spkRaw) : NaN
  const spk = Number.isFinite(spkNum) ? spkNum : undefined
  return {
    w: text,
    s: Number(s),
    e: Number(e),
    p: p != null ? Number(p) : undefined,
    i: typeof w.i === 'number' ? w.i : pos,
    ...(spk !== undefined ? { spk } : {}),
  }
}

export function normalizeTranscriptJson(raw: unknown): ClipWord[] {
  const arr = unwrapTranscriptArray(raw)
  if (!Array.isArray(arr)) return []
  const out: ClipWord[] = []
  arr.forEach((item, pos) => {
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
  // FIX1 (B): relative = fits [0, clipLen]; if it ALSO fits the absolute span (clip near the start),
  // pick whichever origin the first word is closer to (relative words start ~0, absolute ~clipStart).
  const fitsRelative = minStartMs >= -500 && maxEndMs <= clipLenMs + 2000
  const fitsAbsolute = minStartMs >= clipStartMs - 1000 && maxEndMs <= clipEndMs + 2000
  const looksRelative =
    fitsRelative && (!fitsAbsolute || Math.abs(minStartMs) < Math.abs(minStartMs - clipStartMs))
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
    preloadedClipWords?: ClipWord[]
  },
): Promise<SourceWord[]> {
  let clipRaw = opts?.preloadedClipWords ?? []
  if (!clipRaw.length && opts?.preloadedClipWords === undefined) {
    clipRaw = await readClipWordJson(storage, clip.wordsKey)
    if (!clipRaw.length) {
      clipRaw = await readClipWordJson(storage, clipWordsStorageKey(workspaceId, clip.projectId, clip.id))
    }
  }

  const clipLoaded = clipRaw.length
    ? dedupeAdjacentEditorWords(loadSourceWords(clipWordsToAbsolute(clipRaw, clip.startMs, clip.endMs)))
    : []
  if (!projectTranscript.length) return clipLoaded

  const projectWords = loadSourceWords(projectTranscript)
  const trimIn = opts?.trimInMs ?? clip.startMs
  const trimOut = opts?.trimOutMs ?? clip.endMs
  const extended = trimIn < clip.startMs || trimOut > clip.endMs
  if (!extended && clipLoaded.length) return clipLoaded

  // The editor asks for additional words when a trim extends beyond the original
  // clip. Reading only [clip.startMs, clip.endMs] made those requests return empty
  // repeatedly, even though the project transcript already contained the words.
  const contextMs = Math.max(0, Math.min(opts?.contextMs ?? MAX_TRIM_EXTEND_MS, MAX_TRIM_EXTEND_MS))
  const range = { startMs: trimIn, endMs: trimOut }
  const merged = mergeClipWordsWithProjectTranscript(
    clipLoaded, projectWords, clip.startMs, clip.endMs, contextMs,
    range, opts?.trimLimits,
  )
  return dedupeAdjacentEditorWords(merged)
}

/** Start clip + fallback words.json downloads in parallel (editor payload). */
export function preloadClipWordJson(
  storage: ReturnType<typeof getClipStorage>,
  workspaceId: string,
  clip: { id: string; projectId: string; wordsKey: string | null },
): Promise<ClipWord[]> {
  const primary = readClipWordJson(storage, clip.wordsKey)
  const fallback = readClipWordJson(storage, clipWordsStorageKey(workspaceId, clip.projectId, clip.id))
  return Promise.all([primary, fallback]).then(([a, b]) => (a.length ? a : b))
}
