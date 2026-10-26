/** Literal Tailwind class maps (no dynamic `bg-lane-${x}` — Tailwind v4). */

export const TONE_TILE = {
  brand: 'bg-brand-gradient text-white',
  caption: 'bg-lane-caption/15 text-lane-caption',
  broll: 'bg-lane-broll/15 text-lane-broll',
  music: 'bg-lane-music/15 text-lane-music',
  voice: 'bg-lane-voice/15 text-lane-voice',
  record: 'bg-lane-record/15 text-lane-record',
  ai: 'bg-lane-ai/15 text-lane-ai',
  brandkit: 'bg-lane-brand/15 text-lane-brand',
} as const

export const SPEAKER_CHIP = [
  'bg-speaker-1/15 text-speaker-1',
  'bg-speaker-2/15 text-speaker-2',
  'bg-speaker-3/15 text-speaker-3',
  'bg-speaker-4/15 text-speaker-4',
  'bg-speaker-5/15 text-speaker-5',
  'bg-speaker-6/15 text-speaker-6',
] as const

export type ToneTileKey = keyof typeof TONE_TILE
