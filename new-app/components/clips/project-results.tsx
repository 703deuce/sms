'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { ClipGrid, type ClipCardData } from '@/components/clips/clip-grid'
import { JobStatus } from '@/components/clips/job-status'
import { exportClip, exportProjectAll, listProjectClips } from '@/lib/clips-api'
import { Clapperboard } from 'lucide-react'

export function ProjectResults({ projectId, initialStatus }: { projectId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [clips, setClips] = useState<ClipCardData[]>([])
  const [error, setError] = useState<string | null>(null)

  const refreshClips = useCallback(async () => {
    const data = await listProjectClips(projectId, 'score')
    setClips(data.clips as ClipCardData[])
  }, [projectId])

  useEffect(() => {
    if (status !== 'READY') return
    void refreshClips().catch(() => {})
  }, [status, refreshClips])

  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/clips/projects/${projectId}/status`)
        const json = (await res.json()) as { data?: { status: string; error?: string | null } }
        if (stop || !json.data) return
        setStatus(json.data.status)
        setError(json.data.error ?? null)
        if (json.data.status === 'READY') await refreshClips()
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
  }, [projectId, refreshClips, status])

  const onDownload = async (clipId: string) => {
    try {
      const data = await exportClip(clipId)
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank', 'noopener')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const onExportAll = async () => {
    try {
      const data = await exportProjectAll(projectId)
      for (const item of data.items) {
        if (item.downloadUrl) window.open(item.downloadUrl, '_blank', 'noopener')
      }
      toast.success(`Opened ${data.items.length} downloads`)
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

  if (status !== 'READY') {
    return <JobStatus projectId={projectId} initialStatus={status} />
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={`${clips.length} clips`}
        description="Sorted by score. Hover a card to preview."
        actions={
          clips.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => void onExportAll()}>Export all</Button>
          ) : null
        }
      >
        {clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clips yet.</p>
        ) : (
          <ClipGrid clips={clips} onDownload={(id) => void onDownload(id)} />
        )}
      </Panel>
    </div>
  )
}
