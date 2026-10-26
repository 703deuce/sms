'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { ClipGrid, type ClipCardData } from '@/components/clips/clip-grid'
import { JobStatus } from '@/components/clips/job-status'
import { ExportAllDialog } from '@/components/clips/export-all-dialog'
import { exportClip, listProjectClips, retryProject } from '@/lib/clips-api'
import { ProjectProducerPanel } from '@/components/clips/producer/project-producer-panel'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Clapperboard, Sparkles } from 'lucide-react'

type ProjectStatusPayload = {
  status: string
  error?: string | null
  clipCount?: number
}

function clipCountLabel(n: number) {
  return n === 1 ? '1 clip' : `${n} clips`
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
}: {
  projectId: string
  projectTitle: string
  initialStatus: string
  initialClips?: ClipCardData[] | null
  initialError?: string | null
  fromLink?: boolean
}) {
  const readyFromServer = initialStatus === 'READY' && initialClips != null
  const [status, setStatus] = useState(initialStatus)
  const [clips, setClips] = useState<ClipCardData[]>(initialClips ?? [])
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [readyHydrated, setReadyHydrated] = useState(readyFromServer)

  const hydrateReady = useCallback(async (payload: ProjectStatusPayload) => {
    const data = await listProjectClips(projectId, 'score')
    const list = data.clips as ClipCardData[]
    setClips(list)
    setError(payload.error ?? null)
    setStatus('READY')
    setReadyHydrated(true)
    if (payload.clipCount !== undefined && payload.clipCount > 0 && list.length === 0) {
      await new Promise((r) => setTimeout(r, 800))
      const retry = await listProjectClips(projectId, 'score')
      setClips(retry.clips as ClipCardData[])
    }
  }, [projectId])

  useEffect(() => {
    if (initialStatus === 'READY' && !readyHydrated) {
      void hydrateReady({ status: 'READY' }).catch(() => setReadyHydrated(true))
    }
  }, [initialStatus, readyHydrated, hydrateReady])

  useEffect(() => {
    if (readyFromServer) return
    let stop = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/clips/projects/${projectId}/status`)
        const json = (await res.json()) as { data?: ProjectStatusPayload }
        if (stop || !json.data) return
        if (json.data.status === 'READY') {
          await hydrateReady(json.data)
        } else {
          setStatus(json.data.status)
          setError(json.data.error ?? null)
        }
      } catch {
        /* ignore */
      }
      if (!stop && !['READY', 'FAILED', 'CANCELED'].includes(status)) {
        setTimeout(tick, 4000)
      }
    }
    tick()
    return () => {
      stop = true
    }
  }, [projectId, hydrateReady, status, readyFromServer])

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
      const data = await exportClip(clipId)
      if (data.downloadUrl) triggerDownload(data.downloadUrl, data.filename || data.download || 'clip.mp4')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    }
  }


  const desc = pageDescription(status, error)
  const showResults = status === 'READY' && readyHydrated

  return (
    <>
      <PageHeader title={projectTitle} description={desc} />
      {status === 'FAILED' ? (
        <EmptyState
          icon={Clapperboard}
          title="Processing failed"
          description={
            error?.includes('heavy traffic')
              ? `${error} The upstream model was overloaded (503). Use Retry to re-queue with backoff.`
              : error || 'Something went wrong while processing this project.'
          }
          action={
            <Button
              size="sm"
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
      ) : !showResults ? (
        <JobStatus projectId={projectId} initialStatus={status} fromLink={fromLink} />
      ) : (
        <div className="flex flex-col gap-4">
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
              <ClipGrid clips={clips} projectId={projectId} onDownload={(id) => void onDownload(id)} />
            )}
          </Panel>
        </div>
      )}
    </>
  )
}
