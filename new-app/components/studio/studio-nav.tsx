'use client'

import { Clock3, ImageIcon, LayoutGrid, Video } from 'lucide-react'
import type { StudioMediaKind, StudioMode, StudioModel } from '../../lib/ai-studio/contract'
import { categoriesFromModels } from '../../lib/ai-studio/catalog'
import { kindLabel, modeLabel } from '../../lib/ai-studio/format'
import { cn } from '../../lib/utils'

export function StudioNav({
  models,
  mode,
  resultsView,
  onSelectMode,
  onSelectResults,
}: {
  models: StudioModel[]
  mode: StudioMode
  resultsView: 'history' | 'models'
  onSelectMode: (mode: StudioMode) => void
  onSelectResults: (view: 'history' | 'models') => void
}) {
  const groups = categoriesFromModels(models)
  return (
    <nav
      aria-label="Studio"
      data-testid="studio-category-nav"
      className="flex w-full shrink-0 flex-col gap-5 border-b border-border bg-card/60 px-3 py-4 md:w-52 md:border-r md:border-b-0"
    >
      <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Studio</p>
      <div className="flex flex-col gap-1">
        <p className="px-2 text-xs font-medium text-muted-foreground">Create</p>
        {groups.length === 0 ? (
          <div className="space-y-1.5 px-1">
            <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ) : (
          groups.map((g) => {
            const Icon = g.kind === 'video' ? Video : ImageIcon
            const kindActive = (g.kind === 'image' ? 'text_to_image' : 'text_to_video,image_to_video').includes(mode) && resultsView !== 'models'
            return (
              <div key={g.kind} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  data-nav-kind={g.kind}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors',
                    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    kindActive && resultsView === 'history' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => {
                    onSelectResults('history')
                    onSelectMode(g.modes[0])
                  }}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {kindLabel(g.kind)}
                </button>
                {g.modes.map((m) => {
                  const active = mode === m && resultsView === 'history'
                  return (
                    <button
                      key={m}
                      type="button"
                      data-nav-mode={m}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'rounded-md py-1.5 pr-2 pl-7 text-left text-sm transition-colors',
                        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                        active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                      onClick={() => {
                        onSelectResults('history')
                        onSelectMode(m)
                      }}
                    >
                      {modeLabel(m)}
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="px-2 text-xs font-medium text-muted-foreground">Library</p>
        <button
          type="button"
          data-nav-results="history"
          aria-current={resultsView === 'history' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors',
            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            resultsView === 'history' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
          onClick={() => onSelectResults('history')}
        >
          <Clock3 className="size-3.5" aria-hidden />
          History
        </button>
        <button
          type="button"
          data-nav-results="models"
          aria-current={resultsView === 'models' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors',
            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            resultsView === 'models' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
          onClick={() => onSelectResults('models')}
        >
          <LayoutGrid className="size-3.5" aria-hidden />
          Models
        </button>
      </div>
    </nav>
  )
}

void (0 as unknown as StudioMediaKind)
