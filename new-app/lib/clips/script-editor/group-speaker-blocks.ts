import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { defaultSpeakerColor } from '@/lib/clips/script-editor/to-editor-words'

export type SpeakerBlock = {
  speakerId: string
  speakerLabel: string
  color: string
  startMs: number
  words: EditorWord[]
}

const speakerOrder = new Map<string, number>()

function speakerSortKey(speakerId: string): number {
  const existing = speakerOrder.get(speakerId)
  if (existing !== undefined) return existing
  const next = speakerOrder.size
  speakerOrder.set(speakerId, next)
  return next
}

export function groupSpeakerBlocks(
  words: EditorWord[],
  maxGapMs = 1200,
  speakerLabels?: Record<string, string>,
): SpeakerBlock[] {
  speakerOrder.clear()
  const blocks: SpeakerBlock[] = []
  let cur: EditorWord[] = []
  let curSpeaker = ''

  const flush = () => {
    if (!cur.length) return
    const speakerId = curSpeaker || cur[0].speakerId
    const order = speakerSortKey(speakerId)
    const spkNum = speakerId.replace(/^spk:/, '')
    const defaultLabel = spkNum === '0' ? 'Speaker 1' : `Speaker ${Number(spkNum) + 1}`
    blocks.push({
      speakerId,
      speakerLabel: speakerLabels?.[speakerId]?.trim() || defaultLabel,
      color: defaultSpeakerColor(order),
      startMs: cur[0].t0Ms,
      words: cur,
    })
    cur = []
  }

  for (const w of words) {
    const gap = cur.length ? w.t0Ms - cur[cur.length - 1].t1Ms : 0
    if (cur.length && (w.speakerId !== curSpeaker || gap > maxGapMs)) {
      flush()
    }
    curSpeaker = w.speakerId
    cur.push(w)
  }
  flush()
  return blocks
}
