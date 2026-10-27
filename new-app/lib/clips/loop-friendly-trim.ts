import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'

const STOP = new Set(
  'the a an and or but so to of in on at is it that this you we they i for with as be are was'.split(' '),
)

function tokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of text.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
    if (m.length > 2 && !STOP.has(m)) out.add(m)
  }
  return out
}

export function loopAlignmentScore(first: string[], last: string[]): number {
  const a = tokens(first.join(' '))
  const b = tokens(last.join(' '))
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

export function loopFriendlyEndDefault(exportPlatform?: ExportPlatformId | null): boolean {
  if (process.env.CLIP_POLISH_LOOP_END === '0') return false
  return exportPlatform === 'tiktok' || exportPlatform === 'youtube_shorts'
}

export function applyLoopFriendlyTrimToEdits(
  edits: ClipEditsV2,
  words: SourceWord[],
  opts: { exportPlatform?: ExportPlatformId | null } = {},
): ClipEditsV2 {
  const enabled =
    edits.loopFriendlyEnd ??
    (opts.exportPlatform ? loopFriendlyEndDefault(opts.exportPlatform) : false)
  if (!enabled) return edits
  const tin = edits.trim.in
  const tout = edits.trim.out
  if (tout - tin < 4000) return edits
  const ordered = [...words].filter((w) => w.w?.trim()).sort((a, b) => a.s - b.s)
  if (ordered.length < 4) return edits
  const texts = ordered.map((w) => w.w.trim())
  const score = loopAlignmentScore(texts.slice(0, 5), texts.slice(-5))
  const last = ordered[ordered.length - 1]
  const payoff = /[!?…]$/.test(texts[texts.length - 1]!) || score >= 0.22
  if (!payoff) return edits
  const lastEndMs = Math.round(last.e * 1000)
  if (lastEndMs < tin + 1500) return edits
  const newOut = Math.min(tout, lastEndMs + 220)
  if (newOut <= tin + 2500 || tout - newOut < 80) return edits
  return { ...edits, trim: { ...edits.trim, out: newOut }, loopFriendlyEnd: true }
}
