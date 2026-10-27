import type { ClipWord } from '@/lib/clips/edits'

export type EditorWord = {
  id: string
  index: number
  t0Ms: number
  t1Ms: number
  text: string
  conf?: number
  speakerId: string
  isFiller?: boolean
  fillerKind?: 'lexicon' | 'repeat' | 'silence'
  gapBeforeMs?: number
}

const SPEAKER_COLORS = ['#FFD400', '#22C55E', '#0EA5E9', '#A855F7']

export function resolveSourceMediaId(project: { id: string; uploadId?: string | null }): string {
  if (project.uploadId) return `clip_upload:${project.uploadId}`
  return `import:${project.id}`
}

type FillerKind = EditorWord['fillerKind']

function readEnrichment(raw: ClipWord & Record<string, unknown>): {
  isFiller?: boolean
  fillerKind?: FillerKind
  gapBeforeMs?: number
} {
  const isFiller = raw.isFiller === true ? true : undefined
  let fillerKind: FillerKind | undefined
  if (raw.fillerKind === 'lexicon' || raw.fillerKind === 'repeat' || raw.fillerKind === 'silence') {
    fillerKind = raw.fillerKind
  }
  const gapBeforeMs = typeof raw.gapBeforeMs === 'number' ? raw.gapBeforeMs : undefined
  return { isFiller, fillerKind, gapBeforeMs }
}

/** Map pipeline transcript JSON to stable editor word ids (spec SCRIPT-EDITOR-BUILD §2.2). */
export function toEditorWords(sourceMediaId: string, words: ClipWord[]): EditorWord[] {
  return words.map((w, pos) => {
    const index = w.i ?? w.idx ?? pos
    const extra = w as ClipWord & Record<string, unknown>
    const spk = w.spk ?? 0
    return {
      id: `${sourceMediaId}:${index}`,
      index,
      t0Ms: Math.round(w.s * 1000),
      t1Ms: Math.round(w.e * 1000),
      text: w.w,
      conf: w.p,
      speakerId: `spk:${spk}`,
      ...readEnrichment(extra),
    }
  })
}

export function defaultSpeakerColor(sortOrder: number): string {
  return SPEAKER_COLORS[sortOrder % SPEAKER_COLORS.length] ?? SPEAKER_COLORS[0]
}
