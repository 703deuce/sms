'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { DUB_LANGUAGES } from '@/lib/clips/dub'
import { clipsFetch, exportClipWithOptions, getRenderStatus } from '@/lib/clips-api'

type DubRow = { id: string; targetLang: string; status: string; audioUrl: string | null }

export function ExportDialog({
  clipId,
  title,
  edits,
  dubs = [],
  onAudioTrack,
  open,
  onClose,
}: {
  clipId: string
  title: string
  edits: ClipEditsV2
  dubs?: DubRow[]
  onAudioTrack?: (track: string) => void
  open: boolean
  onClose: () => void
}) {
  const [alsoSrt, setAlsoSrt] = useState(false)
  const [aspect, setAspect] = useState<'9:16' | '1:1' | '16:9'>('9:16')
  const [busy, setBusy] = useState(false)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('clip.mp4')
  const [status, setStatus] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setRenderId(null)
      setDownloadUrl(null)
      setStatus(null)
      setBusy(false)
      setErrorDetail(null)
      setThumbnailUrl(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !edits.thumbnailId) {
      setThumbnailUrl(null)
      return
    }
    void clipsFetch<{ items: { id: string; downloadUrl: string | null }[] }>(
      `/api/clips/clips/${clipId}/thumbnail`,
    )
      .then((data) => {
        const row = data.items.find((i) => i.id === edits.thumbnailId)
        setThumbnailUrl(row?.downloadUrl ?? null)
      })
      .catch(() => setThumbnailUrl(null))
  }, [open, clipId, edits.thumbnailId])

  useEffect(() => {
    if (!renderId || status === 'READY' || status === 'FAILED') return
    const t = setInterval(() => {
      void getRenderStatus(renderId).then((r) => {
        setStatus(r.status)
        if (r.status === 'FAILED' && r.error) {
          setErrorDetail(r.error)
          toast.error(r.error)
        }
        if (r.status === 'READY' && r.downloadUrl) {
          setDownloadUrl(r.downloadUrl)
          setFilename(r.filename)
          setErrorDetail(null)
          toast.success('Export ready — download below')
        }
      })
    }, 2000)
    return () => clearInterval(t)
  }, [renderId, status])

  const startExport = async () => {
    if (busy) return
    setBusy(true)
    setErrorDetail(null)
    const toastId = toast.loading('Starting export…')
    try {
      const data = await exportClipWithOptions(clipId, {
        resolution: '720p',
        aspect,
        watermark: false,
        alsoSrt,
      })
      setRenderId(data.renderId)
      setStatus(data.status)
      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl)
        setFilename(data.filename)
        toast.success('Export ready', { id: toastId })
      } else {
        toast.loading('Rendering…', { id: toastId })
      }
      if (alsoSrt) window.open(`/api/clips/clips/${clipId}/srt`, '_blank')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed'
      setErrorDetail(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-lg focus:outline-none"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg tile-primary">
            <Download className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="export-dialog-title" className="text-lg font-semibold">Export clip</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">720p · captions burned in</p>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium">Aspect ratio</p>
          <div className="mt-1 flex gap-2">
            {(['9:16', '1:1', '16:9'] as const).map((a) => (
              <Button
                key={a}
                size="sm"
                variant={aspect === a ? 'default' : 'outline'}
                onClick={() => setAspect(a)}
              >
                {a}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-xs font-medium">Audio track</p>
          <select
            className="w-full rounded border border-border px-2 py-1 text-xs"
            value={edits.audioTrack || 'original'}
            onChange={(e) => onAudioTrack?.(e.target.value)}
          >
            <option value="original">Original</option>
            {dubs
              .filter((d) => d.status === 'READY')
              .map((d) => (
                <option key={d.id} value={`dub:${d.id}`}>
                  Dub — {DUB_LANGUAGES.find((l) => l.code === d.targetLang)?.label || d.targetLang}
                </option>
              ))}
          </select>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={alsoSrt} onChange={(e) => setAlsoSrt(e.target.checked)} />
          Also download .srt
        </label>
        <p className="mt-2 text-xs text-muted-foreground">No watermark</p>
        {(edits.broll || []).some((b) => b.source === 'ai') && (
          <p className="mt-2 text-xs text-muted-foreground">
            Includes AI-generated B-roll. AI B-roll generated with Kie.ai (Wan 3.0).
          </p>
        )}
        {(edits.audio?.music || (edits.audio?.sfx?.length ?? 0) > 0) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Music and sound effects generated with ElevenLabs
          </p>
        )}
        <MediaCredits clipId={clipId} edits={edits} />
        {status && status !== 'READY' && status !== 'FAILED' && <p className="mt-3 text-sm">Status: {status}…</p>}
        {status === 'FAILED' && errorDetail && (
          <pre className="mt-3 max-h-40 overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 text-xs whitespace-pre-wrap text-destructive">
            {errorDetail}
          </pre>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {!downloadUrl ? (
            <Button onClick={() => void startExport()} disabled={busy}>{busy ? 'Exporting…' : 'Export MP4'}</Button>
          ) : (
            <Button render={<a href={downloadUrl} download={filename} />}>Download MP4</Button>
          )}
          {edits.thumbnailId ? (
            <Button
              variant="outline"
              render={<a href={`/api/clips/thumbnails/${edits.thumbnailId}/download`} />}
              nativeButton={false}
            >
              Download thumbnail
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(title)}>Copy title</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

function MediaCredits({ clipId, edits }: { clipId: string; edits: ClipEditsV2 }) {
  const [lines, setLines] = useState<string[]>([])
  useEffect(() => {
    if (!(edits.broll || []).some((b) => b.source === 'stock')) return
    void fetch(`/api/clips/clips/${clipId}/broll/credits`)
      .then((r) => r.json())
      .then((j) => setLines((j.data?.lines as string[]) || []))
      .catch(() => {})
  }, [clipId, edits.broll])
  if (!lines.length) return null
  const text = lines.join('\n')
  return (
    <div className="mt-3 rounded border border-border p-2 text-xs">
      <p className="font-medium">Media credits</p>
      <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{text}</pre>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => void navigator.clipboard.writeText(text)}>
        Copy credits
      </Button>
    </div>
  )
}
