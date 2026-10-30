import type { FacecamBox } from '@/lib/clips/facecam-geometry'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { T6Signals } from '@/lib/clips/templates/signals'
import { T6_TEMPLATES_BY_ID, type TemplateDef } from '@/lib/clips/templates/registry'

export type TemplateBandSpec = {
  dest: { x: number; y: number; w: number; h: number }
  fill: string
}

export type TemplatePipSpec = {
  dest: { x: number; y: number; w: number; h: number }
  src: FacecamBox
  shape: string
}

export type TemplateSpecV2 = {
  v: 2
  kind: 'template'
  templateId: string
  playW: number
  playH: number
  panels: { dest: { x: number; y: number; w: number; h: number }; src: FacecamBox; fit: string }[]
  bands: TemplateBandSpec[]
  pip: TemplatePipSpec | null
  titleRect: { x: number; y: number; w: number; h: number } | null
  captionRect: { x: number; y: number; w: number; h: number }
  avoidRects: unknown[]
}

const DEFAULT_FACECAM: FacecamBox = { x: 0.02, y: 0.02, w: 0.32, h: 0.28 }
const DEFAULT_FULL: FacecamBox = { x: 0, y: 0, w: 1, h: 1 }
const SRC_ASPECT = 16 / 9

function even(n: number): number {
  const v = Math.round(n)
  return v - (v % 2)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

export function widenToAspect(
  box: FacecamBox,
  panelAspect: number,
  srcAspect = SRC_ASPECT,
): FacecamBox {
  let { x, y, w, h } = box
  w = Math.max(0.01, w)
  h = Math.max(0.01, h)
  const cx = x + w / 2
  const cy = y + h / 2
  const boxAr = (w * srcAspect) / h
  if (boxAr < panelAspect) h = (w * srcAspect) / panelAspect
  else w = (h * panelAspect) / srcAspect
  x = cx - w / 2
  y = cy - h / 2
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x + w > 1) x = Math.max(0, 1 - w)
  if (y + h > 1) y = Math.max(0, 1 - h)
  return { x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h) }
}

function trimSidesBox(signals: T6Signals, edits: ClipEditsV2): FacecamBox {
  const boxes: FacecamBox[] = []
  const tboxes = edits.layout.template?.boxes
  for (const key of ['action', 'action_box', 'person:0', 'person:1'] as const) {
    const b = tboxes?.[key as keyof typeof tboxes]
    if (b) boxes.push(b)
  }
  if (edits.layout.cropBox) boxes.push(edits.layout.cropBox)
  if (signals.action_box) boxes.push(signals.action_box)
  if (signals.content_box) boxes.push(signals.content_box)
  if (!boxes.length) return { x: 0.15, y: 0, w: 0.7, h: 1 }
  const x0 = Math.min(...boxes.map((b) => b.x)) - 0.05
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + 0.05
  let w = clamp01(Math.max(0.7, Math.min(1, x1 - x0)))
  const cx = (x0 + x1) / 2
  let x = clamp01(cx - w / 2)
  if (x + w > 1) x = Math.max(0, 1 - w)
  return { x, y: 0, w, h: 1 }
}

function srcBox(
  name: string,
  signals: T6Signals,
  edits: ClipEditsV2,
  panelAspect: number,
): FacecamBox {
  const boxes = edits.layout.template?.boxes
  if (boxes?.facecam_box ?? boxes?.facecam) && name === 'facecam_box') {
    return boxes.facecam_box ?? boxes.facecam!
  }
  if (boxes && name in boxes && boxes[name as keyof typeof boxes]) {
    const raw = boxes[name as keyof typeof boxes]!
    if (name === 'action_box_widened' || name.endsWith('_widened')) {
      return widenToAspect(raw, panelAspect)
    }
    return raw
  }
  if (name === 'facecam_box') {
    if (edits.layout.facecam?.box) return edits.layout.facecam.box
    return signals.facecam_box ?? DEFAULT_FACECAM
  }
  if (name === 'action_box' || name === 'action_box_widened') {
    const base = edits.layout.cropBox ?? signals.action_box ?? DEFAULT_FULL
    return name === 'action_box_widened' ? widenToAspect(base, panelAspect) : base
  }
  if (name === 'trim_sides') return trimSidesBox(signals, edits)
  if (name === 'content_box') {
    if (boxes?.content) return boxes.content
    return signals.content_box ?? DEFAULT_FULL
  }
  if (name === 'full') return DEFAULT_FULL
  if (name.startsWith('person:')) {
    const pk = name as keyof typeof boxes
    if (boxes?.[pk]) return boxes[pk]!
    return DEFAULT_FACECAM
  }
  return DEFAULT_FULL
}

function pipDest(
  pip: Record<string, unknown>,
  signals: T6Signals,
  edits: ClipEditsV2,
  playW: number,
  playH: number,
): TemplatePipSpec {
  const frac = Number(pip.w ?? 0.3)
  const size = even(playW * frac)
  const src = srcBox(String(pip.src ?? 'facecam_box'), signals, edits, 1)
  const action = srcBox('action_box', signals, edits, 1)
  const ax = action.x + action.w / 2
  const ay = action.y + action.h / 2
  const margin = Math.round(playW * 0.04)
  const corners: [number, number][] = [
    [margin, margin],
    [playW - size - margin, margin],
    [margin, playH - size - margin],
    [playW - size - margin, playH - size - margin],
  ]
  const dist = (c: [number, number]) => {
    const cx = c[0] + size / 2
    const cy = c[1] + size / 2
    return (cx / playW - ax) ** 2 + (cy / playH - ay) ** 2
  }
  const [x, y] = corners.reduce((best, c) => (dist(c) > dist(best) ? c : best))
  return {
    dest: { x, y, w: size, h: size },
    src,
    shape: String(pip.shape ?? 'circle'),
  }
}

function titleRect(
  t: TemplateDef,
  bandsOut: TemplateBandSpec[],
  playW: number,
  playH: number,
): { x: number; y: number; w: number; h: number } | null {
  const slot = t.title?.slot ?? ''
  if ((slot === 'band_top' || slot === 'on_video_top') && bandsOut.length) {
    const top = bandsOut.reduce((a, b) => (a.dest.y <= b.dest.y ? a : b))
    return { ...top.dest }
  }
  return null
}

export function resolveTemplateGeometry(
  t: TemplateDef,
  s: T6Signals,
  edits: ClipEditsV2,
  playW = 1080,
  playH = 1920,
): TemplateSpecV2 {
  const panels = t.panels.map((p, idx) => {
    const destY = even(playH * p.y)
    let destH = even(playH * p.h)
    if (idx === t.panels.length - 1 && Math.abs(p.y + p.h - 1) < 0.005) {
      destH = playH - destY
    }
    const destW = even(playW * (p.w ?? 1))
    const destX = even(playW * (p.x ?? 0))
    const panelAspect = destH > 0 ? destW / destH : 9 / 16
    return {
      dest: { x: destX, y: destY, w: destW, h: destH },
      src: srcBox(p.src, s, edits, panelAspect),
      fit: p.fit,
    }
  })
  const bands: TemplateBandSpec[] = (t.bands ?? []).map((b) => ({
    dest: { x: 0, y: even(playH * b.y), w: playW, h: even(playH * b.h) },
    fill: b.fill,
  }))
  const capY = t.captions?.y ?? 0.65
  const pip = t.pip ? pipDest(t.pip as Record<string, unknown>, s, edits, playW, playH) : null
  return {
    v: 2,
    kind: 'template',
    templateId: t.id,
    playW,
    playH,
    panels,
    bands,
    pip,
    titleRect: titleRect(t, bands, playW, playH),
    captionRect: { x: 0, y: even(playH * capY), w: playW, h: even(playH * 0.12) },
    avoidRects: [],
  }
}

export function resolveTemplateGeometryById(
  id: string,
  s: T6Signals,
  edits: ClipEditsV2,
): TemplateSpecV2 | null {
  const t = T6_TEMPLATES_BY_ID[id]
  if (!t) return null
  return resolveTemplateGeometry(t, s, edits)
}
