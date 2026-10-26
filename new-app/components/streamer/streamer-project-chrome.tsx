'use client'

import { HypeTimeline } from '@/components/streamer/hype-timeline'
import { StreamerStageStepper } from '@/components/streamer/stage-stepper'

export function StreamerProjectChrome({
  vodId,
  stage,
  progress,
  sourceDeletedAt,
}: {
  vodId: string
  stage?: string | null
  progress?: number
  sourceDeletedAt?: string | null
}) {
  return (
    <div className="mb-4 space-y-3">
      <StreamerStageStepper stage={stage} progress={progress} />
      {sourceDeletedAt ? (
        <p className="text-xs text-muted-foreground">Source deleted after processing (clips kept)</p>
      ) : null}
      <HypeTimeline vodId={vodId} />
    </div>
  )
}
