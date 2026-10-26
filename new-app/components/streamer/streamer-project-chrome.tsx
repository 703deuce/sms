'use client'

import { HypeTimeline } from '@/components/streamer/hype-timeline'
import { StreamerLayoutPill } from '@/components/streamer/streamer-layout-pill'
import { StreamerStageStepper } from '@/components/streamer/stage-stepper'

export function StreamerProjectChrome({
  vodId,
  projectId,
  stage,
  progress,
  sourceDeletedAt,
  layout,
}: {
  vodId: string
  projectId: string
  stage?: string | null
  progress?: number
  sourceDeletedAt?: string | null
  layout?: Record<string, unknown> | null
}) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StreamerStageStepper stage={stage} progress={progress} />
        <StreamerLayoutPill projectId={projectId} layout={layout ?? null} />
      </div>
      {sourceDeletedAt ? (
        <p className="text-xs text-muted-foreground">Source deleted after processing (clips kept)</p>
      ) : null}
      <HypeTimeline vodId={vodId} />
    </div>
  )
}
