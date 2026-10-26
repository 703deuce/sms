'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { ClipGrid, type ClipCardData } from '@/components/clips/clip-grid'
import { JobStatus } from '@/components/clips/job-status'
import { exportClip, exportProjectAll, listProjectClips } from '@/lib/clips-api'
import { Clapperboard } from 'lucide-react'

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
}: {
  projectId: string
  projectTitle: string
  initialStatus: string
  initialClips?: ClipCardData[] | null
  initialError?: string | null
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

  const onExportAll = async () => {
    try {
      const data = await exportProjectAll(projectId)
      for (const item of data.items) {
        if (item.downloadUrl) triggerDownload(item.downloadUrl, item.filename || 'clip.mp4')
      }
      toast.success(`Started ${data.items.length} downloads`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export all failed')
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
          description={error || 'Something went wrong while processing this project.'}
        />
      ) : !showResults ? (
        <JobStatus projectId={projectId} initialStatus={status} />
      ) : (
        <div className="flex flex-col gap-4">
          <Panel
            title={clipCountLabel(clips.length)}
            description="Sorted by score. Hover a card to preview."
            actions={
              clips.length > 0 ? (
                <Button size="sm" variant="outline" onClick={() => void onExportAll()}>Export all</Button>
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
