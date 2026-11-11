'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, Loader2, Palette, Pause, Play, Sparkles, Type } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LayoutQuickPicker } from '@/components/clips/editor/layout-quick-picker'
import { TemplateLayoutPanel } from '@/components/clips/editor/template-layout-panel'
import { EditorHeadlineField } from '@/components/clips/editor/editor-headline-field'
import { CanvasBackgroundControls } from '@/components/clips/editor/canvas-background'
import { BrandPanel } from '@/components/clips/editor/brand-panel'
import { mediaUrlFor, useProjectMedia } from '@/components/clips/editor/use-project-media'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import type { EditorClipShell } from '@/components/clips/editor/editor-clip-shell'
import { editorMediaLoadFallbacks } from '@/lib/server/clips/editor-clip-media'
import { StandaloneEditorChrome, StandaloneEditorToolRail, finishStandaloneLayoutHandoff } from '@/components/clips/editor/standalone-editor-chrome'
import { useFullVideoModeHandoff } from '@/components/clips/editor/full-video-mode-handoff'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { buildTemplateCatalog, type CatalogItem, type CatalogTab } from '@/lib/clips/templates/catalog'
import { CatalogTplThumb } from '@/lib/clips/templates/catalog-thumb'
import { applyCatalogToken, parseApplyToken } from '@/lib/clips/templates/apply-from-hub'
import { BRAND_STARTERS } from '@/lib/clips/brand-starters'
import { applyBrandTemplateToEdits, type BrandTemplatePayload } from '@/lib/clips/apply-brand'
import { canonicalEditsJson, displayDurationMs, displayPositionMs, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { clipStyleSettingsFromEdits, type ClipBrandEdits } from '@/lib/clips/brand'
import { BRAND_FONTS } from '@/lib/clips/brand-kit'
import { clipsFetch, listProjectClips, patchClip } from '@/lib/clips-api'
import { t6CaptionPresetsEnabled, t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { routes } from '@/lib/routes'
import { useSafeZoneVisible } from '@/lib/clips/use-safe-zone-visible'
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
type HandoffTarget = 'project' | 'clip' | 'producer' | 'story' | 'templates' | 'generate' | 'full-video' | 'export' | 'layout-script' | 'layout-timeline'
type BulkResult = { updated: number; skipped: number; errors: number }
type CaptionView = 'choose' | 'edit'
type CustomizerSection = 'layout' | 'subtitle' | 'headline' | 'background' | 'logo' | 'outro'

const TABS: { id: CatalogTab; label: string }[] = [
  { id: 'layouts', label: 'Layouts' },
  { id: 'captions', label: 'Captions' },
  { id: 'looks', label: 'Looks' },
  { id: 'brand', label: 'Brand' },
]
const ASPECTS: NonNullable<ClipEditsV2['aspectRatio']>[] = ['9:16', '1:1', '16:9']

const CUSTOMIZER_NAV: { id: CustomizerSection; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'subtitle', label: 'Subtitle' },
  { id: 'headline', label: 'Headline' },
  { id: 'background', label: 'Background' },
  { id: 'logo', label: 'Logo' },
  { id: 'outro', label: 'Outro' },
]
const RECENT_LIMIT = 6

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

function valuesDiffer(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
}

function withCaptionPatch(
  edits: ClipEditsV2,
  patch: Partial<ClipEditsV2['captions']>,
): ClipEditsV2 {
  return {
    ...edits,
    captions: {
      ...edits.captions,
      ...patch,
      ...(patch.colors ? { colors: { ...edits.captions.colors, ...patch.colors } } : {}),
    },
  }
}

function customizerChangedFields(before: ClipEditsV2, after: ClipEditsV2 | null) {
  if (!after) return []
  const fields: string[] = []
  if (before.aspectRatio !== after.aspectRatio) fields.push('aspectRatio')
  if (valuesDiffer(before.captions, after.captions)) fields.push('captions')
  if (valuesDiffer(before.layout, after.layout)) fields.push('layout')
  if (
    valuesDiffer(before.exportTemplate?.headlineBar, after.exportTemplate?.headlineBar) ||
    valuesDiffer(before.exportTemplate?.headlineStyle, after.exportTemplate?.headlineStyle)
  ) fields.push('headline')
  if (valuesDiffer(before.canvasBg, after.canvasBg)) fields.push('canvasBg')
  if (valuesDiffer(before.brand, after.brand)) fields.push('brand')
  return fields
}

function applyCustomizerDelta(
  target: ClipEditsV2,
  before: ClipEditsV2,
  after: ClipEditsV2,
): ClipEditsV2 {
  let next = target

  if (before.aspectRatio !== after.aspectRatio) next = { ...next, aspectRatio: after.aspectRatio }

  const capPatch: Partial<ClipEditsV2['captions']> = {}
  if (valuesDiffer(before.captions.enabled, after.captions.enabled)) capPatch.enabled = after.captions.enabled
  if (valuesDiffer(before.captions.presetId, after.captions.presetId)) capPatch.presetId = after.captions.presetId
  if (valuesDiffer(before.captions.font, after.captions.font)) capPatch.font = after.captions.font
  if (valuesDiffer(before.captions.animation, after.captions.animation)) capPatch.animation = after.captions.animation
  if (valuesDiffer(before.captions.size, after.captions.size)) capPatch.size = after.captions.size
  if (valuesDiffer(before.captions.userSizePct, after.captions.userSizePct)) capPatch.userSizePct = after.captions.userSizePct
  if (valuesDiffer(before.captions.position, after.captions.position)) capPatch.position = after.captions.position
  if (valuesDiffer(before.captions.case, after.captions.case)) capPatch.case = after.captions.case
  if (valuesDiffer(before.captions.wordsPerLine, after.captions.wordsPerLine)) capPatch.wordsPerLine = after.captions.wordsPerLine
  if (valuesDiffer(before.captions.colors, after.captions.colors)) capPatch.colors = after.captions.colors
  if (valuesDiffer(before.captions.activeStyle, after.captions.activeStyle)) capPatch.activeStyle = after.captions.activeStyle
  if (valuesDiffer(before.captions.highlightColor, after.captions.highlightColor)) capPatch.highlightColor = after.captions.highlightColor
  if (Object.keys(capPatch).length) next = withCaptionPatch(next, capPatch)

  const layoutPatch: Partial<ClipEditsV2['layout']> = {}
  if (before.layout.mode !== after.layout.mode) layoutPatch.mode = after.layout.mode
  if (valuesDiffer(before.layout.facecam, after.layout.facecam)) layoutPatch.facecam = after.layout.facecam
  if (valuesDiffer(before.layout.template, after.layout.template)) layoutPatch.template = after.layout.template
  if (valuesDiffer(before.layout.userPicked, after.layout.userPicked)) layoutPatch.userPicked = after.layout.userPicked
  if (valuesDiffer(before.layout.blurStrength, after.layout.blurStrength)) layoutPatch.blurStrength = after.layout.blurStrength
  if (Object.keys(layoutPatch).length) next = { ...next, layout: { ...next.layout, ...layoutPatch } }

  const beforeTpl = before.exportTemplate ?? {}
  const afterTpl = after.exportTemplate ?? {}
  if (
    valuesDiffer(beforeTpl.headlineBar, afterTpl.headlineBar) ||
    valuesDiffer(beforeTpl.headlineStyle, afterTpl.headlineStyle)
  ) {
    next = {
      ...next,
      exportTemplate: {
        ...next.exportTemplate,
        headlineBar: afterTpl.headlineBar,
        headlineStyle: afterTpl.headlineStyle,
      },
    }
  }

  if (valuesDiffer(before.canvasBg, after.canvasBg)) next = { ...next, canvasBg: after.canvasBg }

  const beforeBrand = (before.brand ?? {}) as ClipBrandEdits
  const afterBrand = (after.brand ?? {}) as ClipBrandEdits
  if (valuesDiffer(beforeBrand, afterBrand)) {
    const brandPatch: Partial<ClipBrandEdits> = {}
    const keys: (keyof ClipBrandEdits)[] = [
      'templateId', 'logoKey', 'logoPosition', 'logoSizePct', 'logoOpacity', 'primaryColor',
      'introVideoKey', 'outroVideoKey', 'useIntro', 'useOutro', 'headingFont', 'captionFont',
      'palette', 'watermarkKey', 'watermarkPosition', 'watermarkOpacity', 'watermarkSizePct',
      'aspectOverrides',
    ]
    for (const key of keys) {
      if (valuesDiffer(beforeBrand[key], afterBrand[key])) {
        ;(brandPatch as Record<string, unknown>)[key] = afterBrand[key]
      }
    }
    next = { ...next, brand: { ...((next.brand ?? {}) as object), ...brandPatch } }
  }

  return next
}

function CaptionTypographyEditor({
  edits,
  onPatch,
}: {
  edits: ClipEditsV2
  onPatch: (patch: Partial<ClipEditsV2['captions']>) => void
}) {
  const cap = edits.captions
  const cpSize = Boolean(cap.presetId?.startsWith('cp'))
  const size = cpSize ? cap.userSizePct ?? cap.size ?? 6.5 : cap.size ?? 6.5
  const fonts = Array.from(new Set([cap.font, ...BRAND_FONTS].filter((font): font is string => Boolean(font))))

  return (
    <div className="space-y-3" data-testid="templates-caption-typography">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[11px]">
          <span className="text-muted-foreground">Typeface</span>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            value={cap.font ?? fonts[0] ?? 'Inter'}
            onChange={(event) => onPatch({ font: event.target.value })}
          >
            {fonts.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px]">
          <span className="text-muted-foreground">Weight</span>
          <input className="h-8 w-full rounded-md border border-border bg-muted px-2 text-xs" value="Not available" disabled />
        </label>
      </div>
      <p className="text-[10px] text-muted-foreground">Weight is disabled because ClipEditsV2 has no dedicated persisted caption-weight field.</p>

      <label className="block space-y-1 text-[11px]">
        <span className="text-muted-foreground">Size · {Number(size).toFixed(1)}%</span>
        <input
          type="range"
          min="3"
          max="10"
          step="0.5"
          value={size}
          className="w-full"
          onChange={(event) => {
            const value = Number(event.target.value)
            onPatch(cpSize ? { userSizePct: value } : { size: value })
          }}
        />
      </label>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <label className="space-y-1">
          <span className="text-muted-foreground">Text A</span>
          <input
            type="color"
            value={cap.colors?.a ?? '#FFFFFF'}
            className="h-8 w-full rounded border border-border bg-background"
            onChange={(event) => onPatch({ colors: { ...cap.colors, a: event.target.value } })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Text B</span>
          <input
            type="color"
            value={cap.colors?.b ?? '#FFFFFF'}
            className="h-8 w-full rounded border border-border bg-background"
            onChange={(event) => onPatch({ colors: { ...cap.colors, b: event.target.value } })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Highlight</span>
          <input
            type="color"
            value={cap.highlightColor ?? '#FDE047'}
            disabled={(cap.activeStyle ?? 'color') !== 'highlight'}
            className="h-8 w-full rounded border border-border bg-background disabled:opacity-50"
            onChange={(event) => onPatch({ highlightColor: event.target.value })}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {['Stroke', 'Background'].map((label) => (
          <label key={label} className="space-y-1 text-[11px]">
            <span className="text-muted-foreground">{label}</span>
            <input
              className="h-8 w-full rounded-md border border-border bg-muted px-2 text-xs"
              value="Not available"
              disabled
              title={label + ' has no dedicated persisted caption field'}
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <label className="space-y-1">
          <span className="text-muted-foreground">Active word</span>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            value={cap.activeStyle ?? 'color'}
            onChange={(event) => onPatch({ activeStyle: event.target.value as NonNullable<ClipEditsV2['captions']['activeStyle']> })}
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
            value={cap.position ?? 'bottom'}
            onChange={(event) => onPatch({ position: event.target.value })}
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
            value={cap.case ?? 'sentence'}
            onChange={(event) => onPatch({ case: event.target.value })}
          >
            <option value="sentence">Sentence</option>
            <option value="upper">UPPER</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Words / line</span>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            value={String(cap.wordsPerLine ?? 2)}
            onChange={(event) => onPatch({ wordsPerLine: Number(event.target.value) })}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
      </div>
    </div>
  )
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
  const [captionView, setCaptionView] = useState<CaptionView>('choose')
  const [recentKeys, setRecentKeys] = useState<string[]>([])
  const [captionDraft, setCaptionDraft] = useState<CaptionDraft>({})
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [customizerSection, setCustomizerSection] = useState<CustomizerSection>('subtitle')
  const [customizerEdits, setCustomizerEdits] = useState<ClipEditsV2 | null>(null)
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [handoffTarget, setHandoffTarget] = useState<HandoffTarget | null>(null)
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [applyingAll, setApplyingAll] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(props.initialEdits.trim.in)
  const [playheadOut, setPlayheadOut] = useState(0)
  const [media, setMedia] = useState(props.primaryMedia)
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [previewRetryKey, setPreviewRetryKey] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const customizerVideoRef = useRef<HTMLVideoElement | null>(null)
  const tried = useRef(new Set<string>())
  const projectMedia = useProjectMedia(projectId)
  const [safeZoneVisible, setSafeZoneVisible] = useSafeZoneVisible()

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
  const fullVideoMode = useFullVideoModeHandoff(clipId, flushSave)

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

  useEffect(() => {
    const key = 'transovo:templates-recent:v1:' + projectId
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key) ?? '[]')
      setRecentKeys(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(0, RECENT_LIMIT) : [])
    } catch {
      setRecentKeys([])
    }
  }, [projectId])

  const allEntries = useMemo<GalleryEntry[]>(() => {
    const base = catalog.map((item) => ({
      key: 'catalog:' + item.kind + ':' + item.id,
      source: 'catalog' as const,
      item,
    }))
    const saved = brands.map((brand) => ({
      key: 'saved-brand:' + brand.id,
      source: 'saved_brand' as const,
      item: savedBrandCatalogItem(brand),
      brand,
    }))
    return [...saved, ...base]
  }, [brands, catalog])

  const entries = useMemo(() => allEntries.filter((entry) => entry.item.tab === tab), [allEntries, tab])
  const recentEntries = useMemo(
    () => recentKeys.map((key) => allEntries.find((entry) => entry.key === key)).filter((entry): entry is GalleryEntry => Boolean(entry)),
    [allEntries, recentKeys],
  )

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
  const baseDraftEdits = useMemo(() => {
    let next = applyEntryToEdits(edits, activeEntry, {
      facecamLayout: props.facecamLayout,
      playheadSourceMs: playhead,
      idPrefix: clipId,
    })
    if (aspectOverride) next = { ...next, aspectRatio: aspectOverride }
    next = applyCaptionDraft(next, captionDraft)
    return next
  }, [edits, activeEntry, props.facecamLayout, playhead, clipId, aspectOverride, captionDraft])
  const draftEdits = customizerEdits ?? baseDraftEdits
  const customFieldNames = useMemo(
    () => Array.from(new Set([...captionDraftFields(captionDraft), ...customizerChangedFields(baseDraftEdits, customizerEdits)])),
    [captionDraft, baseDraftEdits, customizerEdits],
  )
  useEffect(() => {
    if (!customFieldNames.length) return
    console.info('[editor:templates-gaps] customization', {
      projectId,
      clipId,
      fieldNames: customFieldNames,
    })
  }, [projectId, clipId, customFieldNames])

  const previewEdits = useMemo(() => editorPreviewEdits(draftEdits, words), [draftEdits, words])
  const effectiveAspect = draftEdits.aspectRatio ?? '9:16'
  const hasDraftChange = useMemo(
    () => canonicalEditsJson(draftEdits) !== canonicalEditsJson(edits),
    [draftEdits, edits],
  )
  const hasLocalPreviewState = Boolean(selectedEntry || hoveredEntry || aspectOverride || customFieldNames.length || customizerEdits)
  const cpCaptionSize = Boolean(draftEdits.captions.presetId?.startsWith('cp'))
  const captionSize = cpCaptionSize
    ? draftEdits.captions.userSizePct ?? draftEdits.captions.size ?? 6.5
    : draftEdits.captions.size ?? 6.5
  const draftBrand = (draftEdits.brand ?? {}) as ClipBrandEdits
  const reusableSourceBrand = brands.find((brand) => brand.id === draftBrand.templateId)
  const reusableUnsupported = Boolean(
    captionDraft.highlightColor !== undefined ||
      captionDraft.userSizePct !== undefined ||
      draftEdits.captions.activeStyle === 'highlight' ||
      draftEdits.captions.activeStyle === 'fill' ||
      (cpCaptionSize && draftEdits.captions.userSizePct != null) ||
      (reusableSourceBrand?.introVideoKey && draftBrand.useIntro === false) ||
      (reusableSourceBrand?.outroVideoKey && draftBrand.useOutro === false)
  )
  const draftLogoKey = draftBrand.logoKey
  const canvasBgImageUrl = useMemo(
    () => draftEdits.canvasBg?.type === 'image' && draftEdits.canvasBg.imageId
      ? mediaUrlFor(projectMedia.items, draftEdits.canvasBg.imageId)
      : null,
    [draftEdits.canvasBg, projectMedia.items],
  )
  const customizerGalleryEntries = useMemo(() => {
    const galleryTab: CatalogTab =
      customizerSection === 'layout'
        ? 'layouts'
        : customizerSection === 'subtitle'
          ? 'captions'
          : customizerSection === 'logo' || customizerSection === 'outro' || customizerSection === 'headline'
            ? 'brand'
            : 'looks'
    return allEntries.filter((entry) => entry.item.tab === galleryTab).slice(0, 6)
  }, [allEntries, customizerSection])

  useEffect(() => {
    if (!draftLogoKey) {
      setBrandLogoUrl(null)
      return
    }
    void clipsFetch<{ url: string }>(`/api/clips/brand/logo?key=${encodeURIComponent(draftLogoKey)}`)
      .then((data) => setBrandLogoUrl(data.url))
      .catch(() => setBrandLogoUrl(null))
  }, [draftLogoKey])

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
    setCustomizerEdits(null)
    setCustomizerOpen(false)
    if (entry.item.tab === 'captions') setCaptionView('choose')
    console.info('[editor:templates-mode] template-previewed', {
      projectId,
      clipId,
      kind: entryKind(entry),
      id: entryId(entry),
    })
  }

  const rememberRecent = useCallback((entry: GalleryEntry | null) => {
    if (!entry) return
    const storageKey = 'transovo:templates-recent:v1:' + projectId
    setRecentKeys((current) => {
      const next = [entry.key, ...current.filter((key) => key !== entry.key)].slice(0, RECENT_LIMIT)
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* local recency is optional */
      }
      console.info('[editor:templates-gaps] recent-used', {
        projectId,
        clipId,
        templateId: entryId(entry),
        category: entry.item.tab,
        count: next.length,
      })
      return next
    })
  }, [projectId, clipId])

  const patchCaptionCustomization = useCallback((patch: Partial<ClipEditsV2['captions']>) => {
    if (customizerEdits) {
      setCustomizerEdits((current) => current ? withCaptionPatch(current, patch) : current)
      return
    }
    setCaptionDraft((current) => ({
      ...current,
      ...patch,
      ...(patch.colors ? { colors: { ...current.colors, ...patch.colors } } : {}),
    }))
  }, [customizerEdits])

  const customizerDisabledReason = (section: CustomizerSection) => {
    if (section === 'logo') {
      if (brandsLoading) return 'Saved brand templates are still loading.'
      if (!brands.some((brand) => brand.logoKey)) return 'No saved brand template has a logo yet. Add one in Manage templates.'
    }
    if (section === 'outro') {
      if (brandsLoading) return 'Saved brand templates are still loading.'
      if (!brands.some((brand) => brand.outroVideoKey)) return 'No saved brand template has an outro bumper yet. Add one in Manage templates.'
    }
    return null
  }

  const draftForEntry = (entry: GalleryEntry) => {
    let next = applyEntryToEdits(edits, entry, {
      facecamLayout: props.facecamLayout,
      playheadSourceMs: playhead,
      idPrefix: clipId,
    })
    if (aspectOverride) next = { ...next, aspectRatio: aspectOverride }
    return applyCaptionDraft(next, captionDraft)
  }

  const openCustomizer = (section: CustomizerSection, entry?: GalleryEntry) => {
    const reason = customizerDisabledReason(section)
    if (reason) {
      toast.message(reason)
      console.info('[editor:templates-gaps] customizer-disabled', { projectId, clipId, section })
      return
    }
    const next = entry ? draftForEntry(entry) : draftEdits
    if (entry) {
      setSelectedEntry(entry)
      setHoveredEntry(null)
      setTab(entry.item.tab)
      if (entry.item.tab === 'captions') setCaptionView('choose')
    }
    setCustomizerEdits(next)
    setCustomizerSection(section)
    setCustomizerOpen(true)
    videoRef.current?.pause()
    console.info('[editor:templates-gaps] customizer-open', {
      projectId,
      clipId,
      section,
      templateId: entry ? entryId(entry) : entryId(selectedEntry),
    })
  }

  const chooseCustomizerEntry = (entry: GalleryEntry) => {
    const reason = disabledReason(entry.item, edits)
    if (reason) {
      toast.message(reason)
      return
    }
    setSelectedEntry(entry)
    setHoveredEntry(null)
    setTab(entry.item.tab)
    setCustomizerEdits(draftForEntry(entry))
    console.info('[editor:templates-gaps] customizer-style-selected', {
      projectId,
      clipId,
      section: customizerSection,
      category: entry.item.tab,
      templateId: entryId(entry),
    })
  }

  const clearPreviewForHistory = () => {
    setSelectedEntry(null)
    setHoveredEntry(null)
    setAspectOverride(null)
    setCaptionDraft({})
    setCustomizerEdits(null)
    setCustomizerOpen(false)
    setPresetName('')
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
      rememberRecent(chosen)
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
    const customizerBase = baseDraftEdits
    const customizerFinal = customizerEdits
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
        if (customizerFinal) next = applyCustomizerDelta(next, customizerBase, customizerFinal)
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
      rememberRecent(chosen)
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
      const brand = (draftEdits.brand ?? {}) as ClipBrandEdits
      const duplicateFromId = brands.some((row) => row.id === brand.templateId) ? brand.templateId : undefined
      const data = await clipsFetch<{ template: BrandRow }>('/api/clips/brand/templates', {
        method: 'POST',
        body: JSON.stringify({
          name,
          settings: clipStyleSettingsFromEdits(draftEdits),
          ...(duplicateFromId ? { duplicateFromId } : {}),
          logoKey: brand.logoKey ?? null,
          headingFont: brand.headingFont ?? null,
          captionFont: brand.captionFont ?? draftEdits.captions.font ?? null,
          palette: brand.palette?.length ? brand.palette : palette.length ? palette : null,
          watermarkKey: brand.watermarkKey ?? null,
          watermarkPosition: brand.watermarkPosition ?? null,
          watermarkOpacity: brand.watermarkOpacity ?? null,
          watermarkSizePct: brand.watermarkSizePct ?? null,
          aspectOverrides: brand.aspectOverrides ?? null,
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

  const navigateAfterSave = async (target: HandoffTarget) => {
    if (target === 'layout-script' || target === 'layout-timeline') {
      await finishStandaloneLayoutHandoff({
        view: target === 'layout-script' ? 'script' : 'timeline',
        projectId,
        clipId,
        clipperStudio: props.clipperStudio,
        flushSave,
      })
      return
    }
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
    if (target === 'full-video') {
      await fullVideoMode.open()
      return
    }
    const query = props.clipperStudio ? { from: 'studio' } : undefined
    if (target === 'producer') {
      console.info('[editor:templates-mode] open-ai-producer', { projectId, clipId })
      window.location.assign(routes.chat(projectId, clipId, query))
      return
    }
    if (target === 'story') {
      console.info('[editor:templates-mode] open-story-blocks', { projectId, clipId })
      window.location.assign(routes.story(projectId, clipId, query))
      return
    }
    if (target === 'generate') {
      console.info('[editor:templates-mode] open-change-shot', { projectId, clipId, atMs: Math.round(playhead) })
      window.location.assign(routes.generate(projectId, clipId, { atMs: String(Math.round(playhead)), ...(props.clipperStudio ? { from: 'studio' } : {}) }))
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
      toast.error('Save edits before leaving Layouts')
      return
    }
    console.info('[editor:templates-gaps] handoff', {
      projectId,
      clipId,
      target,
      scope: 'saved-edit',
    })
    await navigateAfterSave(target)
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
      rememberRecent(activeEntry)
      cancelPreview('handoff')
      setHandoffTarget(null)
      await navigateAfterSave(target)
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
    <ClipperSurfaceErrorBoundary surface="Layouts editor">
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground" data-testid="templates-editor">
        <StandaloneEditorChrome
          projectTitle={props.projectTitle}
          title={props.initialTitle}
          current="templates"
          saveState={saveState}
          statusText={saveState === 'saved' ? (hasDraftChange ? 'Saved edit · preview not applied' : 'Saved') : saveState === 'error' ? 'Save failed' : 'Saving…'}
          canUndo={canUndo}
          canRedo={canRedo}
          disabled={handoffBusy}
          onBack={() => requestHandoff('project')}
          onUndo={() => {
            clearPreviewForHistory()
            undo()
            console.info('[editor:templates-mode] undo', { projectId, clipId })
          }}
          onRedo={() => {
            clearPreviewForHistory()
            redo()
            console.info('[editor:templates-mode] redo', { projectId, clipId })
          }}
          onExport={() => requestHandoff('export')}
          onRetrySave={() => { void flushSave().catch(() => toast.error('Save retry failed')) }}
          onModeSelect={(mode) => {
            console.info('[editor:templates-mode] mode-selected', { projectId, clipId, mode })
            if (mode === 'templates') return
            requestHandoff(mode)
          }}
          onLayoutSelect={(view) => requestHandoff(view === 'script' ? 'layout-script' : 'layout-timeline')}
        />

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(320px,390px)_minmax(0,1fr)_3.5rem] overflow-hidden gap-1 p-1 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)_3.5rem]" data-testid="templates-editor-layout-grid">
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card/60" aria-label="Layout gallery">
            <div className="border-b border-border px-4 pb-3 pt-4">
              <h2 className="text-sm font-semibold">Layouts</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Hover to preview. Apply writes to this clip&apos;s existing edit document.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Layout types">
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
              {tab === 'captions' ? (
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/20 p-1" role="tablist" aria-label="Caption template mode">
                  {([
                    ['choose', 'Choose Style'],
                    ['edit', 'Edit Captions'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={captionView === id}
                      className={cn(
                        'rounded px-2 py-1.5 text-xs font-medium',
                        captionView === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => {
                        setCaptionView(id)
                        setHoveredEntry(null)
                        console.info('[editor:templates-gaps] captions-view', { projectId, clipId, view: id })
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {recentEntries.length && (tab !== 'captions' || captionView === 'choose') ? (
                <div className="mt-3" data-testid="templates-recently-used">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[11px] font-medium">Recently used</p>
                    <span className="text-[10px] text-muted-foreground">{recentEntries.length}</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {recentEntries.map((entry) => (
                      <button
                        key={'recent:' + entry.key}
                        type="button"
                        className="w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-background text-left hover:border-primary/50"
                        onMouseEnter={() => !disabledReason(entry.item, edits) && setHoveredEntry(entry)}
                        onMouseLeave={() => setHoveredEntry(null)}
                        onFocus={() => !disabledReason(entry.item, edits) && setHoveredEntry(entry)}
                        onBlur={() => setHoveredEntry(null)}
                        onClick={() => {
                          setTab(entry.item.tab)
                          if (entry.item.tab === 'captions') setCaptionView('choose')
                          selectEntry(entry)
                        }}
                      >
                        <CatalogTplThumb item={entry.item} />
                        <span className="block truncate px-2 py-1 text-[10px] font-medium">{entry.item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === 'brand' ? (
                <div className="mt-3" data-testid="templates-brand-sections">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Brand kit sections</p>
                  <div className="flex flex-wrap gap-1">
                    {([
                      ['Templates', null],
                      ['Logos', 'logo'],
                      ['Subtitles', 'subtitle'],
                      ['Text styles', 'headline'],
                      ['Images', 'background'],
                    ] as const).map(([label, section]) => {
                      const reason = section ? customizerDisabledReason(section) : null
                      return (
                        <Button
                          key={label}
                          size="sm"
                          variant={section ? 'outline' : 'secondary'}
                          disabled={Boolean(reason)}
                          title={reason ?? undefined}
                          onClick={() => section && openCustomizer(section)}
                        >
                          {label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {tab !== 'captions' || captionView === 'choose' ? (
                <>
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
                </>
              ) : null}
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

              {tab === 'captions' && captionView === 'edit' ? (
                <section className="space-y-3 rounded-xl border border-border bg-background/70 p-3" data-testid="templates-edit-captions">
                  <div>
                    <h3 className="text-xs font-semibold">Edit Captions</h3>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Typography edits remain preview-only until Apply.</p>
                  </div>
                  <CaptionTypographyEditor edits={draftEdits} onPatch={patchCaptionCustomization} />
                  <Button size="sm" variant="outline" className="w-full" onClick={() => openCustomizer('subtitle')}>
                    Open full customizer
                  </Button>
                </section>
              ) : (
                <>
                  {filteredEntries.length ? (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredEntries.map((entry) => {
                        const reason = disabledReason(entry.item, edits)
                        const selected = selectedEntry?.key === entry.key
                        return (
                          <div key={entry.key} className="relative">
                            <button
                              type="button"
                              className={cn(
                                'group w-full overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all',
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
                              <div className={cn('space-y-1.5 p-3', entry.item.tab === 'captions' && !reason && 'pb-10')}>
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
                            {entry.item.tab === 'captions' && !reason ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="absolute bottom-2 right-2 h-7 text-[10px]"
                                onClick={() => openCustomizer('subtitle', entry)}
                              >
                                Customize
                              </Button>
                            ) : null}
                          </div>
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

                  {selectedEntry?.item.tab === 'captions' ? (
                    <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-end gap-2 rounded-lg border border-border bg-background/70 p-2" data-testid="templates-caption-quick-nudge">
                      <label className="space-y-1 text-[10px]">
                        <span className="text-muted-foreground">Size · {Number(captionSize).toFixed(1)}%</span>
                        <input
                          type="range"
                          min="3"
                          max="10"
                          step="0.5"
                          value={captionSize}
                          className="w-full"
                          onChange={(event) => {
                            const value = Number(event.target.value)
                            patchCaptionCustomization(cpCaptionSize ? { userSizePct: value } : { size: value })
                          }}
                        />
                      </label>
                      <label className="space-y-1 text-[10px]">
                        <span className="text-muted-foreground">Color</span>
                        <input
                          type="color"
                          value={draftEdits.captions.colors?.a ?? '#FFFFFF'}
                          className="h-8 w-10 rounded border border-border bg-background"
                          onChange={(event) => patchCaptionCustomization({ colors: { ...draftEdits.captions.colors, a: event.target.value } })}
                        />
                      </label>
                      <Button size="sm" variant="outline" onClick={() => openCustomizer('subtitle')}>Customize</Button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-panel" aria-label="Layout preview">
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2">
              <div>
                <h2 className="text-sm font-semibold">Live preview</h2>
                <p className="text-[11px] text-muted-foreground">
                  {activeEntry ? 'Previewing ' + activeEntry.item.name : 'Current clip style'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button
                  size="sm"
                  variant={safeZoneVisible ? 'secondary' : 'outline'}
                  onClick={() => {
                    setSafeZoneVisible(!safeZoneVisible)
                    console.info('[editor:templates-gaps] safe-zone', { projectId, clipId, visible: !safeZoneVisible })
                  }}
                >
                  {safeZoneVisible ? 'Hide safe zone' : 'Show safe zone'}
                </Button>
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
            </div>

            <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-muted/15 p-5 [container-type:size]" data-testid="templates-preview-frame">
              {videoUrl ? (
                <PreviewStage
                  key={previewRetryKey}
                  clipId={clipId}
                  videoUrl={videoUrl}
                  posterUrl={posterUrl}
                  edits={previewEdits}
                  words={words}
                  brandLogoUrl={brandLogoUrl}
                  cropTrack={props.cropTrack}
                  brollMedia={props.brollMedia}
                  media={media}
                  canvasBgImageUrl={canvasBgImageUrl}
                  safeZoneVisible={safeZoneVisible}
                  videoRef={videoRef}
                  onEditorMediaError={onMediaError}
                  onTick={(tick) => {
                    setPlayhead(tick.sourceMs)
                    setPlayheadOut(tick.outputMs)
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
                {clock(displayPositionMs(previewEdits, playheadOut))} / {clock(displayDurationMs(previewEdits))}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{effectiveAspect}</span>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card/60 px-5 py-4">
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
          <StandaloneEditorToolRail
            label="Template tools"
            items={[
              { id: 'layouts', label: 'Layouts', icon: LayoutGrid, active: tab === 'layouts', onSelect: () => setTab('layouts') },
              { id: 'captions', label: 'Captions', icon: Type, active: tab === 'captions', onSelect: () => setTab('captions') },
              { id: 'looks', label: 'Looks', icon: Palette, active: tab === 'looks', onSelect: () => setTab('looks') },
              { id: 'brand', label: 'Brand', icon: Sparkles, active: tab === 'brand', onSelect: () => setTab('brand') },
            ]}
          />
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

        {customizerOpen && customizerEdits ? (
          <div className="fixed inset-0 z-[70] bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="Template customizer">
            <div className="mx-auto flex h-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl" data-testid="templates-customizer">
              <div className="flex min-h-0 flex-1">
                <nav className="w-36 shrink-0 border-r border-border bg-card/50 p-2" aria-label="Customizer sections">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customize</p>
                  <div className="space-y-1">
                    {CUSTOMIZER_NAV.map((item) => {
                      const reason = customizerDisabledReason(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={Boolean(reason)}
                          title={reason ?? undefined}
                          className={cn(
                            'w-full rounded-md px-2 py-2 text-left text-xs font-medium',
                            customizerSection === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            reason && 'cursor-not-allowed opacity-45',
                          )}
                          onClick={() => {
                            setCustomizerSection(item.id)
                            console.info('[editor:templates-gaps] customizer-section', { projectId, clipId, section: item.id })
                          }}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </nav>

                <section className="min-w-0 flex-[1_1_48%] overflow-y-auto border-r border-border p-4" aria-label="Customizer controls">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold">{CUSTOMIZER_NAV.find((item) => item.id === customizerSection)?.label}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">All changes below stay local until Apply. Saving a reusable style is separate.</p>
                  </div>

                  {customizerGalleryEntries.length ? (
                    <div className="mb-4">
                      <p className="mb-2 text-[11px] font-medium">Style previews</p>
                      <div className="grid grid-cols-3 gap-2">
                        {customizerGalleryEntries.map((entry) => (
                          <button
                            key={'customizer:' + entry.key}
                            type="button"
                            className={cn(
                              'overflow-hidden rounded-lg border text-left',
                              selectedEntry?.key === entry.key ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/50',
                            )}
                            onClick={() => chooseCustomizerEntry(entry)}
                          >
                            <CatalogTplThumb item={entry.item} />
                            <span className="block truncate px-2 py-1 text-[10px] font-medium">{entry.item.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {customizerSection === 'layout' ? (
                    <div className="space-y-4">
                      <LayoutQuickPicker
                        value={customizerEdits.layout.mode}
                        edits={customizerEdits}
                        facecamLayout={props.facecamLayout}
                        reframeV2Enabled={props.reframeV2Enabled}
                        onPick={(mode, facecam) =>
                          setCustomizerEdits((current) => current ? {
                            ...current,
                            layout: {
                              ...current.layout,
                              mode,
                              ...(facecam ? { facecam } : {}),
                              userPicked: true,
                            },
                          } : current)
                        }
                        onAspectChange={(aspect) =>
                          setCustomizerEdits((current) => current ? { ...current, aspectRatio: aspect } : current)
                        }
                      />
                      <TemplateLayoutPanel
                        edits={customizerEdits}
                        onEdits={setCustomizerEdits}
                        aiMeta={props.aiMeta as Record<string, unknown> | null}
                        videoUrl={videoUrl}
                        posterUrl={posterUrl}
                      />
                    </div>
                  ) : customizerSection === 'subtitle' ? (
                    <CaptionTypographyEditor
                      edits={customizerEdits}
                      onPatch={(patch) => setCustomizerEdits((current) => current ? withCaptionPatch(current, patch) : current)}
                    />
                  ) : customizerSection === 'headline' ? (
                    <EditorHeadlineField
                      clipId={clipId}
                      edits={customizerEdits}
                      onEdits={setCustomizerEdits}
                      previewOnly
                    />
                  ) : customizerSection === 'background' ? (
                    <div>
                      <CanvasBackgroundControls
                        edits={customizerEdits}
                        onCommit={setCustomizerEdits}
                        media={projectMedia}
                        projectId={projectId}
                        clipId={clipId}
                        showApplyAll={false}
                        allowUpload={false}
                      />
                      <p className="mt-2 text-[10px] text-muted-foreground">New image uploads stay in the full editor; this preview-only customizer can use existing project images.</p>
                    </div>
                  ) : customizerSection === 'logo' ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-muted-foreground">Choose a saved brand kit that already contains a logo. Upload new logo assets from Manage templates.</p>
                      <BrandPanel edits={customizerEdits} onEdits={setCustomizerEdits} previewOnly />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-muted-foreground">Choose a saved brand kit with an existing outro bumper, then toggle it locally for this style preview.</p>
                      <BrandPanel edits={customizerEdits} onEdits={setCustomizerEdits} previewOnly />
                    </div>
                  )}
                </section>

                <section className="flex min-w-[420px] flex-[1_1_52%] flex-col bg-muted/15 p-4" aria-label="Customizer live preview">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">Live preview</p>
                      <p className="text-[10px] text-muted-foreground">{customizerEdits.aspectRatio ?? '9:16'} · preview only</p>
                    </div>
                    <Button size="sm" variant={safeZoneVisible ? 'secondary' : 'outline'} onClick={() => setSafeZoneVisible(!safeZoneVisible)}>
                      {safeZoneVisible ? 'Hide safe zone' : 'Show safe zone'}
                    </Button>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-black/80">
                    {videoUrl ? (
                      <PreviewStage
                        key={'customizer:' + previewRetryKey}
                        clipId={clipId}
                        videoUrl={videoUrl}
                        posterUrl={posterUrl}
                        edits={editorPreviewEdits(customizerEdits, words)}
                        words={words}
                        brandLogoUrl={brandLogoUrl}
                        cropTrack={props.cropTrack}
                        brollMedia={props.brollMedia}
                        media={media}
                        canvasBgImageUrl={
                          customizerEdits.canvasBg?.type === 'image' && customizerEdits.canvasBg.imageId
                            ? mediaUrlFor(projectMedia.items, customizerEdits.canvasBg.imageId)
                            : null
                        }
                        safeZoneVisible={safeZoneVisible}
                        videoRef={customizerVideoRef}
                        onEditorMediaError={onMediaError}
                        onTick={(tick) => {
                          setPlayhead(tick.sourceMs)
                          setPlayheadOut(tick.outputMs)
                          setPlaying(tick.playing)
                        }}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">Preview media unavailable</p>
                    )}
                  </div>
                </section>
              </div>

              <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card/60 px-4 py-3">
                <p className="mr-auto text-[11px] text-muted-foreground">
                  Cancel discards only customizer-local changes. Save creates a reusable style; it does not apply the preview.
                </p>
                <input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder="Reusable style name"
                  className="h-9 w-56 rounded-md border border-border bg-background px-3 text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setCustomizerOpen(false)
                    setCustomizerEdits(null)
                    setPresetName('')
                    console.info('[editor:templates-gaps] customizer-cancel', { projectId, clipId, scope: 'customizer-local' })
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={savingPreset || reusableUnsupported}
                  title={reusableUnsupported ? 'This draft contains fields the reusable brand-style schema cannot store faithfully' : undefined}
                  onClick={() => void saveReusableStyle()}
                >
                  {savingPreset ? <><Loader2 className="mr-1 size-4 animate-spin" />Saving…</> : 'Save reusable style'}
                </Button>
              </footer>
            </div>
          </div>
        ) : null}

        {handoffTarget ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Unapplied layout preview">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl">
              <h2 className="text-sm font-semibold">Unapplied layout preview</h2>
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
