'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { ClipGrid, type ClipCardData } from '@/components/clips/clip-grid'
import { JobStatus } from '@/components/clips/job-status'
import { exportClipDownload } from '@/lib/clips/export-download-client'
import { exportProjectAll, listProjectClips } from '@/lib/clips-api'
import { Clapperboard } from 'lucide-react'

type ProjectStatusPayload = {
  status: string
  error?: string | null
  clipCount?: number
}

export function ProjectResults({ projectId, initialStatus }: { projectId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [clips, setClips] = useState<ClipCardData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [readyHydrated, setReadyHydrated] = useState(initialStatus !== 'READY')

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
      void hydrateReady({ status: 'READY', clipCount: undefined }).catch(() => setReadyHydrated(true))
    }
  }, [initialStatus, readyHydrated, hydrateReady])

  useEffect(() => {
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
  }, [projectId, hydrateReady, status])

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
      await exportClipDownload(clipId)
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

  if (status === 'FAILED') {
    return (
      <EmptyState
        icon={Clapperboard}
        title="Processing failed"
        description={error || 'Something went wrong while processing this project.'}
      />
    )
  }

  if (status !== 'READY' || !readyHydrated) {
    return <JobStatus projectId={projectId} initialStatus={status === 'READY' ? 'RENDERING' : status} />
  }

  const showEmpty = clips.length === 0

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={clips.length === 1 ? '1 clip' : `${clips.length} clips`}
        description="Sorted by score. Hover a card to preview."
        actions={
          clips.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => void onExportAll()}>Export all</Button>
          ) : null
        }
      >
        {showEmpty ? (
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
            onHidden={(id) => setClips((prev) => prev.filter((c) => c.id !== id))}
          />
        )}
      </Panel>
    </div>
  )
}
