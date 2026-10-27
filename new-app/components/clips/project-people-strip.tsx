'use client'

import type { ClipCardData } from '@/components/clips/clip-grid'

const SPEAKER_COLORS = [
  'var(--speaker-1, #4F7BFF)',
  'var(--speaker-2, #F5A524)',
  'var(--speaker-3, #22C55E)',
  'var(--speaker-4, #EC4899)',
  'var(--speaker-5, #06B6D4)',
]

function personCountFromClip(meta: unknown): number {
  if (!meta || typeof meta !== 'object') return 0
  const m = meta as { nPersons?: number; personCount?: number }
  if (typeof m.nPersons === 'number' && m.nPersons > 0) return Math.min(5, m.nPersons)
  if (typeof m.personCount === 'number' && m.personCount > 0) return Math.min(5, m.personCount)
  return 0
}

export function maxPeopleFound(clips: ClipCardData[]): number {
  let max = 0
  for (const c of clips) {
    max = Math.max(max, personCountFromClip(c.aiMeta))
  }
  return max
}

export function ProjectPeopleStrip({ clips }: { clips: ClipCardData[] }) {
  const n = maxPeopleFound(clips)
  if (n < 1) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
      data-testid="project-people-strip"
    >
      <span className="text-muted-foreground">People found:</span>
      <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="Detected people">
        {Array.from({ length: n }, (_, i) => {
          const label = `P${i + 1}`
          const color = SPEAKER_COLORS[i] ?? SPEAKER_COLORS[0]
          return (
            <span
              key={label}
              role="listitem"
              className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background"
              style={{ backgroundColor: color }}
              title={label}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
