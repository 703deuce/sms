import 'server-only'

import { openAiJsonWithGeminiFallback } from '@/lib/server/ai/openai-json'
import {
  CAPTION_TRANSLATE_BATCH_SIZE,
  chunkNumberedLines,
  mergeNumberedResponses,
  numberedInput,
  responseSchemaForCount,
  type NumberedCaptionLine,
} from '@/lib/clips/caption-translate-index'

export { CAPTION_TRANSLATE_BATCH_SIZE } from '@/lib/clips/caption-translate-index'

const SYSTEM = `Translate each caption line to the target language. Keep meaning; do not merge or split lines.
Return JSON {"lines":[{"i":number,"text":string},...]} with one object per input index. Preserve each index exactly once.`

function parseModelLines(raw: { lines?: Array<{ i?: number; text?: string }> } | null | undefined): NumberedCaptionLine[] {
  return (raw?.lines ?? []).map((row) => ({
    i: Number(row?.i),
    text: String(row?.text ?? '').slice(0, 200),
  }))
}

async function translateNumberedBatch(
  targetLabel: string,
  batch: NumberedCaptionLine[],
  opts: { retry?: boolean },
): Promise<NumberedCaptionLine[]> {
  const retryHint = opts.retry
    ? ' Some indices were missing or duplicated last time; return exactly one translation per index.'
    : ''
  const user = JSON.stringify({ targetLang: targetLabel, lines: batch })
  const raw = await openAiJsonWithGeminiFallback<{ lines?: Array<{ i?: number; text?: string }> }>(
    'caption_translate',
    SYSTEM + retryHint,
    user,
    responseSchemaForCount(batch.length),
  )
  return parseModelLines(raw)
}

async function translateSingleLine(targetLabel: string, i: number, text: string): Promise<NumberedCaptionLine | null> {
  const raw = await openAiJsonWithGeminiFallback<{ lines?: Array<{ i?: number; text?: string }> }>(
    'caption_translate_line',
    'Translate the caption line. Return JSON {"lines":[{"i":0,"text":string}]}.',
    JSON.stringify({ targetLang: targetLabel, lines: [{ i: 0, text }] }),
    responseSchemaForCount(1),
  )
  const row = parseModelLines(raw)[0]
  if (!row || !row.text.trim()) return null
  return { i, text: row.text }
}

/** Translate caption lines with indexed batches, one batch retry, then per-line fallback. */
export async function translateCaptionLinesRobust(
  targetLabel: string,
  inputLines: { text: string }[],
): Promise<{ ok: true; lines: string[] } | { ok: false; error: 'translate_mismatch' }> {
  const numbered = numberedInput(inputLines)
  const expectedIndices = numbered.map((l) => l.i)
  const collected: NumberedCaptionLine[][] = []

  for (const batch of chunkNumberedLines(numbered)) {
    let out = await translateNumberedBatch(targetLabel, batch, {})
    const indices = batch.map((b) => b.i)
    let have = new Set(out.filter((r) => indices.includes(r.i) && r.text.trim()).map((r) => r.i))
    if (have.size !== batch.length) {
      out = await translateNumberedBatch(targetLabel, batch, { retry: true })
      have = new Set(out.filter((r) => indices.includes(r.i) && r.text.trim()).map((r) => r.i))
    }
    collected.push(out)
  }

  let merged = mergeNumberedResponses(expectedIndices, collected)
  if (merged.lines) {
    return { ok: true, lines: merged.lines }
  }

  const fallbackRows: NumberedCaptionLine[] = []
  for (const i of merged.missing) {
    const src = numbered[i]
    if (!src) continue
    const one = await translateSingleLine(targetLabel, i, src.text)
    if (one) fallbackRows.push(one)
  }
  if (fallbackRows.length) {
    collected.push(fallbackRows)
    merged = mergeNumberedResponses(expectedIndices, collected)
  }

  if (!merged.lines) {
    return { ok: false, error: 'translate_mismatch' }
  }
  return { ok: true, lines: merged.lines }
}
