'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/app/page-primitives'
import { ProjectStatusBadge } from '@/components/app/status'
import { DurationChip } from '@/components/clips/ui/duration-chip'
import { useSetBreadcrumbTitle } from '@/components/shell/breadcrumb-context'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { ClipGrid, type ClipCardData } from '@/components/clips/clip-grid'
import { ProjectPeopleStrip } from '@/components/clips/project-people-strip'
import { ClipGridSkeleton } from '@/components/clips/clip-grid-skeleton'
import { ProgressiveClipResults } from '@/components/clips/progressive-clip-results'
import { JobStatus } from '@/components/clips/job-status'
import { ProjectFailedAlert } from '@/components/clips/project-failed-alert'
import { ExportAllDialog } from '@/components/clips/export-all-dialog'
import { exportClipDownload } from '@/lib/clips/export-download-client'
import { getProjectStatus, listProjectClips, retryProject } from '@/lib/clips-api'
import type { ClipProjectSettings } from '@/lib/clips/settings'
import { ProjectProducerPanel } from '@/components/clips/producer/project-producer-panel'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { MontageDialog } from '@/components/streamer/montage-dialog'
import { MontageProgress } from '@/components/streamer/montage-progress'
import { Clapperboard, Film, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'

type ProjectStatusPayload = {
  status: string
  error?: string | null
  clipCount?: number
  clipsReady?: number
  clipsTotal?: number
  etaSec?: number
  stage?: string | null
  progress?: number
}

function clipCountLabel(n: number) {
  return n === 1 ? '1 clip' : `${n} clips`
}

function formatCreatedFallback(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso))
  } catch {
    return ''
  }
}

function ClientCreatedDate({ iso }: { iso: string }) {
  const [text, setText] = useState(() => formatCreatedFallback(iso))
  useEffect(() => {
    try {
      setText(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)))
    } catch {
      setText(formatCreatedFallback(iso))
    }
  }, [iso])
  return (
    <time dateTime={iso} className="text-xs" suppressHydrationWarning>
      {text}
    </time>
  )
}

function pageDescription(status: string, error: string | null) {
  if (status === 'READY') return 'Your clips are ready.'
  if (status === 'FAILED') return error || 'Processing failed.'
  return 'Processing your source video.'
}

export function ProjectClipsView({
  projectId,
  projectTitle,
  initialStatus,
  initialClips,
  initialError,
  fromLink,
  createdAt,
  sourceDurationMs = 0,
  isStreamer = false,
  initialProgress = 0,
  initialStage = null,
  initialEtaSec = 0,
  exportAspect = '9:16' as ClipProjectSettings['aspectRatio'],
}: {
  projectId: string
  projectTitle: string
  initialStatus: string
  initialClips?: ClipCardData[] | null
  initialError?: string | null
  fromLink?: boolean
  createdAt?: string
  sourceDurationMs?: number
  isStreamer?: boolean
  initialProgress?: number
  initialStage?: string | null
  initialEtaSec?: number
  exportAspect?: ClipProjectSettings['aspectRatio']
}) {
  useSetBreadcrumbTitle('project', projectTitle)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`clips-proj-scroll-${projectId}`)
      if (raw != null) {
        const y = Number(raw)
        sessionStorage.removeItem(`clips-proj-scroll-${projectId}`)
        if (Number.isFinite(y)) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
      }
    } catch {
      /* ignore */
    }
  }, [projectId])

  const readyFromServer = initialStatus === 'READY' && initialClips != null
  const [status, setStatus] = useState(initialStatus)
  const [clips, setClips] = useState<ClipCardData[]>(initialClips ?? [])
  const [montagePollKey, setMontagePollKey] = useState(0)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [readyHydrated, setReadyHydrated] = useState(readyFromServer)
  const [progressEtaSec, setProgressEtaSec] = useState(initialEtaSec)
  const [progressStage, setProgressStage] = useState<string | null>(initialStage)
  const [clipsReady, setClipsReady] = useState(0)
  const [clipsTotal, setClipsTotal] = useState(0)

  const refreshClipsList = useCallback(async () => {
    const data = await listProjectClips(projectId, 'score')
    setClips(data.clips as ClipCardData[])
  }, [projectId])

  const replacePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (replacePollRef.current) clearInterval(replacePollRef.current)
    }
  }, [])

  const onClipHidden = useCallback(
    (clipId: string) => {
      setClips((prev) => prev.filter((c) => c.id !== clipId))
      if (replacePollRef.current) clearInterval(replacePollRef.current)
      let attempts = 0
      const tick = async () => {
        attempts += 1
        try {
          await refreshClipsList()
        } catch {
          if (attempts === 2) {
            toast.error('Could not refresh clips — reload the page if your replacement does not appear.')
          }
        }
        if (attempts >= 18) {
          if (replacePollRef.current) clearInterval(replacePollRef.current)
          replacePollRef.current = null
        }
      }
      replacePollRef.current = setInterval(() => void tick(), 4000)
      void tick()
    },
    [refreshClipsList],
  )

  const hydrateReady = useCallback(async (payload: ProjectStatusPayload) => {
    const expected = payload.clipCount ?? 0
    let list: ClipCardData[] = []
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const data = await listProjectClips(projectId, 'score')
      list = data.clips as ClipCardData[]
      if (list.length > 0 || expected === 0 || attempt >= 7) break
      await new Promise((r) => setTimeout(r, 500 + attempt * 400))
    }
    setClips(list)
    setError(payload.error ?? null)
    setStatus('READY')
    setReadyHydrated(true)
  }, [projectId])

  useEffect(() => {
    if (initialStatus === 'READY' && !readyHydrated) {
      void hydrateReady({ status: 'READY' }).catch(() => setReadyHydrated(true))
    }
  }, [initialStatus, readyHydrated, hydrateReady])

  const terminalRef = useRef(readyFromServer || ['READY', 'FAILED', 'CANCELED'].includes(initialStatus))

  useEffect(() => {
    if (readyFromServer) return
    let stop = false
    let attemptsSinceOk = 0
    const pollMs = isStreamer ? 2500 : 4000
    const tick = async () => {
      try {
        let data: ProjectStatusPayload
        try {
          data = await getProjectStatus(projectId)
        } catch (pollErr) {
          if (!stop && !terminalRef.current) {
            if (attemptsSinceOk === 0) {
              console.warn('[clipper:poll] project status failed', pollErr)
            }
            attemptsSinceOk += 1
            setTimeout(tick, pollMs)
          }
          return
        }
        attemptsSinceOk = 0
        if (stop) return
        if (typeof data.etaSec === 'number') setProgressEtaSec(data.etaSec)
        if (data.stage !== undefined) setProgressStage(data.stage ?? null)
        if (typeof data.clipsTotal === 'number') setClipsTotal(data.clipsTotal)
        if (typeof data.clipsReady === 'number') setClipsReady(data.clipsReady)
        const liveClipCount = data.clipCount ?? 0
        if (liveClipCount > 0 || (data.clipsReady ?? 0) > 0) {
          try {
            await refreshClipsList()
          } catch {
            /* ignore transient list errors during reframe */
          }
        }
        const next = data.status
        if (next === 'READY') {
          terminalRef.current = true
          await hydrateReady(data)
          return
        }
        if (next === 'FAILED' || next === 'CANCELED') {
          terminalRef.current = true
        }
        setStatus(next)
        setError(data.error ?? null)
      } catch {
        /* ignore */
      }
      if (!stop && !terminalRef.current) setTimeout(tick, pollMs)
    }
    tick()
    return () => {
      stop = true
    }
  }, [projectId, hydrateReady, readyFromServer, isStreamer, refreshClipsList])

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const onDownload = async (clipId: string) => {
    try {
      const { downloadUrl, filename } = await exportClipDownload(clipId, { aspect: exportAspect })
      triggerDownload(downloadUrl, filename)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    }
  }


  const desc = pageDescription(status, error)
  const showResults = status === 'READY' && readyHydrated
  const processing = !showResults && status !== 'FAILED' && status !== 'CANCELED'
  const showProgressiveClips =
    processing && !isStreamer && (clips.length > 0 || clipsTotal > 0 || clipsReady > 0)
  const failedMsg =
    error?.includes('heavy traffic')
      ? `${error} The upstream model was overloaded (503). Use Retry to re-queue with backoff.`
      : error || 'Something went wrong while processing this project.'

  return (
    <>
      <PageHeader
        icon={Film}
        title={projectTitle}
        description={desc}
        actions={
          showResults ? (
            <Button
              size="sm"
              data-testid="edit-transcript-project"
              onClick={() => {
                try {
                  sessionStorage.setItem(`clips-proj-scroll-${projectId}`, String(window.scrollY))
                } catch {
                  /* ignore */
                }
              }}
              render={<Link href={`/app/clips/${projectId}/script`} />}
            >
              <FileText className="mr-1 size-4" />
              Edit transcript
            </Button>
          ) : null
        }
        meta={
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ProjectStatusBadge status={status} />
            {sourceDurationMs > 0 ? (
              <DurationChip
                ms={sourceDurationMs}
                className="relative rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
              />
            ) : null}
            <span>{clipCountLabel(clips.length)}</span>
            {createdAt ? <ClientCreatedDate iso={createdAt} /> : null}
          </div>
        }
      />
      {status === 'FAILED' ? (
        <Panel title="Project" description="This upload could not be processed.">
          <ProjectFailedAlert
            errorMessage={failedMsg}
            retryAction={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void retryProject(projectId)
                    .then(() => {
                      setStatus('QUEUED')
                      setError(null)
                      toast.success('Processing restarted')
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Retry failed'))
                }}
              >
                Retry processing
              </Button>
            }
          />
        </Panel>
      ) : !showResults ? (
        <div className="flex flex-col gap-6">
          {!isStreamer ? (
            <JobStatus
              projectId={projectId}
              initialStatus={status}
              initialProgress={initialProgress}
              initialStage={initialStage}
              initialEtaSec={initialEtaSec}
              fromLink={fromLink}
            />
          ) : null}
          {showProgressiveClips ? (
            <>
            {!isStreamer && clips.length > 0 ? <ProjectPeopleStrip clips={clips} /> : null}
            <ProgressiveClipResults
              projectId={projectId}
              clips={clips}
              clipsTotal={clipsTotal}
              clipsReady={clipsReady}
              etaSec={progressEtaSec}
              stage={progressStage}
              onDownload={(id) => void onDownload(id)}
              onHidden={onClipHidden}
              cardAspect={exportAspect}
            />
            </>
          ) : processing ? (
            <ClipGridSkeleton />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {isStreamer ? <MontageProgress projectId={projectId} pollKey={montagePollKey} /> : null}
          {!isStreamer && clips.length > 0 ? <ProjectPeopleStrip clips={clips} /> : null}
          <Panel
            title={clipCountLabel(clips.length)}
            description="Sorted by score. Hover a card to preview."
            actions={
              clips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Sheet>
                    <SheetTrigger render={<Button size="sm" variant="outline" />}>
                      <Sparkles className="mr-1 size-4 text-primary" />
                      AI Producer
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-[440px] p-0">
                      <SheetHeader className="border-b border-border p-4">
                        <SheetTitle>Project Producer</SheetTitle>
                      </SheetHeader>
                      <div className="h-[calc(100dvh-5rem)]">
                        <ProjectProducerPanel projectId={projectId} />
                      </div>
                    </SheetContent>
                  </Sheet>
                  <ExportAllDialog projectId={projectId} clips={clips} />
                  {isStreamer ? (
                    <MontageDialog
                      projectId={projectId}
                      clips={clips}
                      onQueued={() => setMontagePollKey((k) => k + 1)}
                    />
                  ) : null}
                </div>
              ) : null
            }
          >
            {clips.length === 0 ? (
              <EmptyState
                icon={Clapperboard}
                title="No clips found"
                description={error || 'No complete, self-contained moments were found in this segment.'}
              />
            ) : (
              <ClipGrid
                clips={clips}
                projectId={projectId}
                onDownload={(id) => void onDownload(id)}
                onHidden={onClipHidden}
                isStreamer={isStreamer}
                cardAspect={exportAspect}
              />
            )}
          </Panel>
        </div>
      )}
    </>
  )
}
