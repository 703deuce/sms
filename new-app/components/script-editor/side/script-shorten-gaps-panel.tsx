'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GapFilterMode, GapHit } from '@/lib/clips/script-editor/gap-hits'
import { formatScriptTimecode } from '@/lib/clips/script-editor/sync-playhead'
import { cn } from '@/lib/utils'

export function ScriptShortenGapsPanel({
  gapHits,
  mode,
  onModeChange,
  minGapSec,
  maxGapSec,
  onMinGapSecChange,
  onMaxGapSecChange,
  targetGapSec,
  onTargetGapSecChange,
  activeHitId,
  rangeStartMs,
  onSelectHit,
  onShortenOne,
  onShortenAll,
  onOpenReview,
}: {
  gapHits: GapHit[]
  mode: GapFilterMode
  onModeChange: (m: GapFilterMode) => void
  minGapSec: number
  maxGapSec: number
  onMinGapSecChange: (n: number) => void
  onMaxGapSecChange: (n: number) => void
  targetGapSec: number
  onTargetGapSecChange: (n: number) => void
  activeHitId: string | null
  rangeStartMs: number
  onSelectHit: (hit: GapHit) => void
  onShortenOne: () => void
  onShortenAll: () => void
  onOpenReview: () => void
}) {
  return (
    <div className="flex flex-col gap-3 p-3" data-testid="script-shorten-gaps-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Shorten word gaps</p>
        <Button type="button" size="sm" variant="outline" onClick={onOpenReview}>
          Review bar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="col-span-2 flex flex-col gap-1">
          Mode
          <Select value={mode} onValueChange={(v) => typeof v === 'string' && onModeChange(v as GapFilterMode)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="more_than">More than</SelectItem>
              <SelectItem value="between">Between</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          {mode === 'more_than' ? 'Min gap (s)' : 'From (s)'}
          <Input
            type="number"
            step="0.1"
            className="h-8"
            value={minGapSec}
            onChange={(e) => onMinGapSecChange(Number(e.target.value) || 0)}
          />
        </label>
        {mode === 'between' ? (
          <label className="flex flex-col gap-1">
            To (s)
            <Input
              type="number"
              step="0.1"
              className="h-8"
              value={maxGapSec}
              onChange={(e) => onMaxGapSecChange(Number(e.target.value) || 0)}
            />
          </label>
        ) : (
          <span />
        )}
        <label className="col-span-2 flex flex-col gap-1">
          Shorten to (s)
          <Input
            type="number"
            step="0.05"
            className="h-8"
            value={targetGapSec}
            onChange={(e) => onTargetGapSecChange(Number(e.target.value) || 0)}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{gapHits.length} gaps match</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={!gapHits.length} onClick={onShortenOne}>
          Shorten
        </Button>
        <Button type="button" size="sm" disabled={!gapHits.length} onClick={onShortenAll}>
          Shorten all
        </Button>
      </div>
      <ul className="max-h-[min(32vh,240px)] space-y-1 overflow-y-auto">
        {gapHits.map((hit) => (
          <li key={`${hit.prevWord.id}-${hit.word.id}`}>
            <button
              type="button"
              onClick={() => onSelectHit(hit)}
              className={cn(
                'w-full rounded-md border px-2 py-1.5 text-left text-xs',
                hit.word.id === activeHitId ? 'border-amber-500/60 bg-amber-500/10' : 'border-border hover:bg-muted/40',
              )}
            >
              <span className="font-medium">{(hit.gapMs / 1000).toFixed(1)}s</span>
              <span className="ml-2 text-muted-foreground">
                before “{hit.word.text}” · {formatScriptTimecode(hit.word.t0Ms - rangeStartMs)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
