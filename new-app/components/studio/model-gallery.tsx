'use client'

import type { StudioModel } from '../../lib/ai-studio/contract'
import { modelVisual } from '../../lib/ai-studio/catalog'
import { formatCredits, kindLabel, modeLabel, modelOptionSummary } from '../../lib/ai-studio/format'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

export function ModelGallery({
  models,
  selectedId,
  onSelect,
}: {
  models: StudioModel[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (!models.length) {
    return (
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="studio-model-gallery">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }
  return (
    <section className="min-h-0 flex-1 overflow-y-auto p-4" data-testid="studio-model-gallery" aria-label="Models">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {models.map((m) => {
          const vis = modelVisual(m)
          const selected = m.id === selectedId
          return (
            <button
              key={m.id}
              type="button"
              data-model-id={m.id}
              aria-pressed={selected}
              onClick={() => onSelect(m.id)}
              className={cn(
                'flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors',
                'hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                selected ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border',
              )}
            >
              <div className="aspect-video" style={{ background: vis.art }} aria-hidden />
              <div className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{m.label}</span>
                  <Badge variant="secondary">{kindLabel(m.kind)}</Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{vis.blurb}</p>
                <div className="flex flex-wrap gap-1">
                  {m.modes.map((mode) => (
                    <Badge key={mode} variant="outline">
                      {modeLabel(mode)}
                    </Badge>
                  ))}
                  {m.supportsStartEndFrame && <Badge variant="outline">Start/End</Badge>}
                  {m.supportsReferenceImage && <Badge variant="outline">Reference</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {modelOptionSummary(m)}
                  {modelOptionSummary(m) ? ' · ' : ''}
                  from {formatCredits(m.creditEstimate)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
