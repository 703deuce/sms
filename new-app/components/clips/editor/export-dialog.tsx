'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { DUB_LANGUAGES } from '@/lib/clips/dub'
import { can } from '@/lib/billing/entitlements'
import { clipsFetch, exportClipWithOptions, getRenderStatus } from '@/lib/clips-api'
import { exportRequestMatchesClipPreview } from '@/lib/clips/export-preview-reuse'
import {
  EXPORT_PLATFORM_IDS,
  EXPORT_PLATFORM_PRESETS,
  exportPlatformDurationWarning,
  exportPlatformLabel,
  type ExportPlatformId,
} from '@/lib/clips/export-platform-presets'
import { outputDurationMs } from '@/lib/clips/edits'
import { clipAspectRatios, type ClipProjectSettings } from '@/lib/clips/settings'
import { formatHeadlineForExport, type ClipExportTemplate } from '@/lib/clips/export-template'
import { ExportTemplateSection } from '@/components/clips/editor/export-template-section'
import { patchClip } from '@/lib/clips-api'

type DubRow = { id: string; targetLang: string; status: string; audioUrl: string | null }

export function ExportDialog({
  clipId,
  title,
  edits,
  dubs = [],
  onAudioTrack,
  open,
  onClose,
  onAspectChange,
  onBeforeExport,
  layoutMode = 'speaker_follow',
  platform,
  defaultChannelUrl,
}: {
  clipId: string
  title: string
  edits: ClipEditsV2
  dubs?: DubRow[]
  onAudioTrack?: (track: string) => void
  onAspectChange?: (aspect: ClipProjectSettings['aspectRatio']) => void
  onBeforeExport?: () => Promise<void>
  layoutMode?: ClipEditsV2['layout']['mode']
  platform?: 'twitch' | 'kick'
  defaultChannelUrl?: string
  open: boolean
  onClose: () => void
}) {
  const [alsoSrt, setAlsoSrt] = useState(false)
  const [removeDeadAir, setRemoveDeadAir] = useState(true)
  const [aspect, setAspect] = useState<ClipProjectSettings['aspectRatio']>(
    edits.aspectRatio ?? '9:16',
  )
  const [resolution, setResolution] = useState<'720p' | '1080p'>(() =>
    can('', 'export_1080p') ? '1080p' : '720p',
  )
  const [busy, setBusy] = useState(false)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('clip.mp4')
  const [status, setStatus] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [exportPlatform, setExportPlatform] = useState<ExportPlatformId | 'none'>('none')
  const [exportTemplate, setExportTemplate] = useState<ClipExportTemplate | undefined>(edits.exportTemplate)

  useEffect(() => {
    if (open) setExportTemplate(edits.exportTemplate)
  }, [open, edits.exportTemplate])

  useEffect(() => {
    if (open) setAspect(edits.aspectRatio ?? '9:16')
  }, [open, edits.aspectRatio])

  useEffect(() => {
    if (!open) {
      setRenderId(null)
      setDownloadUrl(null)
      setStatus(null)
      setBusy(false)
      setErrorDetail(null)
      setThumbnailUrl(null)
      setDurationMs(null)
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
      void getRenderStatus(renderId)
        .then((r) => {
          setStatus(r.status)
          if (typeof r.durationMs === 'number') setDurationMs(r.durationMs)
          if (r.status === 'FAILED') {
            const msg = r.error || 'Export failed'
            setErrorDetail(msg)
            setBusy(false)
            toast.error(msg)
            return
          }
          if (r.status === 'READY' && r.downloadUrl) {
            setDownloadUrl(r.downloadUrl)
            setFilename(r.filename || 'clip.mp4')
            setErrorDetail(null)
            setBusy(false)
            toast.success('Export ready — download below')
          }
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : 'Could not check export status'
          setErrorDetail(msg)
          setBusy(false)
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
      await onBeforeExport?.()
      const tpl = exportTemplate ?? edits.exportTemplate
      const formattedTpl = tpl?.headlineBar?.enabled && tpl.headlineBar.text
        ? {
            ...tpl,
            headlineBar: {
              ...tpl.headlineBar,
              text: formatHeadlineForExport(tpl.headlineBar.text),
            },
          }
        : tpl
      const exportEdits = {
        ...edits,
        exportTemplate: formattedTpl
          ? {
              ...formattedTpl,
              exportPlatformId:
                exportPlatform !== 'none' ? exportPlatform : formattedTpl.exportPlatformId,
            }
          : formattedTpl,
      }
      await patchClip(clipId, { edits: { exportTemplate: exportEdits.exportTemplate } })
      const data = await exportClipWithOptions(clipId, {
        resolution: exportPlatform !== 'none' ? EXPORT_PLATFORM_PRESETS[exportPlatform].resolution : resolution,
        aspect: exportPlatform !== 'none' ? EXPORT_PLATFORM_PRESETS[exportPlatform].aspect : aspect,
        exportPlatform: exportPlatform !== 'none' ? exportPlatform : undefined,
        watermark: false,
        alsoSrt,
        removeDeadAir,
        edits: exportEdits,
      })
      setRenderId(data.renderId)
      setStatus(data.status)
      if (typeof data.durationMs === 'number') setDurationMs(data.durationMs)
      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl)
        setFilename(data.filename || 'clip.mp4')
        toast.success('Export ready', { id: toastId })
      } else {
        setStatus(data.status === 'READY' ? 'READY' : 'RUNNING')
        toast.loading('Rendering export…', { id: toastId })
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

  const editedDurationMs = outputDurationMs(edits)
  const platformWarn =
    exportPlatform !== 'none' ? exportPlatformDurationWarning(exportPlatform, editedDurationMs) : null

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="max-h-[min(90dvh,100%)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-xl border border-border bg-background p-4 shadow-lg focus:outline-none sm:max-h-[90dvh] sm:rounded-xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg tile-primary">
            <Download className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="export-dialog-title" className="text-lg font-semibold">Export clip</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {resolution}
              {edits.captions?.enabled === false ? ' · captions off' : ' · captions burned in'}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium">Platform preset</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sets 9:16, max length guidance, and caption safe margins for in-app UI.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={exportPlatform === 'none' ? 'default' : 'outline'}
              onClick={() => setExportPlatform('none')}
            >
              Generic
            </Button>
            {EXPORT_PLATFORM_IDS.map((id) => (
              <Button
                key={id}
                size="sm"
                variant={exportPlatform === id ? 'default' : 'outline'}
                onClick={() => {
                  setExportPlatform(id)
                  const preset = EXPORT_PLATFORM_PRESETS[id]
                  setAspect(preset.aspect)
                  if (can('', 'export_1080p') || preset.resolution === '720p') {
                    setResolution(preset.resolution)
                  }
                  onAspectChange?.(preset.aspect)
                }}
              >
                {exportPlatformLabel(id)}
              </Button>
            ))}
          </div>
          {exportPlatform !== 'none' ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Max {EXPORT_PLATFORM_PRESETS[exportPlatform].maxDurationSec}s · caption margin{' '}
              {EXPORT_PLATFORM_PRESETS[exportPlatform].captionSafeMarginVPct}% from bottom · headline
              text below y≈{EXPORT_PLATFORM_PRESETS[exportPlatform].headlineTextMinYPx}px
            </p>
          ) : null}
          {platformWarn ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" role="note">{platformWarn}</p>
          ) : null}
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium">Resolution</p>
          <div className="mt-1 flex gap-2">
            {(['720p', '1080p'] as const).map((r) => {
              const locked = r === '1080p' && !can('', 'export_1080p')
              return (
                <Button
                  key={r}
                  size="sm"
                  variant={resolution === r ? 'default' : 'outline'}
                  disabled={locked}
                  onClick={() => setResolution(r)}
                >
                  {r}
                </Button>
              )
            })}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium">Aspect ratio</p>
          {!exportRequestMatchesClipPreview(aspect, resolution) ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {aspect} at {resolution} re-renders with your edits and burns captions (preview reuse is 9:16 @ 720p only).
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-2 [&_button]:min-h-10">
            {clipAspectRatios.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={aspect === a ? 'default' : 'outline'}
                onClick={() => {
                  setAspect(a)
                  onAspectChange?.(a)
                }}
              >
                {a}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-xs font-medium">Audio track</p>
          <Select
            value={edits.audioTrack || 'original'}
            onValueChange={(v) => typeof v === 'string' && onAudioTrack?.(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              {dubs
                .filter((d) => d.status === 'READY')
                .map((d) => (
                  <SelectItem key={d.id} value={`dub:${d.id}`}>
                    Dub — {DUB_LANGUAGES.find((l) => l.code === d.targetLang)?.label || d.targetLang}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {edits.captions?.enabled === false ? (
          <p className="mt-3 text-xs text-muted-foreground" role="note">
            Captions are disabled for this clip — export will not burn subtitles. Turn captions on in the Captions panel to include them.
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            <Label className="text-sm">Tighten dead air</Label>
            <p className="text-xs text-muted-foreground">Shorten long pauses and cut um/uh (keeps captions in sync).</p>
          </div>
          <Switch checked={removeDeadAir} onCheckedChange={(c) => setRemoveDeadAir(Boolean(c))} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Label className="text-sm">Also download .srt</Label>
          <Switch
            checked={alsoSrt}
            disabled={edits.captions?.enabled === false}
            onCheckedChange={(checked) => setAlsoSrt(Boolean(checked))}
          />
        </div>
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
        <ExportTemplateSection
          clipId={clipId}
          edits={{ ...edits, exportTemplate }}
          layoutMode={layoutMode}
          platform={platform}
          defaultChannelUrl={defaultChannelUrl}
          exportPlatformId={exportPlatform !== 'none' ? exportPlatform : undefined}
          onChange={(tpl) => setExportTemplate(tpl)}
        />
        <MediaCredits clipId={clipId} edits={edits} />
        {status && status !== 'READY' && status !== 'FAILED' && (
          <p className="mt-3 text-sm" role="status" aria-live="polite">
            {status === 'QUEUED' ? 'Queued for rendering…' : 'Rendering export…'}
          </p>
        )}
        {durationMs != null && durationMs > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Clip length: {Math.round(durationMs / 1000)}s
          </p>
        )}
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
