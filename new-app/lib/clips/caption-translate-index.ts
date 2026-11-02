export const CAPTION_TRANSLATE_BATCH_SIZE = 40

export type NumberedCaptionLine = { i: number; text: string }

export function numberedInput(lines: { text: string }[]): NumberedCaptionLine[] {
  return lines.map((l, idx) => ({ i: idx, text: l.text }))
}

export function chunkNumberedLines(items: NumberedCaptionLine[], size = CAPTION_TRANSLATE_BATCH_SIZE): NumberedCaptionLine[][] {
  const out: NumberedCaptionLine[][] = []
  for (let o = 0; o < items.length; o += size) {
    out.push(items.slice(o, o + size))
  }
  return out
}

export function responseSchemaForCount(n: number): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        minItems: n,
        maxItems: n,
        items: {
          type: 'object',
          properties: {
            i: { type: 'integer' },
            text: { type: 'string' },
          },
          required: ['i', 'text'],
        },
      },
    },
    required: ['lines'],
  }
}

export function mergeNumberedResponses(
  expectedIndices: number[],
  parts: NumberedCaptionLine[][],
): { lines: string[] | null; missing: number[] } {
  const byIndex = new Map<number, string>()
  for (const batch of parts) {
    for (const row of batch) {
      if (!Number.isInteger(row.i) || row.i < 0) continue
      const text = String(row.text ?? '').slice(0, 200)
      if (!text.trim()) continue
      byIndex.set(row.i, text)
    }
  }
  const missing = expectedIndices.filter((i) => !byIndex.has(i))
  if (missing.length) {
    return { lines: null, missing }
  }
  const lines = expectedIndices.map((i) => byIndex.get(i)!)
  return { lines, missing: [] }
}
