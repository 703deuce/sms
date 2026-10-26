'use client'

import { useEffect, useState } from 'react'
import { StepRail } from '@/components/app/step-rail'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { CLIP_JOB_STATE, StatusBadge } from '@/components/app/status'
import { cancelProject, getProjectStatus } from '@/lib/clips-api'
import type { ClipProjectStatusUi } from '@/components/app/status'

const STEPS = ['Upload', 'Transcribe', 'Scan scenes', 'Find clips', 'Reframe & caption', 'Ready']

function stepIndex(status: string, mode?: string) {
  const anything = mode === 'anything'
  if (status === 'UPLOADING' || status === 'DRAFT' || status === 'QUEUED') return 0
  if (status === 'PREPARING' || status === 'TRANSCRIBING') return 1
  if (status === 'SCANNING') return 2
  if (status === 'FINDING_CLIPS') return anything ? 3 : 2
  if (status === 'REFRAMING' || status === 'RENDERING') return anything ? 4 : 3
  if (status === 'READY') return 5
  return 1
}

export function JobStatus({
  projectId,
  initialStatus,
  mode,
}: {
  projectId: string
  initialStatus?: string
  mode?: 'talking' | 'anything' | 'captions'
}) {
  const [status, setStatus] = useState(initialStatus || 'QUEUED')
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [etaSec, setEtaSec] = useState(0)

  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const data = await getProjectStatus(projectId)
        if (stop) return
        setStatus(data.status)
        setProgress(data.progress)
        setStage(data.stage)
        setError(data.error)
        setWordCount(data.wordCount)
        setEtaSec(data.etaSec)
        if (['READY', 'FAILED', 'CANCELED'].includes(data.status)) return
      } catch {
        /* ignore transient */
      }
      if (!stop) setTimeout(tick, 4000)
    }
    tick()
    return () => {
      stop = true
    }
  }, [projectId])

  const ui = CLIP_JOB_STATE[status as ClipProjectStatusUi] ?? CLIP_JOB_STATE.QUEUED
  const terminal = ['READY', 'FAILED', 'CANCELED'].includes(status)

  return (
    <Panel title="Processing" description={stage || 'Working on your video…'}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
          {wordCount > 0 && <span className="text-sm text-muted-foreground">{wordCount} words transcribed</span>}
          {!terminal && etaSec > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">ETA ~{Math.ceil(etaSec / 60)} min</span>
          )}
        </div>
        <StepRail steps={STEPS} current={stepIndex(status, mode)} />
        <Progress value={progress} aria-label="Processing progress" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!terminal && (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => void cancelProject(projectId)}
          >
            Cancel processing
          </Button>
        )}
      </div>
    </Panel>
  )
}
