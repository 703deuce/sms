import { CLIP_ANALYSIS_CHUNK_MS, MIN_CLIP_AGENT_SOURCE_MS, clipAnalysisChunks } from '@/lib/youtube-video/chunking'
import type { YoutubeVideoIngestedSource, YoutubeVideoWord } from '@/lib/youtube-video/types'

export type PackedEvent = {
  sourceId: string
  startMs: number
  endMs: number
  text: string
  speakers: string[]
}

export type PackedSource = {
  sourceId: string
  projectId: string
  durationMs: number
  chunkCount: number
  events: PackedEvent[]
  wordCount: number
}

export type PackedTranscript = {
  sources: PackedSource[]
  events: PackedEvent[]
}

const EVENT_GAP_MS = 2500
const MAX_EVENT_CHARS = 400

function wordsInRange(words: YoutubeVideoWord[], startMs: number, endMs: number): YoutubeVideoWord[] {
  return words.filter((word) => {
    const s = Math.round(word.s * 1000)
    const e = Math.round(word.e * 1000)
    return e > startMs && s < endMs
  })
}

function eventsFromWords(sourceId: string, words: YoutubeVideoWord[]): PackedEvent[] {
  const events: PackedEvent[] = []
  let current: PackedEvent | null = null
  for (const word of words) {
    const startMs = Math.round(word.s * 1000)
    const endMs = Math.round(word.e * 1000)
    const spk = word.spk ?? undefined
    if (!current || startMs - current.endMs > EVENT_GAP_MS || (current.text.length >= MAX_EVENT_CHARS && startMs - current.endMs > 400)) {
      if (current) events.push(current)
      current = {
        sourceId,
        startMs,
        endMs,
        text: word.w,
        speakers: spk ? [spk] : [],
      }
    } else {
      current.endMs = endMs
      current.text = `${current.text} ${word.w}`.trim()
      if (spk && !current.speakers.includes(spk)) current.speakers.push(spk)
    }
  }
  if (current) events.push(current)
  return events
}

/** Whole-source view: editor 20-minute chunks, then a global event list. No genre labels. */
export function packTranscripts(sources: YoutubeVideoIngestedSource[]): PackedTranscript {
  const packedSources: PackedSource[] = sources.map((source) => {
    const durationMs = Math.max(source.durationMs, lastWordEndMs(source.words))
    const rangeStart = 0
    const rangeEnd = Math.max(durationMs, MIN_CLIP_AGENT_SOURCE_MS)
    const chunks = durationMs >= MIN_CLIP_AGENT_SOURCE_MS
      ? clipAnalysisChunks(rangeStart, rangeEnd, CLIP_ANALYSIS_CHUNK_MS)
      : [[rangeStart, rangeEnd] as [number, number]]
    const events: PackedEvent[] = []
    for (const [startMs, endMs] of chunks) {
      events.push(...eventsFromWords(source.sourceId, wordsInRange(source.words, startMs, endMs)))
    }
    return {
      sourceId: source.sourceId,
      projectId: source.projectId,
      durationMs,
      chunkCount: chunks.length,
      events,
      wordCount: source.words.length,
    }
  })
  return {
    sources: packedSources,
    events: packedSources.flatMap((source) => source.events),
  }
}

function lastWordEndMs(words: YoutubeVideoWord[]): number {
  if (!words.length) return 0
  return Math.round(words[words.length - 1]!.e * 1000)
}
