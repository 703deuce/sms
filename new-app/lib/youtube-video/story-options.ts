import { assembledDurationMs } from '@/lib/youtube-video/assemble'
import type { PackedEvent, PackedTranscript } from '@/lib/youtube-video/transcript-packer'
import type { YoutubeVideoBeat, YoutubeVideoCut, YoutubeVideoOption } from '@/lib/youtube-video/types'

/** Gaming-specific long-form editorial direction. Only the YouTube engine imports this. */
export const YOUTUBE_VIDEO_STORY_SYSTEM = [
  'You are editing one chronological long-form YouTube gaming playthrough episode from a 1–3 hour stream.',
  'Follow the real in-game story: setup and goal, exploration and travel, attempts, failures, strategy changes, quiet visual-only gameplay, turning points, and eventual payoff.',
  'Preserve the context that makes later results meaningful. A quiet sequence can be essential even when nobody talks. Never choose scenes solely on transcript excitement.',
  'Edit lightly: remove AFK, loading screens, menus, extended repetition or grinding, empty dead air and unrelated off-story chat. Do not compress the story into a highlight reel or isolated short clips.',
  'Aim for roughly 25–35 percent of source running time and a coherent 15–40 minute finished episode, using those durations as editorial guidance rather than hard failure gates.',
  'Keep scenes and objectives in their recorded chronological order, including a real beginning, progression, and payoff. Do not fabricate outcomes or force an ending when none exists.',
  'Any optional user instruction identifies which recorded story to preserve; it supplements these rules and does not replace them.',
].join(' ')


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
