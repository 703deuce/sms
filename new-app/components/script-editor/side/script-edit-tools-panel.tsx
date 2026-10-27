'use client'

import { Button } from '@/components/ui/button'
import type { FillerHit } from '@/lib/clips/script-editor/filler-hits'
import type { GapHit } from '@/lib/clips/script-editor/gap-hits'
import { formatScriptTimecode } from '@/lib/clips/script-editor/sync-playhead'
import { ScriptShortenGapsPanel } from '@/components/script-editor/side/script-shorten-gaps-panel'
import { cn } from '@/lib/utils'
import type { GapFilterMode } from '@/lib/clips/script-editor/gap-hits'

export type EditToolsTab = 'filler' | 'gaps'

export function ScriptEditToolsPanel({
  tab,
  onTabChange,
  fillerHits,
  activeFillerHitId,
  gapHits,
  activeGapHitId,
  gapMode,
  onGapModeChange,
  minGapSec,
  maxGapSec,
  onMinGapSecChange,
  onMaxGapSecChange,
  targetGapSec,
  onTargetGapSecChange,
  rangeStartMs,
  onSelectFillerHit,
  onSelectGapHit,
  onOpenFillerReview,
  onOpenGapReview,
  onShortenOne,
  onShortenAll,
}: {
  tab: EditToolsTab
  onTabChange: (t: EditToolsTab) => void
  fillerHits: FillerHit[]
  activeFillerHitId: string | null
  gapHits: GapHit[]
  activeGapHitId: string | null
  gapMode: GapFilterMode
  onGapModeChange: (m: GapFilterMode) => void
  minGapSec: number
  maxGapSec: number
  onMinGapSecChange: (n: number) => void
  onMaxGapSecChange: (n: number) => void
  targetGapSec: number
  onTargetGapSecChange: (n: number) => void
  rangeStartMs: number
  onSelectFillerHit: (hit: FillerHit) => void
  onSelectGapHit: (hit: GapHit) => void
  onOpenFillerReview: () => void
  onOpenGapReview: () => void
  onShortenOne: () => void
  onShortenAll: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="script-edit-tools-panel">
      <div className="flex border-b border-border">
        {(['filler', 'gaps'] as EditToolsTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium',
              tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground',
            )}
          >
            {t === 'filler' ? 'Filler words' : 'Shorten gaps'}
          </button>
        ))}
      </div>
      {tab === 'filler' ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Filler words</p>
            <Button type="button" size="sm" variant="outline" onClick={onOpenFillerReview}>
              Review bar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{fillerHits.length} hits</p>
          <ul className="max-h-[min(40vh,320px)] space-y-1 overflow-y-auto">
            {fillerHits.map((hit) => (
              <li key={hit.word.id}>
                <button
                  type="button"
                  onClick={() => onSelectFillerHit(hit)}
                  className={cn(
                    'w-full rounded-md border px-2 py-1.5 text-left text-xs',
                    hit.word.id === activeFillerHitId
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  <span className="font-medium text-sky-800 dark:text-sky-200">{hit.word.text}</span>
                  <span className="ml-2 text-muted-foreground">
                    {formatScriptTimecode(hit.word.t0Ms - rangeStartMs)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ScriptShortenGapsPanel
          gapHits={gapHits}
          mode={gapMode}
          onModeChange={onGapModeChange}
          minGapSec={minGapSec}
          maxGapSec={maxGapSec}
          onMinGapSecChange={onMinGapSecChange}
          onMaxGapSecChange={onMaxGapSecChange}
          targetGapSec={targetGapSec}
          onTargetGapSecChange={onTargetGapSecChange}
          activeHitId={activeGapHitId}
          rangeStartMs={rangeStartMs}
          onSelectHit={onSelectGapHit}
          onShortenOne={onShortenOne}
          onShortenAll={onShortenAll}
          onOpenReview={onOpenGapReview}
        />
      )}
    </div>
  )
}
