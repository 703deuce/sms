'use client'

import type { CatalogItem } from '@/lib/clips/templates/catalog'
import { layoutPanesForSegment, type LayoutPane } from '@/components/clips/editor/segment-layout-preview'
import { layoutForKind } from '@/lib/clips/editor/multicam-layout-pick'
import { type SegmentLayoutKind, type SourceSegmentLayout } from '@/lib/clips/editor/segment-layout'
import { defaultUploadCropBox, stackPanelStyles } from '@/lib/clips/facecam-geometry'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { MAIN_ANGLE } from '@/lib/clips/editor/multicam-manual'
import { resolveTemplateGeometry } from '@/lib/clips/templates/geometry'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'
import { T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'
import { cn } from '@/lib/utils'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import { captionPresetPatch, STARTER_LOOKS } from '@/lib/clips/editor/starter-templates'

const PREVIEW_BOUNDS = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }

export type SchematicRegion = {
  x: number
  y: number
  w: number
  h: number
  label?: string
  thin?: boolean
}

const TINTS = [
  'bg-primary/20 border-primary/40',
  'bg-sky-500/25 border-sky-400/40',
  'bg-violet-500/25 border-violet-400/40',
  'bg-amber-500/25 border-amber-400/40',
]

function roleLabel(role: string, index: number): string | undefined {
  const r = role.toLowerCase()
  if (r.includes('caption')) return 'Caption'
  if (r.includes('game') || r === 'content') return 'Gameplay'
  if (r.includes('face') || r === 'pip') return 'Facecam'
  if (r.includes('speaker') || r.includes('person')) return index === 0 ? 'Speaker A' : 'Speaker B'
  if (r.includes('title') || r.includes('headline')) return 'Title'
  return role ? role.replace(/_/g, ' ') : undefined
}

function paneLabel(pane: LayoutPane, index: number): string {
  if (index === 0) return 'Speaker A'
  if (index === 1) return 'Speaker B'
  if (index === 2) return 'Speaker C'
  return 'Speaker D'
}

function paneToRegion(pane: LayoutPane, index: number): SchematicRegion {
  return {
    x: pane.rect.l,
    y: pane.rect.t,
    w: pane.rect.w,
    h: pane.rect.h,
    label: paneLabel(pane, index),
  }
}

function mockMulticamEdits(): ClipEditsV2 {
  const base = defaultEdits(PREVIEW_BOUNDS)
  return {
    ...base,
    sources: [
      { id: 'cam_b', refId: 'ref_b', ref: 'upload', mediaType: 'video', label: 'B', syncMs: 0 },
      { id: 'cam_c', refId: 'ref_c', ref: 'upload', mediaType: 'video', label: 'C', syncMs: 0 },
      { id: 'cam_d', refId: 'ref_d', ref: 'upload', mediaType: 'video', label: 'D', syncMs: 0 },
    ],
  }
}

function syntheticMulticamLayout(kind: SegmentLayoutKind): SourceSegmentLayout {
  if (kind === 'grid') {
    return { kind, withSourceId: 'cam_b', withSourceId2: 'cam_c', withSourceId3: 'cam_d' }
  }
  if (kind === 'pip') {
    return { kind, withSourceId: 'cam_b', pipCorner: 'BR', pipScale: 0.3 }
  }
  return { kind, withSourceId: 'cam_b', split: 0.5 }
}

export function regionsForClipLayoutMode(mode: string): SchematicRegion[] {
  switch (mode) {
    case 'split':
      return [
        { x: 0, y: 0, w: 0.5, h: 1, label: 'Speaker A' },
        { x: 0.5, y: 0, w: 0.5, h: 1, label: 'Speaker B' },
      ]
    case 'grid3':
      return [
        { x: 0, y: 0, w: 0.5, h: 0.5, label: 'Speaker A' },
        { x: 0.5, y: 0, w: 0.5, h: 0.5, label: 'Speaker B' },
        { x: 0.25, y: 0.5, w: 0.5, h: 0.5, label: 'Speaker C' },
      ]
    case 'grid4':
      return [
        { x: 0, y: 0, w: 0.5, h: 0.5, label: 'Speaker A' },
        { x: 0.5, y: 0, w: 0.5, h: 0.5, label: 'Speaker B' },
        { x: 0, y: 0.5, w: 0.5, h: 0.5, label: 'Speaker C' },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5, label: 'Speaker D' },
      ]
    case 'facecam_stack': {
      const { faceFrac, gameFrac, faceFirst } = stackPanelStyles(0.35, 'top')
      if (faceFirst) {
        return [
          { x: 0, y: 0, w: 1, h: faceFrac, label: 'Facecam' },
          { x: 0, y: faceFrac, w: 1, h: gameFrac, label: 'Gameplay' },
        ]
      }
      return [
        { x: 0, y: 0, w: 1, h: gameFrac, label: 'Gameplay' },
        { x: 0, y: gameFrac, w: 1, h: faceFrac, label: 'Facecam' },
      ]
    }
    case 'facecam_pip':
    case 'screen_pip': {
      const scale = 0.3
      const m = 0.04
      const w = scale
      const h = scale * (9 / 16)
      return [
        { x: 0, y: 0, w: 1, h: 1, label: 'Gameplay' },
        { x: 1 - w - m, y: 1 - h - m, w, h, label: 'Facecam' },
      ]
    }
    case 'fit_top':
      return [
        { x: 0, y: 0, w: 1, h: 0.2, label: 'Title' },
        { x: 0, y: 0.2, w: 1, h: 0.65, label: 'Gameplay' },
        { x: 0, y: 0.85, w: 1, h: 0.15, label: 'Caption', thin: true },
      ]
    case 'fit_blur':
    case 'full_frame':
      return [{ x: 0.08, y: 0.22, w: 0.84, h: 0.56, label: 'Gameplay' }]
    case 'center_crop':
    case 'speaker_follow':
    case 'subject_follow': {
      const crop = defaultUploadCropBox()
      return [{ x: crop.x, y: crop.y, w: crop.w, h: crop.h, label: 'Speaker A' }]
    }
    case 'dynamic':
    case 'auto':
      return [
        { x: 0, y: 0, w: 0.5, h: 1, label: 'Speaker A' },
        { x: 0.5, y: 0, w: 0.5, h: 1, label: 'Speaker B' },
      ]
    default:
      return [{ x: 0.1, y: 0.15, w: 0.8, h: 0.7, label: 'Video' }]
  }
}

export function catalogSchematicRegions(item: CatalogItem): SchematicRegion[] {
  if (item.kind === 'layout') {
    return regionsForClipLayoutMode(String(item.mock.mode ?? item.id))
  }
  if (item.kind === 'multicam') {
    const kind = item.id as SegmentLayoutKind
    const edits = mockMulticamEdits()
    const layout =
      layoutForKind(kind, MAIN_ANGLE, edits, edits.sources ?? []) ?? syntheticMulticamLayout(kind)
    return layoutPanesForSegment(layout, MAIN_ANGLE).map(paneToRegion)
  }
  if (item.kind === 'layout_template') {
    const t = T6_TEMPLATES_BY_ID[item.id]
    if (!t) return [{ x: 0.1, y: 0.2, w: 0.8, h: 0.6, label: 'Layout' }]
    const spec = resolveTemplateGeometry(t, signalsOrDefaults(null), defaultEdits(PREVIEW_BOUNDS), 1080, 1920)
    const regions: SchematicRegion[] = []
    spec.panels.forEach((p, i) => {
      regions.push({
        x: p.dest.x / spec.playW,
        y: p.dest.y / spec.playH,
        w: p.dest.w / spec.playW,
        h: p.dest.h / spec.playH,
        label: roleLabel(String(t.panels[i]?.role ?? ''), i),
      })
    })
    if (spec.pip) {
      regions.push({
        x: spec.pip.dest.x / spec.playW,
        y: spec.pip.dest.y / spec.playH,
        w: spec.pip.dest.w / spec.playW,
        h: spec.pip.dest.h / spec.playH,
        label: 'Facecam',
      })
    }
    regions.push({
      x: spec.captionRect.x / spec.playW,
      y: spec.captionRect.y / spec.playH,
      w: spec.captionRect.w / spec.playW,
      h: Math.max(0.04, spec.captionRect.h / spec.playH),
      label: 'Caption',
      thin: true,
    })
    return regions.length ? regions : [{ x: 0.05, y: 0.1, w: 0.9, h: 0.75, label: 'Layout' }]
  }
  return []
}

export function LayoutSchematic({ regions, className }: { regions: SchematicRegion[]; className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[9/16] max-h-44 w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-black',
        className,
      )}
    >
      {regions.map((r, i) => (
        <div
          key={`${r.label ?? 'r'}-${i}`}
          data-region
          className={cn(
            'absolute flex items-center justify-center overflow-hidden rounded-md border text-[11px] font-semibold uppercase tracking-wide text-white/90',
            TINTS[i % TINTS.length],
            r.thin ? 'min-h-[8px] py-0' : '',
          )}
          style={{
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            width: `${r.w * 100}%`,
            height: `${r.h * 100}%`,
          }}
        >
          {r.label ? <span className="px-1 text-center leading-tight">{r.label}</span> : null}
        </div>
      ))}
    </div>
  )
}

export function CatalogTplThumb({ item }: { item: CatalogItem }) {
  if (item.kind === 'layout' || item.kind === 'layout_template' || item.kind === 'multicam') {
    const regions = catalogSchematicRegions(item)
    return <LayoutSchematic regions={regions.length ? regions : [{ x: 0.08, y: 0.12, w: 0.84, h: 0.76, label: 'Layout' }]} />
  }
  if (item.kind === 'caption') {
    const edits = captionPresetPatch(defaultEdits(PREVIEW_BOUNDS), item.id)
    return (
      <div className="relative aspect-[9/16] max-h-44 w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-zinc-800 via-black to-zinc-950">
        <div className="absolute inset-x-5 top-8 h-20 rounded-lg border border-white/10 bg-white/5" />
        <CaptionOverlay words={[{ w: 'Sample line', s: 0, e: 2, spk: 0 }]} edits={edits} currentTimeSec={0.5} boxHeightPx={320} outputDurationSec={3} staticPreview />
      </div>
    )
  }
  if (item.kind === 'brand_starter') {
    const palette = (item.mock.palette as string[] | undefined) ?? ['#111827', '#38bdf8']
    const font = String(item.mock.captionFont ?? 'Inter')
    return (
      <div className="flex aspect-[9/16] max-h-44 w-full flex-col justify-end gap-2 overflow-hidden rounded-t-xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-black p-3">
        <div className="mb-auto mt-4 rounded-lg border border-white/10 bg-white/5 p-2"><div className="h-1.5 w-16 rounded-full bg-white/25" /><div className="mt-2 h-10 rounded-md border border-white/10 bg-black/25" /></div>
        <div className="flex gap-1">{palette.slice(0, 5).map((color) => <span key={color} className="size-5 rounded-full border border-white/20" style={{ background: color }} />)}</div>
        <p className="text-xs font-bold text-white" style={{ fontFamily: captionFontStack(font) }}>Brand kit</p>
      </div>
    )
  }
  if (item.kind === 'look') {
    const look = STARTER_LOOKS.find((candidate) => candidate.id === item.id)
    const edits = captionPresetPatch(defaultEdits(PREVIEW_BOUNDS), look?.caption ?? 'clean_white')
    const regions = regionsForClipLayoutMode(look?.layoutMode ?? 'speaker_follow')
    return (
      <div className="relative aspect-[9/16] max-h-44 w-full overflow-hidden rounded-t-xl bg-black">
        <LayoutSchematic regions={regions} className="rounded-none" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/35" />
        <CaptionOverlay words={[{ w: 'Creator look', s: 0, e: 2, spk: 0 }]} edits={edits} currentTimeSec={0.5} boxHeightPx={320} outputDurationSec={3} staticPreview />
      </div>
    )
  }
  if (item.kind === 'look_feature') {
    return (
      <div className="relative aspect-[9/16] max-h-44 w-full overflow-hidden rounded-t-xl bg-zinc-800">
        <div className="absolute inset-2 rounded-lg border border-dashed border-white/30 bg-zinc-700/60" />
        <div className="absolute inset-x-[28%] bottom-0 top-[18%] rounded-t-full border border-white/20 bg-black/65" />
        <div className="absolute inset-x-3 bottom-3 rounded-md bg-black/65 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white">Background</div>
      </div>
    )
  }
  return null
}
