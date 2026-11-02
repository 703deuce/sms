/**
 * Run fillerProposals, findRetakes, and clarity excerpts on real transcript words.
 *
 * Usage:
 *   npx tsx scripts/cleanup-audit-real-words.ts [--fixture path] [--clip-start-ms N] [--clip-end-ms N]
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSourceWords, wordsInRange } from '../new-app/lib/clips/source-words'
import { editorWordsForClipFillerReview } from '../new-app/lib/clips/editor/filler-review-words'
import { fillerProposals } from '../new-app/lib/clips/editor/cleanup-proposals'
import { findRetakes } from '../new-app/lib/clips/editor/retakes'
import { defaultEdits, normalizeEdits, type ClipWord } from '../new-app/lib/clips/edits'

function normalizeTranscriptJson(raw: unknown): ClipWord[] {
  if (!Array.isArray(raw)) return []
  const out: ClipWord[] = []
  raw.forEach((item, pos) => {
    if (!item || typeof item !== 'object') return
    const w = item as Record<string, unknown>
    const text = w.w ?? w.word
    const s = w.s ?? w.start
    const e = w.e ?? w.end
    if (typeof text !== 'string' || s == null || e == null) return
    out.push({ w: text, s: Number(s), e: Number(e), i: typeof w.i === 'number' ? w.i : pos })
  })
  return out
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixture =
  process.argv.find((a) => a.startsWith('--fixture='))?.split('=')[1] ??
  join(root, 'new-app/tests/fixtures/cleanup-proj-eb785762-transcript-words.json')
const clipStartMs = Number(process.argv.find((a) => a.startsWith('--clip-start-ms='))?.split('=')[1] ?? 800)
const clipEndMs = Number(process.argv.find((a) => a.startsWith('--clip-end-ms='))?.split('=')[1] ?? 81875)
const clipId = 'clip_fb8118406d454027a37ca2a420490f98'

const raw = JSON.parse(readFileSync(fixture, 'utf8'))
const projectWords = loadSourceWords(normalizeTranscriptJson(raw))
const scoped = wordsInRange(projectWords, clipStartMs, clipEndMs)
const bounds = {
  clipStartMs,
  clipEndMs,
  trimMinMs: Math.max(0, clipStartMs - 8000),
  trimMaxMs: clipEndMs + 8000,
}
const edits = normalizeEdits(defaultEdits(bounds), bounds)
const ordered = editorWordsForClipFillerReview(clipId, scoped, edits, bounds)
const deletedSet = new Set<string>()

function printProposals(title: string, rows: { kind: string; label: string; range: [number, number] }[]) {
  console.log(`\n=== ${title} (${rows.length}) ===`)
  for (const p of rows) {
    const [a, b] = p.range
    console.log(`${p.kind}\t${a}-${b}ms\t${p.label}`)
  }
}

for (const strength of ['light', 'normal', 'aggressive'] as const) {
  const props = fillerProposals(ordered, deletedSet, { strength, enabledOptInFillers: new Set() })
  printProposals(`fillerProposals strength=${strength}`, props)
}

const optIn = new Set(['you know'])
const propsOptIn = fillerProposals(ordered, deletedSet, { strength: 'normal', enabledOptInFillers: optIn })
printProposals('fillerProposals normal + you know', propsOptIn)

const retakeWords = scoped.map((w) => ({
  w: w.w,
  s: (w.s ?? 0),
  e: (w.e ?? 0),
}))
const groups = findRetakes(retakeWords, [])
console.log(`\n=== findRetakes groups (${groups.length}) ===`)
for (let i = 0; i < groups.length; i++) {
  const g = groups[i]!
  console.log(`group ${i + 1} keep=${g.keepIndex}`)
  for (let j = 0; j < g.attempts.length; j++) {
    const a = g.attempts[j]!
    console.log(`  [${j}] ${a.startMs}-${a.endMs}ms ${a.text.slice(0, 100)}`)
  }
}

const umUh = ordered.filter((w) => /^(um|uh)/i.test(w.text.trim()))
console.log(`\n=== um/uh tokens in editor words (${umUh.length}) ===`)
for (const w of umUh) {
  console.log(`${w.t0Ms}-${w.t1Ms}ms raw="${w.text}" kind=${w.fillerKind} isFiller=${w.isFiller}`)
}
