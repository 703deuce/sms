'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createExportToast } from '@/lib/clips/editor/export-toast'
import { EXPORT_POLL_MAX_ERRORS, startExportStatusPoll } from '@/lib/clips/editor/export-poll'
import {
  activeRenderToResume,
  formatExportProgressLine,
  isRenderInFlight,
  monotonicPct,
  type ExportRenderDetail,
} from '@/lib/clips/editor/export-progress-text'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { displayDurationMs, outputDurationMs, normalizeEditSpeed, type ClipEditsV2 } from '@/lib/clips/edits'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
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
import type { SourceWord } from '@/lib/clips/source-words'
import { clipAspectRatios, type ClipProjectSettings } from '@/lib/clips/settings'
import {
  defaultStreamHeadlineExportTemplate,
  formatHeadlineForExport,
  type ClipExportTemplate,
} from '@/lib/clips/export-template'
import { ExportTemplateSection } from '@/components/clips/editor/export-template-section'
import { applyExportPreferencesToTemplate } from '@/lib/clips/export-preferences'
import {
  loadMergedExportDialogPreferences,
  persistExportDialogPreferences,
} from '@/lib/clips/export-preferences-sync'
import type { ClipUserStreamerChannelRow } from '@/lib/clips/clip-export-user-types'
import { exportPolishLint, exportPolishLintWarnings } from '@/lib/clips/export-polish-lint'
import { logEditorDecision } from '@/lib/clips/editor-decision-log'
import { cn } from '@/lib/utils'
import { t6TitleAutoEnabled } from '@/lib/clips/t6-feature-flags'
import {
  exportSfxBundledAssetsAvailable,
  normalizeExportSfxMode,
  type ExportSfxMode,
} from '@/lib/clips/export-sfx'
import { ExportLayoutPicker } from '@/components/clips/editor/export-layout-picker'
import { resolveLayers } from '@/lib/clips/layers'

type DubRow = { id: string; targetLang: string; status: string; audioUrl: string | null }


/** T6.3: labels for the T6 title chips (title-styles.json ids). */
const T6_TITLE_LABELS: Record<string, string> = {
  white_on_black: 'white on black',
  white_on_dark_blur: 'white on dark blur',
  black_on_light_blur: 'black on light blur',
  white_box_black: 'white box, black text',
}

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
  onLayoutModeChange,
  facecamLayout = null,
  reframeV2Enabled = false,
  exportSurfaceClassName,
  platform,
  defaultChannelUrl,
  chatAvailable = false,
  chatToggleHint,
  words = [],
  onEdits,
  onOpenLayersTab,
  onSilenceTrimChange,
  fullVideo = false,
}: {
  clipId: string
  title: string
  edits: ClipEditsV2
  dubs?: DubRow[]
  onAudioTrack?: (track: string) => void
  onAspectChange?: (aspect: ClipProjectSettings['aspectRatio']) => void
  onBeforeExport?: () => Promise<void>
  layoutMode?: ClipEditsV2['layout']['mode']
  onLayoutModeChange?: (mode: ClipEditsV2['layout']['mode'], facecam?: ClipEditsV2['layout']['facecam']) => void
  facecamLayout?: import('@/lib/server/clips/clip-detail').FacecamLayoutState | null
  reframeV2Enabled?: boolean
  exportSurfaceClassName?: string
  platform?: 'twitch' | 'kick'
  defaultChannelUrl?: string
  chatAvailable?: boolean
  chatToggleHint?: string
  words?: SourceWord[]
  onEdits?: (edits: ClipEditsV2) => void
  onOpenLayersTab?: () => void
  onSilenceTrimChange?: (enabled: boolean) => void
  fullVideo?: boolean
  open: boolean
  onClose: () => void
}) {
  const [alsoSrt, setAlsoSrt] = useState(false)
  const [removeDeadAir, setRemoveDeadAir] = useState(false)
  const [aspect, setAspect] = useState<ClipProjectSettings['aspectRatio']>(
    edits.aspectRatio ?? '9:16',
  )
  const [resolution, setResolution] = useState<'720p' | '1080p'>(() =>
    can('', 'export_1080p') ? '1080p' : '720p',
  )
  const [busy, setBusy] = useState(false)
  const [renderId, setRenderId] = useState<string | null>(null)
  // FV4c: set once Export MP4 was clicked in this open session, so a late active-render lookup
  // never overwrites the render the user just started.
  const exportClickedRef = useRef(false)
  // E2fix: one toast per export, settled on READY / FAILED / poll error, dismissed on close.
  const exportToast = useMemo(() => createExportToast(toast), [])
  useEffect(() => () => exportToast.dismiss(), [exportToast])
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('clip.mp4')
  const [status, setStatus] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [renderProgress, setRenderProgress] = useState<number | null>(null)
  const [renderPhase, setRenderPhase] = useState<string | null>(null)
  const [renderEtaSec, setRenderEtaSec] = useState<number | null>(null)
  const [renderDetail, setRenderDetail] = useState<ExportRenderDetail | null>(null)
  const [exportPlatform, setExportPlatform] = useState<ExportPlatformId | 'none'>('none')
  const [exportTemplate, setExportTemplate] = useState<ClipExportTemplate | undefined>(edits.exportTemplate)
  const [exportSfx, setExportSfx] = useState<ExportSfxMode>('off')
  const sfxBundled = exportSfxBundledAssetsAvailable()
  const [savedChannels, setSavedChannels] = useState<ClipUserStreamerChannelRow[]>([])

  const refreshChannels = () => {
    void clipsFetch<{ channels: ClipUserStreamerChannelRow[] }>('/api/clips/my-channels')
      .then((data) => setSavedChannels(data.channels))
      .catch(() => {})
  }

  useEffect(() => {
    if (!open) return
    refreshChannels()
    void loadMergedExportDialogPreferences().then((prefs) => {
      setRemoveDeadAir(Boolean(edits.silenceTrim?.enabled))
      setAlsoSrt(prefs.alsoSrt)
      setExportSfx(prefs.exportSfx)
      if (fullVideo) {
        const a = edits.aspectRatio ?? '16:9'
        setAspect(a)
        setResolution(can('', 'export_1080p') ? '1080p' : '720p')
        onAspectChange?.(a)
      } else {
        setAspect(prefs.defaultAspect ?? edits.aspectRatio ?? '9:16')
        if (prefs.defaultResolution) setResolution(prefs.defaultResolution)
      }
      if (edits.exportTemplate) {
        const url =
          edits.exportTemplate.channelLink?.url?.trim() ||
          defaultChannelUrl?.trim() ||
          edits.exportTemplate.channelLink?.url ||
          ''
        setExportTemplate({
          ...edits.exportTemplate,
          channelLink: {
            ...edits.exportTemplate.channelLink,
            enabled: edits.exportTemplate.channelLink?.enabled ?? false,
            url,
          },
        })
        return
      }
      if (platform && (platform === 'kick' || platform === 'twitch')) {
        setExportTemplate(
          applyExportPreferencesToTemplate(
            defaultStreamHeadlineExportTemplate({
              platform,
              channelUrl: defaultChannelUrl,
              suggestedHeadline: undefined,
            }),
            prefs,
          ),
        )
        return
      }
      setExportTemplate(edits.exportTemplate)
    })
  }, [open, edits.exportTemplate, edits.aspectRatio, edits.silenceTrim?.enabled, platform, defaultChannelUrl, fullVideo, onAspectChange])

  useEffect(() => {
    if (!open) return
    setRemoveDeadAir(Boolean(edits.silenceTrim?.enabled))
  }, [open, edits.silenceTrim?.enabled])

  useEffect(() => {
    if (!open) {
      exportToast.dismiss()
      setRenderId(null)
      setDownloadUrl(null)
      setStatus(null)
      setBusy(false)
      setErrorDetail(null)
      setThumbnailUrl(null)
      setDurationMs(null)
      setRenderProgress(null)
      setRenderPhase(null)
      setRenderEtaSec(null)
      setRenderDetail(null)
    }
  }, [open, exportToast])

  // FV4c: on open (incl. after a page reload) re-attach to this clip's in-flight export, if any —
  // show "Rendering…" (Export disabled) and resume its % / ETA instead of a fresh Export MP4.
  useEffect(() => {
    if (!open) {
      exportClickedRef.current = false
      return
    }
    let cancelled = false
    void Promise.resolve()
      .then(() => clipsFetch<unknown>(`/api/clips/clips/${clipId}/active-render`))
      .then((data) => {
        const resume = activeRenderToResume(data)
        if (cancelled || !resume || exportClickedRef.current) return
        setRenderId(resume.renderId)
        setStatus(resume.status)
        setDownloadUrl(null)
        setErrorDetail(null)
        logEditorDecision('export_progress', { clipId, renderId: resume.renderId, status: resume.status, resumed: true })
      })
      .catch(() => {
        /* lookup is best-effort; Export MP4 still dedupes server-side by edits hash */
      })
    return () => {
      cancelled = true
    }
  }, [open, clipId])

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
    // E6: READY without a signed URL yet keeps polling (it used to stop there).
    if (!renderId || (status === 'READY' && downloadUrl) || status === 'FAILED') return
    const poller = startExportStatusPoll({
      fetchStatus: () => getRenderStatus(renderId),
      onResult: (r) => {
        if (r.status !== 'FAILED') setErrorDetail(null)
        setStatus(r.status)
        if (typeof r.durationMs === 'number') setDurationMs(r.durationMs)
        // FV4b: never step backwards for the same render (polls can land out of order / on a retry).
        if (typeof r.progress === 'number') setRenderProgress((p) => monotonicPct(p, r.progress))
        if (r.phase) setRenderPhase(r.phase)
        setRenderEtaSec(typeof r.etaSec === 'number' ? r.etaSec : null)
        setRenderDetail(r.detail ?? null)
        logEditorDecision('export_progress', {
          clipId,
          renderId,
          status: r.status,
          progress: r.progress ?? null,
          phase: r.phase ?? null,
          etaSec: r.etaSec ?? null,
        })
        if (r.status === 'FAILED') {
          const msg = r.error || 'Export failed'
          setErrorDetail(msg)
          setBusy(false)
          exportToast.failed(msg)
          return
        }
        if (r.status === 'READY' && r.downloadUrl) {
          setDownloadUrl(r.downloadUrl)
          setFilename(r.filename || 'clip.mp4')
          setErrorDetail(null)
          setBusy(false)
          exportToast.ready()
        }
      },
      onError: (msg, streak) => {
        setErrorDetail(msg)
        // E6: transient poll errors keep polling; only a sustained outage settles the toast.
        if (streak >= EXPORT_POLL_MAX_ERRORS) {
          setBusy(false)
          exportToast.failed(msg)
        }
      },
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') poller.pollNow()
    }
    const onFocus = () => poller.pollNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      poller.stop()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [renderId, status, downloadUrl, clipId, exportToast])

  // FV4b: a render of this clip is still QUEUED / RENDERING — no second Export MP4 click.
  const renderInFlight = isRenderInFlight(renderId, status)
  const startExport = async () => {
    if (busy || renderInFlight) return
    exportClickedRef.current = true
    setBusy(true)
    setErrorDetail(null)
    exportToast.start()
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
      const exportEdits: ClipEditsV2 = {
        ...edits,
        silenceTrim: {
          ...edits.silenceTrim,
          enabled: removeDeadAir,
          minGapMs: edits.silenceTrim?.minGapMs ?? 350,
          keepMs: edits.silenceTrim?.keepMs ?? 120,
        },
        exportTemplate: formattedTpl
          ? {
              ...formattedTpl,
              exportPlatformId:
                exportPlatform !== 'none' ? exportPlatform : formattedTpl.exportPlatformId,
            }
          : formattedTpl,
      }
      onEdits?.(exportEdits)
      logEditorDecision('export_request', {
        clipId,
        resolution: exportPlatform !== 'none' ? EXPORT_PLATFORM_PRESETS[exportPlatform].resolution : resolution,
        aspect: exportPlatform !== 'none' ? EXPORT_PLATFORM_PRESETS[exportPlatform].aspect : aspect,
        exportPlatform: exportPlatform !== 'none' ? exportPlatform : null,
        removeDeadAir,
        exportSfx,
        durationMs: outputDurationMs(exportEdits),
      })
      const data = await exportClipWithOptions(clipId, {
        resolution: exportPlatform !== 'none' ? EXPORT_PLATFORM_PRESETS[exportPlatform].resolution : resolution,
        aspect: exportPlatform !== 'none' ? EXPORT_PLATFORM_PRESETS[exportPlatform].aspect : aspect,
        exportPlatform: exportPlatform !== 'none' ? exportPlatform : undefined,
        watermark: false,
        alsoSrt,
        removeDeadAir,
        exportSfx,
        edits: exportEdits,
      })
      if (data.inFlight) {
        // FV4c: the server handed back the render already in flight for these edits — attach to it.
        toast.info('This export is already rendering — showing its progress.')
      }
      if (data.renderId !== renderId) {
        // FV4b: a new render starts its % / ETA from scratch (the server may also hand back the
        // render already in flight for the same edits — then progress continues).
        setRenderProgress(null)
        setRenderEtaSec(null)
        setRenderDetail(null)
      }
      setRenderId(data.renderId)
      setStatus(data.status)
      if (typeof data.durationMs === 'number') setDurationMs(data.durationMs)
      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl)
        setFilename(data.filename || 'clip.mp4')
        exportToast.ready('Export ready')
      } else {
        setStatus(data.status === 'READY' ? 'READY' : 'RUNNING')
        exportToast.rendering()
      }
      if (alsoSrt) window.open(`/api/clips/clips/${clipId}/srt`, '_blank')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed'
      setErrorDetail(msg)
      exportToast.failed(msg)
    } finally {
      setBusy(false)
    }
  }

  // E4fix: exported length = per-item speed warp + global speed (same as the player clock).
  const editedDurationMs = useMemo(
    () => displayDurationMs(words.length ? { ...editorPreviewEdits(edits, words), speed: edits.speed } : edits),
    [edits, words],
  )
  const platformWarn =
    exportPlatform !== 'none' ? exportPlatformDurationWarning(exportPlatform, editedDurationMs) : null
  const polishLintWarnings = useMemo(() => {
    const items = exportPolishLint(edits, {
      exportPlatform: exportPlatform === 'none' ? null : exportPlatform,
    })
    return exportPolishLintWarnings(items)
  }, [edits, exportPlatform])

  const layerSummary = useMemo(() => {
    try {
      return resolveLayers(edits)
    } catch (e) {
      console.error('[clipper:export] layers_resolve_fail', e)
      return []
    }
  }, [edits])
  const headlineLayer = layerSummary.find((l) => l.id === 'headline' && l.type === 'headline')
  const stickerLayer = layerSummary.find((l) => l.type === 'sticker' && l.kind === 'follow_cta')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className={cn(
          'max-h-[min(90dvh,100%)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-xl border border-border bg-background p-4 shadow-lg focus:outline-none sm:max-h-[90dvh] sm:rounded-xl',
          exportSurfaceClassName,
        )}
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
                  onClick={() => {
                    setResolution(r)
                    persistExportDialogPreferences({ defaultResolution: r })
                  }}
                >
                  {r}
                </Button>
              )
            })}
          </div>
        </div>
        {onLayoutModeChange ? (
          <ExportLayoutPicker
            value={layoutMode}
            edits={edits}
            facecamLayout={facecamLayout}
            reframeV2Enabled={reframeV2Enabled}
            onChange={onLayoutModeChange}
          />
        ) : null}
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
                  persistExportDialogPreferences({ defaultAspect: a })
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
        {polishLintWarnings.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-2" role="note">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">Before you export</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800 dark:text-amber-300">
              {polishLintWarnings.map((w) => (
                <li key={w.id}>{w.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium">Sound effects</p>
          <Select
            value={exportSfx}
            onValueChange={(v) => {
              if (typeof v !== 'string') return
              const mode = normalizeExportSfxMode(v)
              setExportSfx(mode)
              persistExportDialogPreferences({ exportSfx: mode })
            }}
          >
            <SelectTrigger className="w-full" aria-describedby="export-sfx-hint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="subtle">Subtle</SelectItem>
              <SelectItem value="meme">Meme</SelectItem>
            </SelectContent>
          </Select>
          <p id="export-sfx-hint" className="text-xs text-muted-foreground">
            Kenney CC0 SFX on export only. Subtle: quiet whoosh on zoom punches. Meme: whoosh + pops on emphasis (under speech).
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            <Label className="text-sm">Tighten dead air</Label>
            <p className="text-xs text-muted-foreground">Shorten long pauses and cut um/uh (keeps captions in sync).</p>
          </div>
          <Switch
            checked={removeDeadAir}
            onCheckedChange={(c) => {
              const on = Boolean(c)
              setRemoveDeadAir(on)
              onSilenceTrimChange?.(on)
              onEdits?.({
                ...edits,
                silenceTrim: {
                  ...edits.silenceTrim,
                  enabled: on,
                  minGapMs: edits.silenceTrim?.minGapMs ?? 350,
                  keepMs: edits.silenceTrim?.keepMs ?? 120,
                },
              })
              persistExportDialogPreferences({ removeDeadAir: on })
            }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Label className="text-sm">Also download .srt</Label>
          <Switch
            checked={alsoSrt}
            disabled={edits.captions?.enabled === false}
            onCheckedChange={(checked) => {
              const on = Boolean(checked)
              setAlsoSrt(on)
              persistExportDialogPreferences({ alsoSrt: on })
            }}
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
        <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-xs">
          <p className="font-medium text-foreground">Layers (v3)</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            <li data-testid="export-title-style">
              {t6TitleAutoEnabled() ? 'Title style' : 'Headline style'}:{' '}
              {t6TitleAutoEnabled()
                ? // T6.3: the export burns exportTemplate.headlineStyle.t6Id (worker _t6_title_burn).
                  T6_TITLE_LABELS[(exportTemplate ?? edits.exportTemplate)?.headlineStyle?.t6Id ?? ''] ??
                  T6_TITLE_LABELS.white_on_black
                : headlineLayer && headlineLayer.type === 'headline' && headlineLayer.style?.preset
                  ? headlineLayer.style.preset.replace(/_/g, ' ')
                  : 'default'}
            </li>
            {stickerLayer && stickerLayer.type === 'sticker' ? (
              <li>Follow sticker: {stickerLayer.enabled ? stickerLayer.text : 'off'}</li>
            ) : null}
          </ul>
          {onOpenLayersTab ? (
            <Button type="button" size="sm" variant="link" className="mt-1 h-auto px-0" onClick={onOpenLayersTab}>
              Edit in Layers
            </Button>
          ) : null}
        </div>
        <ExportTemplateSection
          clipId={clipId}
          edits={{ ...edits, exportTemplate }}
          layoutMode={layoutMode}
          platform={platform}
          defaultChannelUrl={defaultChannelUrl}
          exportPlatformId={exportPlatform !== 'none' ? exportPlatform : undefined}
          onChange={(tpl) => {
            setExportTemplate(tpl)
            onEdits?.({ ...edits, exportTemplate: tpl })
            persistExportDialogPreferences({
              headlineBarEnabled: Boolean(tpl.headlineBar?.enabled),
              platformBadgeEnabled: Boolean(tpl.platformBadge?.enabled),
              channelLinkEnabled: Boolean(tpl.channelLink?.enabled),
              profanityCensor: Boolean(tpl.profanityCensor),
            })
          }}
          onPatchEdits={(patch) => {
            if (patch.layout?.mode) onLayoutModeChange?.(patch.layout.mode)
            if (patch.layout || patch.chatOverlay) {
              onEdits?.({ ...edits, ...patch })
            }
          }}
          chatAvailable={chatAvailable}
          chatToggleHint={chatToggleHint}
          hideHeadlineControls
          savedChannels={savedChannels}
          onChannelsRefresh={refreshChannels}
        />
        <MediaCredits clipId={clipId} edits={edits} />
        {status === 'READY' && !downloadUrl && (
          <p className="mt-3 text-sm" role="status" aria-live="polite" data-testid="export-finalizing">
            Finalizing download link…
          </p>
        )}
        {status && status !== 'READY' && status !== 'FAILED' && errorDetail ? (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="export-poll-warning">
            Still checking — {errorDetail}
          </p>
        ) : null}
        {status && status !== 'READY' && status !== 'FAILED' && (
          <p className="mt-3 text-sm" role="status" aria-live="polite">
            {formatExportProgressLine({
              status,
              progress: renderProgress,
              phase: renderPhase,
              etaSec: renderEtaSec,
              detail: renderDetail,
            })}
          </p>
        )}
        {renderId && durationMs != null && durationMs > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Clip length: {Math.round(editedDurationMs / 1000)}s
            {(() => {
              const speed = normalizeEditSpeed(edits.speed) ?? 1
              const renderDisplayMs = Math.round(durationMs / speed)
              // E4fix: render durationMs is not speed-warped; skip the hint when per-item speeds are set.
              if (edits.segmentSpeeds?.length) return ''
              return Math.abs(editedDurationMs - renderDisplayMs) > 500
                ? ` (render ${Math.round(renderDisplayMs / 1000)}s)`
                : ''
            })()}
          </p>
        )}
        {!renderId ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Clip length: {Math.round(editedDurationMs / 1000)}s
          </p>
        ) : null}
        {status === 'FAILED' && errorDetail && (
          <pre className="mt-3 max-h-40 overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 text-xs whitespace-pre-wrap text-destructive">
            {errorDetail}
          </pre>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {!downloadUrl ? (
            <Button
              onClick={() => void startExport()}
              disabled={busy || renderInFlight}
              data-testid="export-mp4-button"
              title={renderInFlight ? 'This clip is already rendering — wait for it to finish' : undefined}
            >
              {renderInFlight ? 'Rendering…' : busy ? 'Exporting…' : 'Export MP4'}
            </Button>
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
