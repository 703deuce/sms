import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { Marker } from '@/lib/clips/editor/markers'
import type { SourceWord } from '@/lib/clips/source-words'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { sourceToOutputSnapped } from '@/lib/clips/editor/clip-timeline'

export type TimestampedLine = { outMs: number; text: string; line: number }

export function buildTimestampedLines(
  words: SourceWord[],
  edits: ClipEditsV2,
  opts?: { maxWords?: number },
): TimestampedLine[] {
  const tb = timebaseFor(edits)
  const maxWords = opts?.maxWords ?? 60_000
  const lines: TimestampedLine[] = []
  let buf: string[] = []
  let lineStartOut = 0
  let wordCount = 0
  let lineNum = 0

  const flush = (outMs: number) => {
    const text = buf.join(' ').trim()
    if (text) {
      lines.push({ outMs, text, line: lineNum })
      lineNum++
    }
    buf = []
    lineStartOut = outMs
  }

  for (const w of words) {
    if (wordCount >= maxWords) break
    wordCount++
    const out = sourceToOutputSnapped(tb, w.startMs)
    if (!buf.length) lineStartOut = out
    buf.push(w.w)
    const gap = out - lineStartOut
    const endsSentence = /[.!?]$/.test(w.w)
    if (endsSentence || gap >= 20_000) flush(out)
  }
  if (buf.length) flush(lineStartOut)

  if (wordCount > maxWords && lines.length > 1) {
    const keep = Math.max(3, Math.floor((lines.length * maxWords) / wordCount))
    return lines.slice(0, keep)
  }
  return lines
}

export function normalizeChapters(
  raw: { chapters?: { line?: number; label?: string }[] },
  lines: TimestampedLine[],
  lengthMs: number,
): { chapters: { outMs: number; label: string }[] } | { error: string } {
  const rawCh = raw.chapters ?? []
  const mapped: { outMs: number; label: string }[] = []
  for (const ch of rawCh) {
    const idx = typeof ch.line === 'number' ? ch.line : Number(ch.line)
    const line = lines.find((l) => l.line === idx) ?? lines[idx]
    if (!line) continue
    const label = String(ch.label ?? '').trim().slice(0, 60) || 'Chapter'
    mapped.push({ outMs: line.outMs, label })
  }
  if (mapped.length && mapped[0]!.outMs !== 0) {
    mapped.unshift({ outMs: 0, label: mapped[0]!.label === 'Intro' ? 'Intro' : 'Intro' })
  }
  mapped.sort((a, b) => a.outMs - b.outMs)
  const out: { outMs: number; label: string }[] = []
  let last = -10_000
  for (const c of mapped) {
    if (c.outMs < 0 || c.outMs > lengthMs) continue
    if (c.outMs - last < 10_000 && c.outMs > 0) continue
    out.push(c)
    last = c.outMs
    if (out.length >= 12) break
  }
  if (out.length < 3) return { error: "Couldn't find chapters — try again" }
  return { chapters: out }
}

export function normalizeShowNotes(raw: {
  summary?: string
  bullets?: string[]
}): { summary: string; bullets: string[] } {
  const summary = String(raw.summary ?? '').trim()
  const bullets = (raw.bullets ?? []).map((b) => String(b).trim()).filter(Boolean).slice(0, 7)
  while (bullets.length < 3) bullets.push('')
  return { summary, bullets: bullets.slice(0, 7) }
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatYoutubeChapters(chapters: { outMs: number; label: string }[]): string {
  return chapters.map((c) => `${formatTime(c.outMs)} ${c.label}`).join('\n')
}

export function chaptersToMarkers(
  edits: ClipEditsV2,
  chapters: { outMs: number; label: string }[],
): ClipEditsV2 {
  const existing = new Set((edits.markers ?? []).map((m) => m.ms))
  const markers: Marker[] = [...(edits.markers ?? [])]
  for (const ch of chapters) {
    if (existing.has(ch.outMs)) continue
    markers.push({
      id: `ch_${ch.outMs}`,
      ms: ch.outMs,
      color: 'blue',
      label: ch.label,
      chapter: true,
    })
  }
  return { ...edits, markers }
}
