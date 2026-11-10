'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Clapperboard, Download, FileText, Loader2, Pause, Play, Redo2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import type { EditorClipShell } from '@/components/clips/editor/editor-clip-shell'
import { editorMediaLoadFallbacks } from '@/lib/server/clips/editor-clip-media'
import { editorIconBtn, editorToolbarDivider, editorToolbarRow, editorToolbarTextBtn } from '@/lib/clips/editor/editor-chrome-tokens'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { buildTemplateCatalog, type CatalogItem, type CatalogTab } from '@/lib/clips/templates/catalog'
import { CatalogTplThumb } from '@/lib/clips/templates/catalog-thumb'
import { applyCatalogToken, parseApplyToken } from '@/lib/clips/templates/apply-from-hub'
import { BRAND_STARTERS } from '@/lib/clips/brand-starters'
import { applyBrandTemplateToEdits, type BrandTemplatePayload } from '@/lib/clips/apply-brand'
import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { applyProjectTemplate, clipsFetch, listProjectClips, patchClip } from '@/lib/clips-api'
import { t6CaptionPresetsEnabled, t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'

type Props = Parameters<typeof EditorClipShell>[0]
type BrandRow = BrandTemplatePayload & { id: string; name: string; isDefault?: boolean }
type GalleryEntry =
  | { key: string; source: 'catalog'; item: CatalogItem }
  | { key: string; source: 'saved_brand'; item: CatalogItem; brand: BrandRow }
type ProjectClipRow = {
  id: string
  projectId: string
  title: string
  startMs: number
  endMs: number
  edits: unknown
}

const TABS: { id: CatalogTab; label: string }[] = [
  { id: 'layouts', label: 'Layouts' },
  { id: 'captions', label: 'Captions' },
  { id: 'looks', label: 'Looks' },
  { id: 'brand', label: 'Brand' },
]
const ASPECTS: NonNullable<ClipEditsV2['aspectRatio']>[] = ['9:16', '1:1', '16:9']

function clock(ms: number) {
  const total = Math.floor(Math.max(0, ms) / 1000)
  return (
    (total >= 3600 ? String(Math.floor(total / 3600)).padStart(2, '0') + ':' : '') +
    String(Math.floor(total / 60) % 60).padStart(2, '0') +
    ':' +
    String(total % 60).padStart(2, '0')
  )
}

function entryKind(entry: GalleryEntry | null) {
  return entry?.source === 'saved_brand' ? 'brand' : entry?.item.kind ?? 'aspect'
}

function entryId(entry: GalleryEntry | null) {
  return entry?.source === 'saved_brand' ? entry.brand.id : entry?.item.id ?? 'aspect'
}

function savedBrandCatalogItem(brand: BrandRow): CatalogItem {
  const palette =
    Array.isArray(brand.palette) && brand.palette.length
      ? brand.palette
      : [brand.settings.primaryColor ?? '#111827', '#f8fafc']
  return {
    kind: 'brand_starter',
    id: 'saved:' + brand.id,
    name: brand.name + (brand.isDefault ? ' · default' : ''),
    tab: 'brand',
    mock: {
      palette,
      captionFont: brand.captionFont ?? 'Inter',
      savedBrandId: brand.id,
    },
  }
}

function disabledReason(item: CatalogItem, edits: ClipEditsV2): string | undefined {
  if (item.disabled) return item.disabled
  if (item.kind === 'look_feature') {
    return 'Open the clip editor Inspector to run background removal.'
  }
  if (item.kind === 'multicam' && (!edits.sourceSegments?.length || !edits.sources?.length)) {
    return 'Add another camera source in the clip editor first.'
  }
  return undefined
}

function applyEntryToEdits(
  base: ClipEditsV2,
  entry: GalleryEntry | null,
  opts: {
    facecamLayout: Props['facecamLayout']
    playheadSourceMs: number
    idPrefix: string
  },
): ClipEditsV2 {
  if (!entry) return base

  if (entry.source === 'saved_brand') {
    return applyBrandTemplateToEdits(base, entry.brand)
  }

  const item = entry.item
  if (item.kind === 'brand_starter') {
    const starter = BRAND_STARTERS.find((candidate) => candidate.id === item.id)
    if (!starter) return base
    return applyBrandTemplateToEdits(base, {
      id: 'starter:' + starter.id,
      settings: starter.settings as BrandTemplatePayload['settings'],
      ...starter.columns,
    })
  }

  const token = parseApplyToken(item.kind + ':' + item.id)
  if (!token) return base
  return applyCatalogToken(base, token, {
    facecamLayout: opts.facecamLayout,
    playheadSourceMs: opts.playheadSourceMs,
    mediaLibrary: [],
    starterOpts: {
      t6Templates: t6TemplatesEnabled(),
      t6Captions: t6CaptionPresetsEnabled(),
      durationMs: Math.max(1000, base.trim.out - base.trim.in),
      newId: () => 'templates-mode:' + opts.idPrefix + ':' + item.id,
    },
  }).edits
}

export function TemplatesEditorShell(props: Props) {
  const { clipId, projectId, bounds } = props
  const words = useMemo(() => loadSourceWords(props.words), [props.words])
  const catalog = useMemo(() => buildTemplateCatalog(), [])
  const counts = useMemo(() => {
    const next: Record<CatalogTab, number> = { layouts: 0, captions: 0, looks: 0, brand: 0 }
    for (const item of catalog) next[item.tab] += 1
    return next
  }, [catalog])

  const [tab, setTab] = useState<CatalogTab>('layouts')
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [brandsError, setBrandsError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<GalleryEntry | null>(null)
  const [hoveredEntry, setHoveredEntry] = useState<GalleryEntry | null>(null)
  const [aspectOverride, setAspectOverride] = useState<ClipEditsV2['aspectRatio'] | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [applyingAll, setApplyingAll] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(props.initialEdits.trim.in)
  const [media, setMedia] = useState(props.primaryMedia)
  const [previewRetryKey, setPreviewRetryKey] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const tried = useRef(new Set<string>())

  const fallbacks = useMemo(
    () =>
      editorMediaLoadFallbacks(props.primaryMedia, props.mediaUrls, {
        sourceSegStartMs: props.sourceSegStartMs,
        sourceSegEndMs: props.sourceSegEndMs,
        clipStartMs: props.clipStartMs,
        clipEndMs: props.clipEndMs,
      }),
    [
      props.primaryMedia,
      props.mediaUrls,
      props.sourceSegStartMs,
      props.sourceSegEndMs,
      props.clipStartMs,
      props.clipEndMs,
    ],
  )
  const videoUrl =
    media?.url ??
    props.mediaUrls.proxy ??
    props.mediaUrls.segment ??
    props.mediaUrls.source ??
    props.mediaUrls.preview
  const posterUrl = props.posterUrl

  const {
    edits,
    setEdits,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    flushSave,
    setLayoutMode,
  } = useEditorState(clipId, bounds, props.initialEdits, {
    serverUpdatedAt: props.serverUpdatedAt,
    editsSaveVersion: props.editsSaveVersion,
    words,
    editorSaveSeq:
      typeof (props.aiMeta as { __editorSaveSeq?: number } | null)?.__editorSaveSeq === 'number'
        ? (props.aiMeta as { __editorSaveSeq: number }).__editorSaveSeq
        : 0,
  })

  const loadBrands = useCallback(async () => {
    console.info('[editor:templates-mode] brand-load-start', { projectId, clipId })
    setBrandsLoading(true)
    setBrandsError(null)
    try {
      const data = await clipsFetch<{ items: BrandRow[] }>('/api/clips/brand/templates')
      setBrands(data.items ?? [])
      console.info('[editor:templates-mode] brand-load-finished', {
        projectId,
        clipId,
        count: data.items?.length ?? 0,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Brand kits could not load'
      setBrandsError(message)
      console.error('[editor:templates-mode] brand-load-failed', { projectId, clipId, message })
    } finally {
      setBrandsLoading(false)
    }
  }, [projectId, clipId])

  useEffect(() => {
    console.info('[editor:templates-mode] edits-hydrate', {
      projectId,
      clipId,
      editsSaveVersion: props.editsSaveVersion,
    })
    console.info('[editor:templates-mode] catalog-built', { projectId, clipId, counts })
  }, [projectId, clipId, props.editsSaveVersion, counts])

  useEffect(() => {
    void loadBrands()
  }, [loadBrands])

  useEffect(() => {
    console.info('[editor:templates-mode] save-state', { projectId, clipId, status: saveState })
  }, [projectId, clipId, saveState])

  const entries = useMemo<GalleryEntry[]>(() => {
    const base = catalog
      .filter((item) => item.tab === tab)
      .map((item) => ({
        key: 'catalog:' + item.kind + ':' + item.id,
        source: 'catalog' as const,
        item,
      }))
    if (tab !== 'brand') return base
    const saved = brands.map((brand) => ({
      key: 'saved-brand:' + brand.id,
      source: 'saved_brand' as const,
      item: savedBrandCatalogItem(brand),
      brand,
    }))
    return [...saved, ...base]
  }, [brands, catalog, tab])

  const activeEntry = hoveredEntry ?? selectedEntry
  const draftEdits = useMemo(() => {
    let next = applyEntryToEdits(edits, activeEntry, {
      facecamLayout: props.facecamLayout,
      playheadSourceMs: playhead,
      idPrefix: clipId,
    })
    if (aspectOverride) next = { ...next, aspectRatio: aspectOverride }
    return next
  }, [edits, activeEntry, props.facecamLayout, playhead, clipId, aspectOverride])
  const previewEdits = useMemo(() => editorPreviewEdits(draftEdits, words), [draftEdits, words])
  const effectiveAspect = draftEdits.aspectRatio ?? '9:16'
  const hasDraftChange = Boolean(selectedEntry || aspectOverride)

  const onMediaError = useCallback(() => {
    if (media?.url) tried.current.add(media.url)
    const next = fallbacks.find((candidate) => !tried.current.has(candidate.url))
    if (next) {
      tried.current.add(next.url)
      setMedia(next)
      console.info('[editor:templates-mode] preview-media-fallback', {
        projectId,
        clipId,
        fallbackFound: true,
      })
      return
    }
    console.error('[editor:templates-mode] preview-media-failed', {
      projectId,
      clipId,
      fallbackFound: false,
    })
  }, [media?.url, fallbacks, projectId, clipId])

  const retryPreview = () => {
    tried.current = new Set()
    setMedia(props.primaryMedia)
    setPreviewRetryKey((value) => value + 1)
    console.info('[editor:templates-mode] preview-retry', {
      projectId,
      clipId,
      hasPrimaryMedia: Boolean(props.primaryMedia?.url),
    })
  }

  const selectEntry = (entry: GalleryEntry) => {
    const reason = disabledReason(entry.item, edits)
    if (reason) {
      toast.message(reason)
      console.info('[editor:templates-mode] template-disabled', {
        projectId,
        clipId,
        kind: entryKind(entry),
        id: entryId(entry),
        reason,
      })
      return
    }
    setSelectedEntry(entry)
    setHoveredEntry(null)
    console.info('[editor:templates-mode] template-previewed', {
      projectId,
      clipId,
      kind: entryKind(entry),
      id: entryId(entry),
    })
  }

  const applyThisClip = () => {
    if (!hasDraftChange) return
    setEdits(draftEdits)
    console.info('[editor:templates-mode] template-applied', {
      projectId,
      clipId,
      kind: entryKind(selectedEntry),
      id: entryId(selectedEntry),
      aspect: draftEdits.aspectRatio ?? null,
    })
    toast.success(selectedEntry ? 'Template applied to this clip' : 'Aspect applied to this clip')
    setAspectOverride(null)
    window.setTimeout(() => {
      void flushSave().catch(() => {
        console.error('[editor:templates-mode] apply-save-failed', { projectId, clipId })
        toast.error('Template applied locally, but saving needs a retry')
      })
    }, 0)
  }

  const applyAll = async () => {
    if (!hasDraftChange || applyingAll) return
    setApplyingAll(true)
    const chosen = selectedEntry
    const chosenKind = entryKind(chosen)
    const chosenId = entryId(chosen)
    console.info('[editor:templates-mode] apply-to-all-start', {
      projectId,
      clipId,
      kind: chosenKind,
      id: chosenId,
      aspectOverride: aspectOverride ?? null,
    })

    try {
      await flushSave()

      if (chosen?.source === 'saved_brand') {
        const result = await applyProjectTemplate(projectId, chosen.brand.id)
        if (aspectOverride) {
          const data = await listProjectClips(projectId, 'timeline', { includeHidden: true })
          const rows = data.clips as ProjectClipRow[]
          for (const row of rows) {
            const base = normalizeEdits(row.edits, {
              clipStartMs: row.startMs,
              clipEndMs: row.endMs,
            })
            console.info('[editor:templates-mode] apply-to-all-clip', {
              projectId,
              clipId,
              targetClipId: row.id,
              step: 'aspect',
            })
            await patchClip(row.id, {
              edits: { ...base, aspectRatio: aspectOverride },
            })
          }
        }
        console.info('[editor:templates-mode] apply-to-all', {
          projectId,
          clipId,
          kind: chosenKind,
          id: chosenId,
          updatedCount: result.updated,
        })
        toast.success('Applied to ' + result.updated + ' clips')
        window.location.reload()
        return
      }

      const data = await listProjectClips(projectId, 'timeline', { includeHidden: true })
      const rows = data.clips as ProjectClipRow[]
      let updated = 0
      for (const row of rows) {
        const base = normalizeEdits(row.edits, {
          clipStartMs: row.startMs,
          clipEndMs: row.endMs,
        })
        let next = applyEntryToEdits(base, chosen, {
          facecamLayout: null,
          playheadSourceMs: row.startMs,
          idPrefix: row.id,
        })
        if (aspectOverride) next = { ...next, aspectRatio: aspectOverride }
        console.info('[editor:templates-mode] apply-to-all-clip', {
          projectId,
          clipId,
          targetClipId: row.id,
          step: updated + 1,
          total: rows.length,
        })
        await patchClip(row.id, { edits: next })
        updated += 1
      }
      console.info('[editor:templates-mode] apply-to-all', {
        projectId,
        clipId,
        kind: chosenKind,
        id: chosenId,
        updatedCount: updated,
      })
      toast.success('Applied to ' + updated + ' clips')
      window.location.reload()
    } catch (error) {
      console.error('[editor:templates-mode] apply-to-all-failed', {
        projectId,
        clipId,
        kind: chosenKind,
        id: chosenId,
        message: error instanceof Error ? error.message : String(error),
      })
      toast.error(error instanceof Error ? error.message : 'Could not apply to all clips')
    } finally {
      setApplyingAll(false)
    }
  }

  const clearPreviewForHistory = () => {
    setSelectedEntry(null)
    setHoveredEntry(null)
    setAspectOverride(null)
  }

  const openTextEditor = async () => {
    console.info('[editor:templates-mode] open-in-text-editor', { projectId, clipId })
    try {
      await flushSave()
    } catch {
      toast.error('Save edits before switching editors')
      return
    }
    window.location.assign(
      routes.text(projectId, clipId, props.clipperStudio ? { from: 'studio' } : undefined),
    )
  }

  const openClipEditor = async () => {
    console.info('[editor:templates-mode] open-in-clip-editor', { projectId, clipId })
    try {
      await flushSave()
    } catch {
      toast.error('Save edits before switching editors')
      return
    }
    window.location.assign(
      props.clipperStudio ? routes.studio(projectId, clipId) : routes.edit(projectId, clipId),
    )
  }

  return (
    <ClipperSurfaceErrorBoundary surface="Templates editor">
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground" data-testid="templates-editor">
        <header className={editorToolbarRow}>
          <Link
            href={routes.project(projectId)}
            className={editorIconBtn}
            aria-label="Back to project clips"
            onClick={() => console.info('[editor:templates-mode] back-to-project', { projectId, clipId })}
          >
            <ArrowLeft />
          </Link>
          <div className="min-w-0">
            <p className="max-w-[220px] truncate text-[10px] text-muted-foreground">{props.projectTitle}</p>
            <h1 className="max-w-[280px] truncate text-xs font-semibold">{props.initialTitle}</h1>
          </div>
          <span className="ml-auto text-[11px] text-muted-foreground" aria-live="polite">
            {saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Saving…'}
          </span>
          {saveState === 'error' ? (
            <Button size="sm" variant="outline" onClick={() => void flushSave().catch(() => toast.error('Save retry failed'))}>
              Retry save
            </Button>
          ) : null}
          <span className={editorToolbarDivider} />
          <button type="button" className={editorIconBtn} disabled={!canUndo} aria-label="Undo" onClick={() => {
            clearPreviewForHistory()
            undo()
            console.info('[editor:templates-mode] undo', { projectId, clipId })
          }}><Undo2 /></button>
          <button type="button" className={editorIconBtn} disabled={!canRedo} aria-label="Redo" onClick={() => {
            clearPreviewForHistory()
            redo()
            console.info('[editor:templates-mode] redo', { projectId, clipId })
          }}><Redo2 /></button>
          <button type="button" className={editorToolbarTextBtn} onClick={() => {
            setExportOpen(true)
            console.info('[editor:templates-mode] export-opened', { projectId, clipId })
          }}><Download />Export</button>
          <button type="button" className={editorToolbarTextBtn} onClick={() => void openTextEditor()}>
            <FileText />Open in text editor
          </button>
          <Button size="sm" onClick={() => void openClipEditor()}>
            <Clapperboard className="mr-1 size-4" />Open in clip editor
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[390px] shrink-0 flex-col border-r border-border bg-card/40 xl:w-[430px]" aria-label="Template gallery">
            <div className="border-b border-border px-4 pb-3 pt-4">
              <h2 className="text-sm font-semibold">Templates</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Hover to preview. Apply writes to this clip&apos;s existing edit document.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Template types">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      tab === item.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    onClick={() => {
                      setTab(item.id)
                      setHoveredEntry(null)
                      console.info('[editor:templates-mode] catalog-tab', { projectId, clipId, tab: item.id })
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'brand' && brandsError ? (
              <div className="m-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium">Saved brand kits could not load</p>
                  <p className="truncate text-[11px] text-muted-foreground">{brandsError}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void loadBrands()}>Retry</Button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {tab === 'brand' && brandsLoading ? (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />Loading saved brand kits…
                </div>
              ) : null}

              {entries.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {entries.map((entry) => {
                    const reason = disabledReason(entry.item, edits)
                    const selected = selectedEntry?.key === entry.key
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        className={cn(
                          'group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all',
                          selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50 hover:shadow-md',
                          reason ? 'cursor-not-allowed opacity-65' : '',
                        )}
                        aria-pressed={selected}
                        disabled={Boolean(reason)}
                        title={reason}
                        onMouseEnter={() => {
                          if (reason) return
                          setHoveredEntry(entry)
                          console.info('[editor:templates-mode] template-previewed', {
                            projectId,
                            clipId,
                            kind: entryKind(entry),
                            id: entryId(entry),
                            via: 'hover',
                          })
                        }}
                        onMouseLeave={() => setHoveredEntry(null)}
                        onClick={() => selectEntry(entry)}
                      >
                        <CatalogTplThumb item={entry.item} />
                        <div className="space-y-1.5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold leading-tight">{entry.item.name}</p>
                            {entry.item.badge ? (
                              <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                                {entry.item.badge}
                              </span>
                            ) : null}
                          </div>
                          {reason ? (
                            <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{reason}</p>
                          ) : selected ? (
                            <p className="text-[10px] font-medium text-primary">Selected</p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Preview on hover</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border bg-background/40 px-6 text-center">
                  <div>
                    <p className="text-sm font-medium">No templates in this section</p>
                    <p className="mt-1 text-xs text-muted-foreground">Choose another tab or retry saved brand kits.</p>
                  </div>
                </div>
              )}
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col bg-background" aria-label="Template preview">
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2">
              <div>
                <h2 className="text-sm font-semibold">Live preview</h2>
                <p className="text-[11px] text-muted-foreground">
                  {activeEntry ? 'Previewing ' + activeEntry.item.name : 'Current clip style'}
                </p>
              </div>
              <div className="flex items-center gap-1.5" aria-label="Aspect ratio">
                {ASPECTS.map((aspect) => (
                  <Button
                    key={aspect}
                    size="sm"
                    variant={effectiveAspect === aspect ? 'default' : 'outline'}
                    onClick={() => {
                      setAspectOverride(aspect)
                      console.info('[editor:templates-mode] aspect-previewed', { projectId, clipId, aspect })
                    }}
                  >
                    {aspect}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/15 p-5">
              {videoUrl ? (
                <PreviewStage
                  key={previewRetryKey}
                  clipId={clipId}
                  videoUrl={videoUrl}
                  posterUrl={posterUrl}
                  edits={previewEdits}
                  words={words}
                  cropTrack={props.cropTrack}
                  brollMedia={props.brollMedia}
                  media={media}
                  videoRef={videoRef}
                  onEditorMediaError={onMediaError}
                  onTick={(tick) => {
                    setPlayhead(tick.sourceMs)
                    setPlaying(tick.playing)
                  }}
                />
              ) : (
                <div className="max-w-sm space-y-3 text-center">
                  <p className="text-sm font-medium">Video preview is unavailable</p>
                  <p className="text-xs text-muted-foreground">
                    Your edits are still intact. Retry the signed media sources for this clip.
                  </p>
                  <Button variant="outline" size="sm" onClick={retryPreview}>Retry preview</Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-2">
              <Button variant="ghost" size="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={() => {
                const video = videoRef.current
                if (!video) return
                if (video.paused) void video.play().catch(() => toast.error('Preview playback unavailable'))
                else video.pause()
              }}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <span className="font-mono text-xs tabular-nums">
                {clock(playhead - draftEdits.trim.in)} / {clock(draftEdits.trim.out - draftEdits.trim.in)}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{effectiveAspect}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/60 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {selectedEntry ? selectedEntry.item.name : aspectOverride ? 'Aspect change' : 'Choose a template'}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Preview changes are not saved until you apply them.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!hasDraftChange || applyingAll} onClick={applyThisClip}>
                  Apply to this clip
                </Button>
                <Button disabled={!hasDraftChange || applyingAll} onClick={() => void applyAll()}>
                  {applyingAll ? (
                    <><Loader2 className="mr-1 size-4 animate-spin" />Applying…</>
                  ) : (
                    'Apply to all clips in this project'
                  )}
                </Button>
              </div>
            </div>
          </main>
        </div>

        <ExportDialog
          clipId={clipId}
          title={props.initialTitle}
          edits={edits}
          words={words}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onBeforeExport={flushSave}
          onEdits={setEdits}
          onAspectChange={(aspect) => setEdits({ ...edits, aspectRatio: aspect })}
          layoutMode={edits.layout.mode}
          onLayoutModeChange={setLayoutMode}
          facecamLayout={props.facecamLayout}
          reframeV2Enabled={props.reframeV2Enabled}
          posterUrl={posterUrl}
          aiMeta={props.aiMeta}
          fullVideo={props.fullVideo}
        />
      </div>
    </ClipperSurfaceErrorBoundary>
  )
}
