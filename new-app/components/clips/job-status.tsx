'use client'

import { useEffect, useState } from 'react'
import { CircleStop, Loader2 } from 'lucide-react'
import { ProjectFailedAlert } from '@/components/clips/project-failed-alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ProcessingStepRail } from '@/components/clips/processing-step-rail'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { CLIP_JOB_STATE, StatusBadge } from '@/components/app/status'
import { cancelProject, getProjectStatus } from '@/lib/clips-api'
import type { ClipProjectStatusUi } from '@/components/app/status'

const STEPS_UPLOAD = ['Upload', 'Transcribe', 'Scan scenes', 'Find clips', 'Reframe & caption', 'Ready']
const STEPS_IMPORT = ['Importing', 'Transcribe', 'Scan scenes', 'Find clips', 'Reframe & caption', 'Ready']

function stepIndex(status: string, mode?: string, stage?: string | null, fromLink?: boolean) {
  const anything = mode === 'anything'
  const importing = fromLink && (stage === 'importing' || (status === 'QUEUED' && stage !== 'queued'))
  if (importing) return 0
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
  fromLink,
}: {
  projectId: string
  initialStatus?: string
  mode?: 'talking' | 'anything' | 'captions'
  fromLink?: boolean
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
  const processing = !terminal

  return (
    <Panel title="Processing your video" description={stage || 'Working on your video…'}>
      <div className="flex flex-col gap-4">
        {status === 'FAILED' && (
          <ProjectFailedAlert errorMessage={error || 'Something went wrong. You can try again with a new upload.'} />
        )}
        {processing && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
              {wordCount > 0 && <span className="text-sm text-muted-foreground">{wordCount} words transcribed</span>}
              {etaSec > 0 && (
                <span className="text-sm text-muted-foreground tabular-nums">ETA ~{Math.ceil(etaSec / 60)} min</span>
              )}
            </div>
            <ProcessingStepRail
              steps={fromLink ? STEPS_IMPORT : STEPS_UPLOAD}
              current={stepIndex(status, mode, stage, fromLink)}
            />
            <Progress value={progress} className="h-2 [&_[data-slot=progress-indicator]]:bg-brand-gradient" aria-label="Processing progress" />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
              {stage || 'Processing…'}
            </p>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="ghost" size="sm" className="self-start gap-1.5">
                    <CircleStop className="size-4" aria-hidden />
                    Cancel processing
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel processing?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This project will stop processing. Uploaded media is kept.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep processing</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void cancelProject(projectId)}>Cancel processing</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </Panel>
  )
}
