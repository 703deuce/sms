'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { CreateStudioControllerOptions } from '../../lib/ai-studio/controller'
import { useAiStudio } from './use-ai-studio'
import { StudioNav } from './studio-nav'
import { StudioControlRail } from './studio-control-rail'
import { HistoryGrid } from './history-grid'
import { ModelGallery } from './model-gallery'
import { AssetDetail } from './asset-detail'
import { Button } from '../ui/button'
import { TooltipProvider } from '../ui/tooltip'

export function AiStudioPage(opts: CreateStudioControllerOptions = {}) {
  const { state, controller } = useAiStudio(opts)
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const detail = useMemo(
    () => (state.detailJobId ? state.history.find((j) => j.id === state.detailJobId) ?? state.activeJob : null),
    [state.detailJobId, state.history, state.activeJob],
  )

  useEffect(() => {
    if (state.detailJobId && state.projectsStatus === 'idle' && state.projects.length === 0) {
      void controller.loadProjects()
    }
  }, [state.detailJobId, state.projectsStatus, state.projects.length, controller])

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-[32rem] flex-col bg-background" data-testid="studio-shell">
        {state.transport === 'dev-fallback' && (
          <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-foreground" role="status">
            Local preview — the Studio API isn’t connected yet. Jobs stay on this device and are not billed.
          </div>
        )}
        {state.modelsStatus === 'error' && (
          <div className="flex items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{state.modelsError?.message || 'Couldn’t load models.'}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void controller.load()}>
              Retry
            </Button>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <StudioNav
            models={state.models}
            mode={state.form.mode}
            resultsView={state.resultsView}
            onSelectMode={(m) => controller.setMode(m)}
            onSelectResults={(v) => controller.setResultsView(v)}
          />
          <StudioControlRail state={state} controller={controller} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            {state.resultsView === 'models' ? (
              <ModelGallery
                models={state.models}
                selectedId={state.form.modelId}
                onSelect={(id) => {
                  controller.setModel(id)
                  controller.setResultsView('history')
                }}
              />
            ) : (
              <HistoryGrid state={state} controller={controller} density={density} onDensity={setDensity} />
            )}
          </div>
        </div>
        <AssetDetail
          job={detail}
          model={detail ? state.models.find((m) => m.id === detail.modelId) : undefined}
          open={!!state.detailJobId}
          onOpenChange={(open) => {
            if (!open) controller.openDetail(null)
          }}
          onReuse={(job) => {
            controller.reuseSettings(job)
            controller.openDetail(null)
          }}
          onSend={(projectId) => {
            if (detail) void controller.sendToTimeline(detail.id, projectId)
          }}
          sending={state.sendingJobId != null}
          sendError={state.sendError?.message ?? null}
          sendResult={state.sendResult}
          projects={state.projects}
          projectsStatus={state.projectsStatus}
          onLoadProjects={() => void controller.loadProjects()}
        />
      </div>
    </TooltipProvider>
  )
}
