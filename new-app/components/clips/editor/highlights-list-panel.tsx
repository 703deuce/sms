'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScoreRing } from '@/components/clips/ui/score-ring'
import { formatTimecode } from '@/lib/clips/format'
import { reasonTagLabel } from '@/lib/clips/reason-tag'
import type { HighlightPick, HighlightRange } from '@/lib/clips/editor/highlights'
import { cn } from '@/lib/utils'

export function HighlightsListPanel({
  picks,
  ranges,
  selectedClipId,
  onSelect,
  onMakeClip,
  onMakeAll,
  jobRunning,
}: {
  picks: HighlightPick[]
  ranges: HighlightRange[]
  selectedClipId: string | null
  onSelect: (clipId: string) => void
  onMakeClip: (pick: HighlightPick, range: HighlightRange) => void
  onMakeAll: () => void
  jobRunning?: boolean
}) {
  const [sort, setSort] = useState<'score' | 'time'>('score')
  const byId = useMemo(() => new Map(ranges.map((r) => [r.pick.clipId, r])), [ranges])

  const rows = useMemo(() => {
    const list = picks.map((pick) => ({ pick, range: byId.get(pick.clipId) ?? { pick, startMs: pick.startMs, endMs: pick.endMs } }))
    if (sort === 'time') {
      list.sort((a, b) => a.range.startMs - b.range.startMs || b.pick.score - a.pick.score)
    } else {
      list.sort((a, b) => b.pick.score - a.pick.score || a.range.startMs - b.range.startMs)
    }
    return list
  }, [picks, byId, sort])

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/20 p-3" data-testid="highlights-list-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Highlights</h3>
        <div className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant={sort === 'score' ? 'default' : 'outline'} onClick={() => setSort('score')}>
            Score
          </Button>
          <Button type="button" size="sm" variant={sort === 'time' ? 'default' : 'outline'} onClick={() => setSort('time')}>
            Time
          </Button>
        </div>
      </div>
      {jobRunning && !rows.length ? (
        <p className="text-xs text-muted-foreground">Finding clips…</p>
      ) : null}
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {rows.map(({ pick, range }) => {
          const selected = pick.clipId === selectedClipId
          return (
            <li key={pick.clipId}>
              <button
                type="button"
                data-testid="highlights-list-row"
                className={cn(
                  'flex w-full items-start gap-2 rounded-md border p-2 text-left text-xs transition-colors',
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
                )}
                onClick={() => onSelect(pick.clipId)}
              >
                <ScoreRing score={pick.score} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pick.title}</p>
                  <p className="text-muted-foreground">
                    {formatTimecode(range.startMs)}–{formatTimecode(range.endMs)}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px]">
                    {reasonTagLabel(pick.reasonTag)}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMakeClip(pick, range)
                  }}
                >
                  Make clip
                </Button>
              </button>
            </li>
          )
        })}
      </ul>
      {rows.length ? (
        <Button type="button" size="sm" className="w-full" onClick={() => onMakeAll()} data-testid="highlights-list-make-all">
          Make all
        </Button>
      ) : null}
    </div>
  )
}
