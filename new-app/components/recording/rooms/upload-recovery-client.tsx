'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import {
  deleteTrackLocalData,
  downloadTrackChunksAsBlob,
  listTrackMetaForSession,
  type TrackUploadMeta,
} from '@/lib/recording/chunk-store'
import { TrackUploadManager, type TrackUploadProgress } from '@/lib/recording/track-upload-manager'
import { RoomsUploadCard } from './upload-card'

/** §25 recovery page — resume uploads from IndexedDB after refresh */
export function UploadRecoveryClient({ sessionId }: { sessionId: string }) {
  const [metas, setMetas] = useState<TrackUploadMeta[]>([])
  const [rows, setRows] = useState<TrackUploadProgress[]>([])
  const mgrRef = useRef<TrackUploadManager | null>(null)

  const refreshMetas = useCallback(async () => {
    const list = await listTrackMetaForSession(sessionId)
    setMetas(list)
    return list
  }, [sessionId])

  useEffect(() => {
    mgrRef.current = new TrackUploadManager(sessionId, setRows)
    void refreshMetas().then((list) => {
      for (const m of list) {
        if (!m.finalized) void mgrRef.current?.pump(m.trackId, false)
      }
    })
  }, [sessionId, refreshMetas])

  const resumeAll = async () => {
    const mgr = mgrRef.current ?? new TrackUploadManager(sessionId, setRows)
    for (const m of metas) {
      if (!m.finalized) await mgr.pump(m.trackId, true)
    }
    await refreshMetas()
  }

  const onDownload = async (trackId: string) => {
    const blob = await downloadTrackChunksAsBlob(trackId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trackId}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onDeleteLocal = async (trackId: string) => {
    await deleteTrackLocalData(trackId)
    await refreshMetas()
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Recover your recording</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Files are kept in this browser for up to 7 days. Resume uploads below, then open the editor project.
      </p>
      <RoomsUploadCard
        rows={rows}
        onCopyRecoveryLink={() => navigator.clipboard.writeText(window.location.href)}
      />
      <ul className="w-full max-w-[560px] space-y-2">
        {metas.map((m) => (
          <li
            key={m.trackId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[13px]"
          >
            <span>{m.kind} · {m.displayName ?? m.trackId}</span>
            <span className="font-mono text-xs">{m.finalized ? 'Uploaded' : 'Pending'}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8" onClick={() => onDownload(m.trackId)}>
                Download
              </Button>
              <Button variant="destructive" size="sm" className="h-8" onClick={() => onDeleteLocal(m.trackId)}>
                Delete local copy
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void resumeAll()}>Resume all uploads</Button>
        <PrimaryButton render={<Link href="/app/clips" />}>Return home</PrimaryButton>
      </div>
    </div>
  )
}
