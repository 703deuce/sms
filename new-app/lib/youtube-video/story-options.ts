import { assembledDurationMs } from '@/lib/youtube-video/assemble'
import type { PackedEvent, PackedTranscript } from '@/lib/youtube-video/transcript-packer'
import type { YoutubeVideoBeat, YoutubeVideoCut, YoutubeVideoOption } from '@/lib/youtube-video/types'

/**
 * Content-agnostic Story prompts for the copied engine.
 * Do not mention a genre, game, or just-chatting preset. Do not assign an angle.
 */
export const YOUTUBE_VIDEO_STORY_SYSTEM = [
  'You are selecting truthful long-form story options from source material.',
  'Look at the packed events from the entire source or sources first, then propose up to three options that the footage actually supports.',
  'Each option needs a title, a premise, and beats. Find the premise from the source; do not invent drama and do not assign a story angle.',
  'There is no length target. Keep what the story needs.',
  'Return only options the recordings can support.',
].join(' ')

export function assertAgnosticPrompt(text: string): void {
  const banned = [
    'just_chatting_rough_cut',
    'just chatting',
    'irl_just_chatting',
    'gaming-only',
    'this is a gaming',
    'this is a podcast',
  ]
  const lower = text.toLowerCase()
  for (const phrase of banned) {
    if (lower.includes(phrase.toLowerCase())) {
      throw new Error(`genre_specific_prompt_forbidden:${phrase}`)
    }
  }
}

assertAgnosticPrompt(YOUTUBE_VIDEO_STORY_SYSTEM)

function eventText(event: PackedEvent): string {
  return event.text.replace(/\s+/g, ' ').trim()
}

function evidenceFor(event: PackedEvent): string {
  const quote = eventText(event)
  return quote.length > 180 ? `${quote.slice(0, 177)}...` : quote
}

function beatsFromEvents(events: PackedEvent[], take: number): YoutubeVideoBeat[] {
  const picked = pickSpread(events, take)
  return picked.map((event, index) => ({
    label: labelFor(event, index, picked.length),
    startMs: event.startMs,
    endMs: event.endMs,
    sourceId: event.sourceId,
    evidence: evidenceFor(event),
  }))
}

function labelFor(event: PackedEvent, index: number, total: number): string {
  if (index === 0) return 'Premise'
  if (index === total - 1) return 'Payoff'
  return `Beat ${index}`
}

function pickSpread(events: PackedEvent[], take: number): PackedEvent[] {
  if (events.length <= take) return events
  const out: PackedEvent[] = []
  for (let i = 0; i < take; i++) {
    const at = Math.round((i * (events.length - 1)) / (take - 1))
    const event = events[at]!
    if (!out.includes(event)) out.push(event)
  }
  return out
}

function cutsFromBeats(beats: YoutubeVideoBeat[]): YoutubeVideoCut[] {
  return beats
    .filter((beat): beat is YoutubeVideoBeat & { startMs: number; endMs: number; sourceId: string } =>
      beat.startMs != null && beat.endMs != null && !!beat.sourceId,
    )
    .map((beat) => ({
      sourceId: beat.sourceId,
      startMs: beat.startMs,
      endMs: beat.endMs,
      label: beat.label,
    }))
}

function optionFromEvents(id: string, title: string, premise: string, events: PackedEvent[], take: number): YoutubeVideoOption {
  const beats = beatsFromEvents(events, take)
  const estDurationMs = assembledDurationMs(cutsFromBeats(beats))
  return { id, title, premise, beats, estDurationMs }
}

function titleFrom(events: PackedEvent[]): string {
  const first = eventText(events[0] ?? { text: 'Source story', sourceId: '', startMs: 0, endMs: 0, speakers: [] })
  const words = first.split(' ').slice(0, 8).join(' ')
  return words || 'Source story'
}

function premiseFrom(events: PackedEvent[]): string {
  const start = eventText(events[0]!)
  const end = eventText(events[events.length - 1]!)
  return `The recording begins with “${trimQuote(start)}” and ends with “${trimQuote(end)}.”`
}

function trimQuote(text: string): string {
  return text.length > 90 ? `${text.slice(0, 87)}...` : text
}

/**
 * Deterministic, source-grounded options for tests and as a no-model fallback.
 * Premises are taken from the packed events themselves.
 */
export function proposeOptionsFromPacked(packed: PackedTranscript): YoutubeVideoOption[] {
  const events = packed.events.filter((event) => eventText(event).split(' ').length >= 4)
  if (events.length < 2) return []
  const options: YoutubeVideoOption[] = [
    optionFromEvents('opt_full', titleFrom(events), premiseFrom(events), events, Math.min(5, events.length)),
  ]
  if (events.length >= 6) {
    const mid = events.slice(Math.floor(events.length * 0.15), Math.ceil(events.length * 0.9))
    if (mid.length >= 3) {
      options.push(optionFromEvents('opt_tight', titleFrom(mid), premiseFrom(mid), mid, Math.min(4, mid.length)))
    }
  }
  return options
}

export function cutsFromOption(option: YoutubeVideoOption): YoutubeVideoCut[] {
  return cutsFromBeats(option.beats)
}
