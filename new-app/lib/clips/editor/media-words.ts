/**
 * E5b: words of an on-demand media transcript joined into the clip transcript.
 *
 * - Source segments whose sound is the clip's own ('source'): the main words in that MAIN SOURCE
 *   span are replaced by the media's words, mapped to main time with the segment's media mapping
 *   (E5 `segmentMediaMs`). Captions, the transcript panel and word fixes then work unchanged.
 * - Inserts (E5b): their words live on the display timeline (`insertWords`), which goes to the
 *   exported SRT and the Media panel.
 *
 * Joined words get a stable index `mediaWordIndex(refId, k)` far above any clip word index, so
 * `edits.wordFixes[String(i)]` edits them like any other word. Worker mirror: media_words.py
 * (parity fixture e5b_parity.json).
 */
import type { ClipWord } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { isSynced, segmentAudio, sourceById, type ClipMediaSource, type SourceSegment } from '@/lib/clips/editor/sources'
import type { InsertWindow } from '@/lib/clips/editor/inserts'

export type MediaTranscriptWord = { w: string; s: number; e: number; p?: number; spk?: number }

export type MediaTranscript = {
  ref: 'upload' | 'take'
  refId: string
  status: 'queued' | 'running' | 'done' | 'failed'
  /** MEDIA time, seconds. */
  words: MediaTranscriptWord[]
  language: string | null
  durationMs: number | null
  /** Credits shown/accepted when it was queued (credits only — no $ reaches the browser). */
  credits: number | null
  error: string | null
}

export type MediaTranscriptEstimate = {
  ref: 'upload' | 'take'
  refId: string
  label: string
  durationMs: number | null
  durationKnown: boolean
  /** Credits this transcription costs (shown before anything runs). */
  credits: number
  hasAudio: boolean | null
}

export const MEDIA_WORD_INDEX_BASE = 1_000_000_000
const PER_MEDIA = 1_000_000

/** FNV-1a of the media id → bucket 0..999 (stable across reloads / source reordering). */
export function mediaBucket(refId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < refId.length; i++) {
    h ^= refId.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 1000
}

export function mediaWordIndex(refId: string, k: number): number {
  return MEDIA_WORD_INDEX_BASE + mediaBucket(refId) * PER_MEDIA + Math.min(k, PER_MEDIA - 1)
}

export function isMediaWordIndex(i: number | undefined): boolean {
  return typeof i === 'number' && i >= MEDIA_WORD_INDEX_BASE
}

type Edits = { sources?: ClipMediaSource[]; sourceSegments?: SourceSegment[] }

export function transcriptByRefId(transcripts: readonly MediaTranscript[] | undefined): Map<string, MediaTranscript> {
  const m = new Map<string, MediaTranscript>()
  for (const t of transcripts ?? []) if (t.status === 'done' && t.words.length) m.set(t.refId, t)
  return m
}

/** Main source words with media words joined over 'source'-sound segments (sorted by start). */
export function mergeMediaWords<W extends ClipWord>(
  words: readonly W[],
  edits: Edits,
  transcripts: readonly MediaTranscript[] | undefined,
): W[] {
  const byRef = transcriptByRefId(transcripts)
  if (!byRef.size || !edits.sourceSegments?.length) return words as W[]
  const spans: { a: number; b: number; add: SourceWord[] }[] = []
  for (const seg of edits.sourceSegments) {
    const src = sourceById(edits.sources, seg.sourceId)
    if (!src || src.mediaType !== 'video' || segmentAudio(seg, src) !== 'source') continue
    const tr = byRef.get(src.refId)
    if (!tr) continue
    // media ms = main ms + delta (E5 segmentMediaMs without its clamp at 0).
    const delta = isSynced(seg, src) ? (src.syncMs ?? 0) : (seg.inMs ?? 0) - seg.startMs
    const add: SourceWord[] = []
    tr.words.forEach((w, k) => {
      const s = Math.round(w.s * 1000) - delta
      const e = Math.round(w.e * 1000) - delta
      const mid = (s + e) / 2
      if (mid < seg.startMs || mid >= seg.endMs || !String(w.w ?? '').trim()) return
      add.push({
        w: w.w,
        s: Math.max(seg.startMs, s) / 1000,
        e: Math.min(seg.endMs, Math.max(s + 1, e)) / 1000,
        ...(w.p !== undefined ? { p: w.p } : {}),
        i: mediaWordIndex(src.refId, k),
      })
    })
    spans.push({ a: seg.startMs, b: seg.endMs, add })
  }
  if (!spans.length) return words as W[]
  const inSpan = (w: ClipWord) => {
    const mid = ((w.s + w.e) / 2) * 1000
    return spans.some((sp) => mid >= sp.a && mid < sp.b)
  }
  const out: W[] = words.filter((w) => !inSpan(w))
  // Media words carry the same {w, s, e, p?, i} shape as main source words.
  for (const sp of spans) out.push(...(sp.add as unknown as W[]))
  return out.sort((x, y) => x.s - y.s || x.e - y.e)
}

export type InsertWord = { w: string; startMs: number; endMs: number; i: number; insertId: string }

/** Words heard during each insert, on the DISPLAY timeline (ms), word fixes applied. */
export function insertWords(
  windows: readonly InsertWindow[],
  sources: readonly ClipMediaSource[] | undefined,
  transcripts: readonly MediaTranscript[] | undefined,
  wordFixes: Record<string, string> = {},
): InsertWord[] {
  const byRef = transcriptByRefId(transcripts)
  const out: InsertWord[] = []
  for (const win of windows) {
    if (win.audio !== 'source') continue
    const src = sourceById(sources, win.sourceId)
    const tr = src ? byRef.get(src.refId) : undefined
    if (!src || !tr) continue
    tr.words.forEach((w, k) => {
      const s = Math.round(w.s * 1000)
      const e = Math.round(w.e * 1000)
      const mid = (s + e) / 2
      if (mid < win.inMs || mid >= win.inMs + win.durMs) return
      const i = mediaWordIndex(src.refId, k)
      const text = wordFixes[String(i)] ?? w.w
      if (!String(text ?? '').trim()) return
      out.push({
        w: text,
        startMs: win.startMs + Math.max(0, s - win.inMs),
        endMs: win.startMs + Math.min(win.durMs, Math.max(s + 1, e) - win.inMs),
        i,
        insertId: win.id,
      })
    })
  }
  return out
}
