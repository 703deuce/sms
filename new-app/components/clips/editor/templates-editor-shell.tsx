'use client'

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
import { canonicalEditsJson, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { clipStyleSettingsFromEdits } from '@/lib/clips/brand'
import { BRAND_FONTS } from '@/lib/clips/brand-kit'
import { clipsFetch, listProjectClips, patchClip } from '@/lib/clips-api'
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
type CaptionDraft = {
  font?: string
  size?: number
  userSizePct?: number
  position?: string
  case?: string
  wordsPerLine?: number
  colors?: { a?: string; b?: string }
  activeStyle?: 'color' | 'highlight' | 'fill'
  highlightColor?: string
}
type HandoffTarget = 'project' | 'text' | 'clip' | 'export'
type BulkResult = { updated: number; skipped: number; errors: number }

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

function entrySearchText(entry: GalleryEntry) {
  return [entry.item.name, entry.item.id, entry.item.kind, entry.item.tab, JSON.stringify(entry.item.mock)]
    .join(' ')
    .toLowerCase()
}

function captionDraftFields(draft: CaptionDraft) {
  const fields = Object.keys(draft).filter((key) => key !== 'colors')
  if (draft.colors?.a !== undefined) fields.push('colors.a')
  if (draft.colors?.b !== undefined) fields.push('colors.b')
  return fields.sort()
}

function applyCaptionDraft(base: ClipEditsV2, draft: CaptionDraft): ClipEditsV2 {
  if (!captionDraftFields(draft).length) return base
  return {
    ...base,
    captions: {
      ...base.captions,
      ...draft,
      ...(draft.colors
        ? { colors: { ...base.captions.colors, ...draft.colors } }
        : {}),
    },
  }
}

function reusablePalette(edits: ClipEditsV2) {
  return [edits.captions.colors?.a, edits.captions.colors?.b]
    .filter((value): value is string => Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value)))
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 5)
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
  const [searchQuery, setSearchQuery] = useState('')
  const [captionDraft, setCaptionDraft] = useState<CaptionDraft>({})
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [handoffTarget, setHandoffTarget] = useState<HandoffTarget | null>(null)
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
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

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return entries
    return entries.filter((entry) => entrySearchText(entry).includes(query))
  }, [entries, searchQuery])

  useEffect(() => {
    console.info('[editor:templates-gaps] filter', {
      projectId,
      clipId,
      category: tab,
      queryActive: Boolean(searchQuery.trim()),
      count: filteredEntries.length,
    })
  }, [projectId, clipId, tab, searchQuery, filteredEntries.length])

  const activeEntry = hoveredEntry ?? selectedEntry
  const customFieldNames = useMemo(() => captionDraftFields(captionDraft), [captionDraft])
  useEffect(() => {
    if (!customFieldNames.length) return
    console.info('[editor:templates-gaps] customization', {
      projectId,
      clipId,
      fieldNames: customFieldNames,
    })
  }, [projectId, clipId, customFieldNames])

  const draftEdits = useMemo(() => {
    let next = applyEntryToEdits(edits, activeEntry, {
      facecamLayout: props.facecamLayout,
      playheadSourceMs: playhead,
      idPrefix: clipId,
    })
    if (aspectOverride) next = { ...next, aspectRatio: aspectOverride }
    next = applyCaptionDraft(next, captionDraft)
    return next
  }, [edits, activeEntry, props.facecamLayout, playhead, clipId, aspectOverride, captionDraft])
  const previewEdits = useMemo(() => editorPreviewEdits(draftEdits, words), [draftEdits, words])
  const effectiveAspect = draftEdits.aspectRatio ?? '9:16'
  const hasDraftChange = useMemo(
    () => canonicalEditsJson(draftEdits) !== canonicalEditsJson(edits),
    [draftEdits, edits],
  )
  const hasLocalPreviewState = Boolean(selectedEntry || hoveredEntry || aspectOverride || customFieldNames.length)
  const cpCaptionSize = Boolean(draftEdits.captions.presetId?.startsWith('cp'))
  const captionSize = cpCaptionSize
    ? draftEdits.captions.userSizePct ?? draftEdits.captions.size ?? 6.5
    : draftEdits.captions.size ?? 6.5
  const fontOptions = useMemo(
    () => Array.from(new Set([draftEdits.captions.font, ...BRAND_FONTS].filter((font): font is string => Boolean(font)))),
    [draftEdits.captions.font],
  )
  const reusableUnsupported = Boolean(
    captionDraft.highlightColor !== undefined ||
      captionDraft.userSizePct !== undefined ||
      draftEdits.captions.activeStyle === 'highlight' ||
      draftEdits.captions.activeStyle === 'fill' ||
      (cpCaptionSize && draftEdits.captions.userSizePct != null),
  )

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

  const clearPreviewForHistory = () => {
    setSelectedEntry(null)
    setHoveredEntry(null)
    setAspectOverride(null)
    setCaptionDraft({})
  }

  const cancelPreview = (source: 'button' | 'history' | 'handoff' = 'button') => {
    clearPreviewForHistory()
    setBulkResult(null)
    console.info('[editor:templates-gaps] cancel-preview', {
      projectId,
      clipId,
      source,
      scope: 'local-preview-only',
    })
  }

  const applyThisClip = async () => {
    if (!hasDraftChange) return
    const chosen = activeEntry
    console.info('[editor:templates-gaps] apply-start', {
      projectId,
      clipId,
      scope: 'clip',
      category: chosen?.item.tab ?? tab,
      templateId: entryId(chosen),
      fieldNames: customFieldNames,
    })
    setEdits(draftEdits)
    try {
      await flushSave()
      console.info('[editor:templates-gaps] apply-finished', {
        projectId,
        clipId,
        scope: 'clip',
        updated: 1,
        skipped: 0,
        errors: 0,
      })
      toast.success(chosen ? 'Template styling applied to this clip' : 'Style changes applied to this clip')
      cancelPreview('button')
    } catch {
      console.error('[editor:templates-gaps] apply-failed', {
        projectId,
        clipId,
        scope: 'clip',
        updated: 0,
        skipped: 0,
        errors: 1,
      })
      toast.error('Style is still local; saving needs a retry')
    }
  }

  const applyAll = async () => {
    if (!hasDraftChange || applyingAll) return
    setApplyingAll(true)
    setBulkResult(null)
    const chosen = activeEntry
    const chosenKind = entryKind(chosen)
    const chosenId = entryId(chosen)
    const chosenAspect = aspectOverride
    const chosenCaptionDraft = captionDraft
    const currentDraft = draftEdits
    console.info('[editor:templates-gaps] apply-start', {
      projectId,
      clipId,
      scope: 'project',
      category: chosen?.item.tab ?? tab,
      templateId: chosenId,
      fieldNames: customFieldNames,
    })

    try {
      await flushSave()
      setEdits(currentDraft)
      await flushSave()

      const data = await listProjectClips(projectId, 'timeline', { includeHidden: true })
      const rows = data.clips as ProjectClipRow[]
      let updated = 1
      let skipped = 0
      let errors = 0

      for (const row of rows) {
        if (row.id === clipId) continue
        const base = normalizeEdits(row.edits, {
          clipStartMs: row.startMs,
          clipEndMs: row.endMs,
        })
        const reason = chosen ? disabledReason(chosen.item, base) : undefined
        if (reason) {
          skipped += 1
          console.info('[editor:templates-gaps] apply-clip-skipped', {
            projectId,
            clipId,
            targetClipId: row.id,
            reason,
          })
          continue
        }
        let next = applyEntryToEdits(base, chosen, {
          facecamLayout: null,
          playheadSourceMs: row.startMs,
          idPrefix: row.id,
        })
        if (chosenAspect) next = { ...next, aspectRatio: chosenAspect }
        next = applyCaptionDraft(next, chosenCaptionDraft)
        if (canonicalEditsJson(next) === canonicalEditsJson(base)) {
          skipped += 1
          console.info('[editor:templates-gaps] apply-clip-skipped', {
            projectId,
            clipId,
            targetClipId: row.id,
            reason: 'already-matches',
          })
          continue
        }
        try {
          await patchClip(row.id, { edits: next })
          updated += 1
        } catch {
          errors += 1
          console.error('[editor:templates-gaps] apply-clip-error', {
            projectId,
            clipId,
            targetClipId: row.id,
          })
        }
      }

      const result = { updated, skipped, errors }
      setBulkResult(result)
      console.info('[editor:templates-gaps] apply-finished', {
        projectId,
        clipId,
        scope: 'project',
        kind: chosenKind,
        templateId: chosenId,
        ...result,
      })
      toast.success(
        'Project style apply: ' +
          updated +
          ' updated' +
          (skipped ? ', ' + skipped + ' skipped' : '') +
          (errors ? ', ' + errors + ' errors' : ''),
      )
      if (!errors) {
        clearPreviewForHistory()
        console.info('[editor:templates-gaps] cancel-preview', {
          projectId,
          clipId,
          source: 'button',
          scope: 'applied-project-preview',
        })
      }
    } catch (error) {
      console.error('[editor:templates-gaps] apply-failed', {
        projectId,
        clipId,
        scope: 'project',
        kind: chosenKind,
        templateId: chosenId,
        errors: 1,
        message: error instanceof Error ? error.message : String(error),
      })
      toast.error(error instanceof Error ? error.message : 'Could not apply style to project')
    } finally {
      setApplyingAll(false)
    }
  }

  const saveReusableStyle = async () => {
    const name = presetName.trim()
    if (!name) {
      toast.error('Enter a reusable style name')
      return
    }
    if (reusableUnsupported) {
      toast.error('This draft uses caption fields the current reusable brand-style model cannot store faithfully')
      return
    }
    setSavingPreset(true)
    try {
      const palette = reusablePalette(draftEdits)
      const data = await clipsFetch<{ template: BrandRow }>('/api/clips/brand/templates', {
        method: 'POST',
        body: JSON.stringify({
          name,
          settings: clipStyleSettingsFromEdits(draftEdits),
          captionFont: draftEdits.captions.font ?? null,
          palette: palette.length ? palette : null,
        }),
      })
      await loadBrands()
      setTab('brand')
      setSearchQuery('')
      setPresetName('')
      console.info('[editor:templates-gaps] preset-saved', {
        projectId,
        clipId,
        presetId: data.template.id,
      })
      toast.success('Reusable style saved. Applying it is a separate action.')
    } catch (error) {
      console.error('[editor:templates-gaps] preset-save-failed', {
        projectId,
        clipId,
        message: error instanceof Error ? error.message : String(error),
      })
      toast.error(error instanceof Error ? error.message : 'Could not save reusable style')
    } finally {
      setSavingPreset(false)
    }
  }

  const navigateAfterSave = (target: HandoffTarget) => {
    if (target === 'export') {
      setExportOpen(true)
      console.info('[editor:templates-mode] export-opened', { projectId, clipId })
      return
    }
    if (target === 'project') {
      console.info('[editor:templates-mode] back-to-project', { projectId, clipId })
      window.location.assign(routes.project(projectId))
      return
    }
    if (target === 'text') {
      console.info('[editor:templates-mode] open-in-text-editor', { projectId, clipId })
      window.location.assign(
        routes.text(projectId, clipId, props.clipperStudio ? { from: 'studio' } : undefined),
      )
      return
    }
    console.info('[editor:templates-mode] open-in-clip-editor', { projectId, clipId })
    console.info('[editor:compact-mode] open-from-templates', {
      projectId,
      clipId,
      target: props.clipperStudio ? 'studio' : 'edit',
    })
    window.location.assign(
      props.clipperStudio ? routes.studio(projectId, clipId) : routes.edit(projectId, clipId),
    )
  }

  const finishHandoff = async (target: HandoffTarget) => {
    try {
      await flushSave()
    } catch {
      toast.error('Save edits before leaving Templates')
      return
    }
    console.info('[editor:templates-gaps] handoff', {
      projectId,
      clipId,
      target,
      scope: 'saved-edit',
    })
    navigateAfterSave(target)
  }

  const requestHandoff = (target: HandoffTarget) => {
    if (hasDraftChange) {
      setHandoffTarget(target)
      console.info('[editor:templates-gaps] handoff-pending', {
        projectId,
        clipId,
        target,
        scope: 'clip-preview',
      })
      return
    }
    void finishHandoff(target)
  }

  const applyPendingAndContinue = async () => {
    if (!handoffTarget || handoffBusy) return
    const target = handoffTarget
    setHandoffBusy(true)
    console.info('[editor:templates-gaps] handoff-choice', {
      projectId,
      clipId,
      target,
      scope: 'apply-this-clip',
    })
    setEdits(draftEdits)
    try {
      await flushSave()
      cancelPreview('handoff')
      setHandoffTarget(null)
      navigateAfterSave(target)
    } catch {
      console.error('[editor:templates-gaps] handoff-apply-failed', {
        projectId,
        clipId,
        target,
      })
      toast.error('Could not save the applied preview. Your local draft is still here.')
    } finally {
      setHandoffBusy(false)
    }
  }

  const discardPendingAndContinue = async () => {
    if (!handoffTarget || handoffBusy) return
    const target = handoffTarget
    console.info('[editor:templates-gaps] handoff-choice', {
      projectId,
      clipId,
      target,
      scope: 'discard-preview',
    })
    cancelPreview('handoff')
    setHandoffTarget(null)
    await finishHandoff(target)
  }

  return (
    <ClipperSurfaceErrorBoundary surface="Templates editor">
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground" data-testid="templates-editor">
        <header className={editorToolbarRow}>
          <button
            type="button"
            className={editorIconBtn}
            aria-label="Back to project clips"
            onClick={() => requestHandoff('project')}
          >
            <ArrowLeft />
          </button>
          <div className="min-w-0">
            <p className="max-w-[220px] truncate text-[10px] text-muted-foreground">{props.projectTitle}</p>
            <h1 className="max-w-[280px] truncate text-xs font-semibold">{props.initialTitle}</h1>
          </div>
          <span className="ml-auto text-[11px] text-muted-foreground" aria-live="polite">
            {saveState === 'saved'
              ? hasDraftChange
                ? 'Saved edit · preview not applied'
                : 'Saved'
              : saveState === 'error'
                ? 'Save failed'
                : 'Saving…'}
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
          <button type="button" className={editorToolbarTextBtn} onClick={() => requestHandoff('export')}>
            <Download />Export
          </button>
          <button type="button" className={editorToolbarTextBtn} onClick={() => requestHandoff('text')}>
            <FileText />Open in text editor
          </button>
          <Button size="sm" onClick={() => requestHandoff('clip')}>
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
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={'Search ' + tab + ' by name or tag'}
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                  aria-label={'Search ' + tab + ' templates'}
                />
                {searchQuery ? (
                  <Button size="sm" variant="ghost" onClick={() => setSearchQuery('')}>Clear</Button>
                ) : null}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground" aria-live="polite">
                {filteredEntries.length} of {entries.length} in {tab}
              </p>
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

              {filteredEntries.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {filteredEntries.map((entry) => {
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
                        onFocus={() => {
                          if (reason) return
                          setHoveredEntry(entry)
                          console.info('[editor:templates-gaps] template-preview', {
                            projectId,
                            clipId,
                            category: entry.item.tab,
                            templateId: entryId(entry),
                            via: 'focus',
                          })
                        }}
                        onBlur={() => setHoveredEntry(null)}
                        onClick={() => {
                          console.info('[editor:templates-gaps] template-selected', {
                            projectId,
                            clipId,
                            category: entry.item.tab,
                            templateId: entryId(entry),
                          })
                          selectEntry(entry)
                        }}
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
                    <p className="text-sm font-medium">{searchQuery ? 'No matching templates' : 'No templates in this section'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {searchQuery ? 'Clear search or try a different real template name/tag.' : 'Choose another tab or retry saved brand kits.'}
                    </p>
                  </div>
                </div>
              )}

              <section className="mt-4 space-y-3 rounded-xl border border-border bg-background/70 p-3" aria-label="Customize selected style">
                <div>
                  <h3 className="text-xs font-semibold">Customize</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {activeEntry?.item.name ?? selectedEntry?.item.name ?? 'Saved clip style'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[11px]">
                    <span className="text-muted-foreground">Typeface</span>
                    <select
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      value={draftEdits.captions.font ?? fontOptions[0] ?? 'Inter'}
                      onChange={(event) => setCaptionDraft((draft) => ({ ...draft, font: event.target.value }))}
                    >
                      {fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-[11px]">
                    <span className="text-muted-foreground">Weight</span>
                    <input className="h-8 w-full rounded-md border border-border bg-muted px-2 text-xs" value="Not available" disabled />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">Weight has no stable ClipEditsV2 caption field, so it stays disabled.</p>

                <label className="block space-y-1 text-[11px]">
                  <span className="text-muted-foreground">Size · {captionSize.toFixed(1)}%</span>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    step="0.5"
                    value={captionSize}
                    className="w-full"
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      setCaptionDraft((draft) =>
                        cpCaptionSize
                          ? { ...draft, userSizePct: value }
                          : { ...draft, size: value },
                      )
                    }}
                  />
                </label>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Text A</span>
                    <input
                      type="color"
                      value={draftEdits.captions.colors?.a ?? '#FFFFFF'}
                      className="h-8 w-full rounded border border-border bg-background"
                      onChange={(event) =>
                        setCaptionDraft((draft) => ({
                          ...draft,
                          colors: { ...draft.colors, a: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Text B</span>
                    <input
                      type="color"
                      value={draftEdits.captions.colors?.b ?? '#FFFFFF'}
                      className="h-8 w-full rounded border border-border bg-background"
                      onChange={(event) =>
                        setCaptionDraft((draft) => ({
                          ...draft,
                          colors: { ...draft.colors, b: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Highlight</span>
                    <input
                      type="color"
                      value={draftEdits.captions.highlightColor ?? '#FDE047'}
                      disabled={(draftEdits.captions.activeStyle ?? 'color') !== 'highlight'}
                      className="h-8 w-full rounded border border-border bg-background disabled:opacity-50"
                      onChange={(event) => setCaptionDraft((draft) => ({ ...draft, highlightColor: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Active word</span>
                    <select
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      value={draftEdits.captions.activeStyle ?? 'color'}
                      onChange={(event) =>
                        setCaptionDraft((draft) => ({
                          ...draft,
                          activeStyle: event.target.value as NonNullable<ClipEditsV2['captions']['activeStyle']>,
                        }))
                      }
                    >
                      <option value="color">Color</option>
                      <option value="highlight">Highlight</option>
                      <option value="fill">Fill</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Position</span>
                    <select
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      value={draftEdits.captions.position ?? 'bottom'}
                      onChange={(event) => setCaptionDraft((draft) => ({ ...draft, position: event.target.value }))}
                    >
                      <option value="top">Top</option>
                      <option value="middle">Middle</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Case</span>
                    <select
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      value={draftEdits.captions.case ?? 'sentence'}
                      onChange={(event) => setCaptionDraft((draft) => ({ ...draft, case: event.target.value }))}
                    >
                      <option value="sentence">Sentence</option>
                      <option value="upper">UPPER</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Words / line</span>
                    <select
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      value={String(draftEdits.captions.wordsPerLine ?? 2)}
                      onChange={(event) =>
                        setCaptionDraft((draft) => ({ ...draft, wordsPerLine: Number(event.target.value) }))
                      }
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </label>
                </div>

                <div className="rounded-md border border-dashed border-border p-2 text-[10px] text-muted-foreground">
                  Stroke/background controls are disabled here because the current caption edit contract has no dedicated persisted fields for them.
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-[11px] font-medium">Save as reusable style</p>
                  <div className="flex gap-2">
                    <input
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      placeholder="Style name"
                      className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingPreset || reusableUnsupported}
                      onClick={() => void saveReusableStyle()}
                    >
                      {savingPreset ? 'Saving…' : 'Save style'}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Saving creates a reusable brand style only; it does not apply this preview to the clip.
                  </p>
                  {reusableUnsupported ? (
                    <p className="text-[10px] text-amber-600">
                      Active-word highlight/fill or CP size overrides are real clip fields, but the current reusable brand-style schema cannot store them faithfully.
                    </p>
                  ) : null}
                </div>
              </section>
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
                  {activeEntry ? activeEntry.item.name : aspectOverride || customFieldNames.length ? 'Customized saved style' : 'Choose a template'}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Preview changes are local until applied. Templates change styling/layout only — never source footage.
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Project scope applies compatible fields clip-by-clip and skips incompatible clips; no hidden scene scope is added.
                </p>
                {bulkResult ? (
                  <p className="mt-1 text-[10px] font-medium" aria-live="polite">
                    Last project apply: {bulkResult.updated} updated · {bulkResult.skipped} skipped · {bulkResult.errors} errors
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={!hasLocalPreviewState || applyingAll}
                  onClick={() => cancelPreview('button')}
                >
                  Cancel preview / reset to saved
                </Button>
                <Button variant="outline" disabled={!hasDraftChange || applyingAll} onClick={() => void applyThisClip()}>
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

        {handoffTarget ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Unapplied template preview">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl">
              <h2 className="text-sm font-semibold">Unapplied template preview</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                The saved edit is unchanged. Apply this preview to this clip, discard only the local preview, or stay here.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Apply uses current-clip scope only. Project-wide apply remains the explicit button on the Templates page.
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" disabled={handoffBusy} onClick={() => {
                  console.info('[editor:templates-gaps] handoff-choice', {
                    projectId,
                    clipId,
                    target: handoffTarget,
                    scope: 'stay',
                  })
                  setHandoffTarget(null)
                }}>
                  Stay
                </Button>
                <Button variant="outline" disabled={handoffBusy} onClick={() => void discardPendingAndContinue()}>
                  Discard preview
                </Button>
                <Button disabled={handoffBusy} onClick={() => void applyPendingAndContinue()}>
                  {handoffBusy ? <><Loader2 className="mr-1 size-4 animate-spin" />Applying…</> : 'Apply to this clip'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ClipperSurfaceErrorBoundary>
  )
}
