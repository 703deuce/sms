'use client'

import { useEffect, useRef, useState } from 'react'
import { HypeTimeline } from '@/components/streamer/hype-timeline'
import { StreamerLayoutPill } from '@/components/streamer/streamer-layout-pill'
import { StreamerStageStepper } from '@/components/streamer/stage-stepper'
import { Progress } from '@/components/ui/progress'
import { formatEtaSeconds } from '@/lib/clips/format-eta'
import { getProjectStatus } from '@/lib/clips-api'

type StatusPayload = {
  status: string
  stage?: string | null
  progress?: number
  etaSec?: number
  chunkDone?: number
  chunkTotal?: number
}

export function StreamerProjectChrome({
  vodId,
  projectId,
  stage: initialStage,
  progress: initialProgress,
  projectStatus: initialProjectStatus,
  sourceDeletedAt,
  layout,
}: {
  vodId: string
  projectId: string
  stage?: string | null
  progress?: number
  projectStatus?: string
  sourceDeletedAt?: string | null
  layout?: Record<string, unknown> | null
}) {
  const [stage, setStage] = useState(initialStage)
  const [progress, setProgress] = useState(initialProgress ?? 0)
  const [projectStatus, setProjectStatus] = useState(initialProjectStatus ?? 'QUEUED')
  const [etaSec, setEtaSec] = useState(0)
  const [chunkDone, setChunkDone] = useState<number | undefined>()
  const [chunkTotal, setChunkTotal] = useState<number | undefined>()
  const terminalRef = useRef(['READY', 'FAILED', 'CANCELED'].includes(initialProjectStatus ?? ''))

  useEffect(() => {
    if (terminalRef.current) return
    let stop = false
    const apply = (data: StatusPayload) => {
      setProjectStatus(data.status)
      setStage(data.stage ?? null)
      setProgress(data.progress ?? 0)
      setEtaSec(data.etaSec ?? 0)
      setChunkDone(data.chunkDone)
      setChunkTotal(data.chunkTotal)
      if (['READY', 'FAILED', 'CANCELED'].includes(data.status)) {
        terminalRef.current = true
      }
    }
    const tick = async () => {
      try {
        const data = await getProjectStatus(projectId)
        if (stop) return
        apply(data)
        if (!terminalRef.current) setTimeout(tick, 2500)
      } catch {
        if (!stop && !terminalRef.current) setTimeout(tick, 4000)
      }
    }
    tick()
    return () => {
      stop = true
    }
  }, [projectId])

  useEffect(() => {
    if (terminalRef.current || etaSec <= 0) return
    const t = setInterval(() => setEtaSec((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [etaSec, projectStatus])

  const processing = !['READY', 'FAILED', 'CANCELED'].includes(projectStatus)

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StreamerStageStepper
          stage={stage}
          progress={progress}
          chunkDone={chunkDone}
          chunkTotal={chunkTotal}
        />
        <StreamerLayoutPill projectId={projectId} layout={layout ?? null} />
      </div>
      {processing ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{stage || 'Processing…'}</span>
            {progress > 0 ? <span className="tabular-nums">{progress}%</span> : null}
            {chunkTotal != null && chunkTotal > 0 ? (
              <span className="tabular-nums">
                · {chunkDone ?? 0}/{chunkTotal} chunks
              </span>
            ) : null}
            {etaSec > 0 ? <span className="tabular-nums">· ETA {formatEtaSeconds(etaSec)}</span> : null}
          </div>
          <Progress value={progress} className="h-2" aria-label="Streamer processing progress" />
        </div>
      ) : null}
      {sourceDeletedAt ? (
        <p className="text-xs text-muted-foreground">Source deleted after processing (clips kept)</p>
      ) : null}
      <HypeTimeline vodId={vodId} />
    </div>
  )
}
