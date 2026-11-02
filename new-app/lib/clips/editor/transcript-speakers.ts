import { speakerLabelForWord } from '@/lib/clips/crop-shots'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import { wordSourceMs, type SourceWord } from '@/lib/clips/source-words'

/** Same speaker ids as the Script panel (crop shots / diarization), not raw word.spk alone. */
export function transcriptSpeakerIdForWord(
  w: { s: number; e: number; spk?: number | string | null },
  shots: readonly CropShot[],
): string {
  if (shots.length) {
    const { midMs } = wordSourceMs(w)
    return speakerLabelForWord(shots as CropShot[], midMs)
  }
  if (w.spk === 1 || w.spk === '1') return '1'
  if (w.spk === 'B' || w.spk === 'b') return 'B'
  if (w.spk === 'A' || w.spk === 'a') return 'A'
  return String(w.spk ?? 0)
}

export type TranscriptSpeaker = { id: string; speakerNum: number }

/** Speakers in trim range, stable order of first appearance (matches Script panel blocks). */
export function speakersInTranscript(
  words: readonly SourceWord[],
  shots: readonly CropShot[],
  rangeStartMs: number,
  rangeEndMs: number,
): TranscriptSpeaker[] {
  const order: string[] = []
  const talk = new Map<string, number>()
  for (const w of words) {
    if (w.e * 1000 <= rangeStartMs || w.s * 1000 >= rangeEndMs) continue
    const id = transcriptSpeakerIdForWord(w, shots)
    if (!order.includes(id)) order.push(id)
    talk.set(id, (talk.get(id) ?? 0) + (w.e - w.s))
  }
  order.sort((a, b) => (talk.get(b) ?? 0) - (talk.get(a) ?? 0))
  return order.map((id, i) => ({ id, speakerNum: i + 1 }))
}

/** Remap legacy numeric diarization keys (0/1) to transcript ids (A/B). */
export function remapSpeakerSourceMap(
  map: Record<string, string> | undefined,
  speakerIds: readonly string[],
): Record<string, string> | undefined {
  if (!map || !speakerIds.length) return map
  const out: Record<string, string> = {}
  const numeric = speakerIds.every((id) => /^\d+$/.test(id))
  const letter = speakerIds.every((id) => /^[A-Z]$/i.test(id))
  for (const [k, v] of Object.entries(map)) {
    let key = k
    if (letter && /^\d+$/.test(k)) {
      const n = Number(k)
      key = n === 1 ? 'B' : 'A'
      if (!speakerIds.includes(key)) key = speakerIds[n] ?? speakerIds[0] ?? k
    } else if (numeric && /^[A-Z]$/i.test(k)) {
      key = k.toUpperCase() === 'B' ? '1' : '0'
    }
    if (speakerIds.includes(key)) out[key] = v
    else out[k] = v
  }
  return Object.keys(out).length ? out : map
}
