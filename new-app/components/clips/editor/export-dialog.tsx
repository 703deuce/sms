'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { exportClipWithOptions, getRenderStatus } from '@/lib/clips-api'

export function ExportDialog({
  clipId,
  title,
  open,
  onClose,
}: {
  clipId: string
  title: string
  open: boolean
  onClose: () => void
}) {
  const [alsoSrt, setAlsoSrt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('clip.mp4')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setRenderId(null)
      setDownloadUrl(null)
      setStatus(null)
      setBusy(false)
    }
  }, [open])

  useEffect(() => {
    if (!renderId || status === 'READY') return
    const t = setInterval(() => {
      void getRenderStatus(renderId).then((r) => {
        setStatus(r.status)
        if (r.status === 'READY' && r.downloadUrl) {
          setDownloadUrl(r.downloadUrl)
          setFilename(r.filename)
        }
      })
    }, 2000)
    return () => clearInterval(t)
  }, [renderId, status])

  const startExport = async () => {
    setBusy(true)
    try {
      const data = await exportClipWithOptions(clipId, { resolution: 720, watermark: false, alsoSrt })
      setRenderId(data.renderId)
      setStatus(data.status)
      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl)
        setFilename(data.filename)
      }
      if (alsoSrt) window.open(`/api/clips/clips/${clipId}/srt`, '_blank')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-lg">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="mt-1 text-sm text-muted-foreground">720p · captions burned in</p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={alsoSrt} onChange={(e) => setAlsoSrt(e.target.checked)} />
          Also download .srt
        </label>
        <p className="mt-2 text-xs text-muted-foreground">No watermark</p>
        {status && status !== 'READY' && <p className="mt-3 text-sm">Status: {status}…</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {!downloadUrl ? (
            <Button onClick={() => void startExport()} disabled={busy}>{busy ? 'Exporting…' : 'Export MP4'}</Button>
          ) : (
            <Button render={<a href={downloadUrl} download={filename} />}>Download MP4</Button>
          )}
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(title)}>Copy title</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
