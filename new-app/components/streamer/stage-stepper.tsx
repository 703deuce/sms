'use client'

const STAGES = ['Downloading audio', 'Transcribing', 'Finding moments', 'Rendering'] as const

function stageIndex(stage: string | null | undefined): number {
  const s = (stage ?? '').toLowerCase()
  if (s.includes('render')) return 3
  if (s.includes('find') || s.includes('picker')) return 2
  if (s.includes('transcri')) return 1
  if (s.includes('download') || s.includes('prepar')) return 0
  return -1
}

export function StreamerStageStepper({
  stage,
  progress,
  chunkDone,
  chunkTotal,
}: {
  stage?: string | null
  progress?: number
  chunkDone?: number
  chunkTotal?: number
}) {
  const active = stageIndex(stage)
  if (active < 0) return null
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STAGES.map((label, i) => {
        const done = i < active
        const current = i === active
        return (
          <li
            key={label}
            className={
              current
                ? 'font-medium text-foreground'
                : done
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground/50'
            }
          >
            {done ? '✓ ' : current ? '● ' : '○ '}
            {label}
            {current && progress != null ? ` (${progress}%)` : ''}
            {current && chunkTotal != null && chunkTotal > 0 ? ` · ${chunkDone ?? 0}/${chunkTotal}` : ''}
          </li>
        )
      })}
    </ol>
  )
}
