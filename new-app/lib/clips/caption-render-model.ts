export type CaptionPresetV2 = {
  id: string
  name: string
  font: string
  weight: number
  case: 'upper' | 'sentence'
  sizePx1920: number
  wordsPerChunk: number
  maxLines: number
  fill: string
  stroke: { color: string; px: number }
  shadow: { color: string; px: number; blur: number }
  box: null | { color: string; opacity: number; radiusPx: number; padX: number; padY: number }
  highlight: { mode: string; color: string; altColor: string; keywordsPerChunk: number }
  animation: { kind: string; ms: number; shake: boolean; emoji: boolean }
  position: { anchor: string; y: number }
}

export type CaptionChunkWord = {
  text: string
  t0: number
  t1: number
  emph: boolean
  loud: boolean
}

export type CaptionChunk = {
  t0: number
  t1: number
  words: CaptionChunkWord[]
}

export function chunkCaptionWords(
  words: { w?: string; word?: string; s: number; e: number }[],
  preset: Pick<CaptionPresetV2, 'wordsPerChunk' | 'maxLines'>,
  emphasisIdx: Set<number> = new Set(),
): CaptionChunk[] {
  const wpl = Math.max(1, preset.wordsPerChunk)
  const out: CaptionChunk[] = []
  for (let i = 0; i < words.length; i += wpl) {
    const slice = words.slice(i, i + wpl * preset.maxLines)
    for (let j = 0; j < slice.length; j += wpl) {
      const row = slice.slice(j, j + wpl)
      if (!row.length) continue
      out.push({
        t0: row[0].s,
        t1: row[row.length - 1].e,
        words: row.map((w, k) => ({
          text: String(w.w ?? w.word ?? ''),
          t0: w.s,
          t1: w.e,
          emph: emphasisIdx.has(i + j + k),
          loud: false,
        })),
      })
    }
  }
  return out
}
