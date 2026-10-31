import type { FacecamBox } from '@/lib/clips/facecam-geometry'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { T6Face, T6Signals } from '@/lib/clips/templates/signals'
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

// ---- T6.3: face/person-aware sources (parity with t6_geometry._resolve_src) ----
const FACE_SRCS = new Set(['face_tight', 'active_speaker'])

function r4(v: number): number {
  return Math.round(v * 10000) / 10000
}

function centerIn(f: T6Face, r: FacecamBox): boolean {
  const cx = f.x + f.w / 2
  const cy = f.y + f.h / 2
  return r.x <= cx && cx <= r.x + r.w && r.y <= cy && cy <= r.y + r.h
}

function cropAt(cx: number, cy: number, h0: number, panelAspect: number, region: FacecamBox): FacecamBox {
  let h = h0
  let w = (h * panelAspect) / SRC_ASPECT
  const k = Math.min(1, w > 0 ? region.w / w : 1, h > 0 ? region.h / h : 1)
  w *= k
  h *= k
  const x = Math.min(Math.max(cx - w / 2, region.x), region.x + region.w - w)
  const y = Math.min(Math.max(cy - h / 2, region.y), region.y + region.h - h)
  return { x: r4(clamp01(x)), y: r4(clamp01(y)), w: r4(clamp01(w)), h: r4(clamp01(h)) }
}

function faceCrop(
  face: T6Face,
  panelAspect: number,
  region: FacecamBox,
  faceFrac: number,
  topInset = 0,
): FacecamBox {
  const cx = face.x + face.w / 2
  const fcy = face.y + face.h / 2
  const t = Math.max(0, Math.min(0.8, topInset))
  if (t <= 0) {
    const h = Math.min(region.h, face.h / Math.max(0.05, faceFrac))
    return cropAt(cx, fcy + h * 0.08, h, panelAspect, region)
  }
  const h0 = Math.min(region.h, face.h / Math.max(0.05, faceFrac * (1 - t)))
  return cropUnderTitle(face, face.h, h0, panelAspect, region, t)
}

/** T6.3/T6.6 parity with t6_geometry._crop_under_title. */
function cropUnderTitle(
  face: T6Face,
  fh: number,
  h0: number,
  panelAspect: number,
  region: FacecamBox,
  t: number,
  cxOverride?: number,
  fcyOverride?: number,
): FacecamBox {
  const cx = cxOverride ?? face.x + face.w / 2
  const fcy = fcyOverride ?? face.y + face.h / 2
  let h = Math.min(1, Math.max(h0, fh / (0.9 * (1 - t))))
  const ft = t + (1 - t) * 0.45
  // T6.6: stay inside the region (no black game strip above a bottom facecam): zoom in up to
  // MAX_TITLE_ZOOM (never tighter than the face needs) so the face sits under the title in the box.
  if (!isFullFrame(region) && fcy - ft * h < region.y) {
    h = Math.max(h / MAX_TITLE_ZOOM, (fcy - region.y) / ft, fh / (0.95 * (1 - t)))
    if (fcy - ft * h < region.y - 1e-4) {
      // Impossible inside the box even at max zoom (e.g. G1: title covers 57% of the face panel):
      // spill the minimum, and only into the strip hidden under the title.
      const ny = Math.max(0, region.y - t * h, fcy - ft * h)
      const ext = { x: region.x, y: ny, w: region.w, h: Math.min(1 - ny, region.h + (region.y - ny)) }
      return cropAt(cx, fcy - ft * h + h / 2, h, panelAspect, ext)
    }
  }
  return cropAt(cx, fcy - ft * h + h / 2, h, panelAspect, region)
}

/** T6.6: max extra zoom used to keep a titled face crop inside its facecam box (parity: t6_geometry.MAX_TITLE_ZOOM). */
export const MAX_TITLE_ZOOM = 2.0

function isFullFrame(r: FacecamBox): boolean {
  return r.x <= 1e-6 && r.y <= 1e-6 && r.w >= 1 - 1e-6 && r.h >= 1 - 1e-6
}

export function widenToAspectWithin(region: FacecamBox, panelAspect: number): FacecamBox {
  const rw = Math.max(0.01, region.w)
  const rh = Math.max(0.01, region.h)
  return cropAt(region.x + rw / 2, region.y + rh / 2, rh, panelAspect, region)
}

function coverOnFaces(box: FacecamBox, faces: T6Face[], panelAspect: number, topInset = 0): FacecamBox {
  const full = widenToAspectWithin(box, panelAspect)
  const t = Math.max(0, Math.min(0.8, topInset))
  if (t > 0) {
    const fh = Math.max(...faces.map((f) => f.h))
    const x0 = Math.min(...faces.map((f) => f.x - 0.5 * f.w))
    const x1 = Math.max(...faces.map((f) => f.x + 1.5 * f.w))
    const y0 = Math.min(...faces.map((f) => f.y))
    const y1 = Math.max(...faces.map((f) => f.y + f.h))
    let cx: number
    let cy: number
    if (x1 - x0 <= full.w) {
      cx = (x0 + x1) / 2
      cy = (y0 + y1) / 2
    } else {
      const p = faces[0]
      cx = p.x + p.w / 2
      cy = p.y + p.h / 2
    }
    return cropUnderTitle(faces[0], fh, full.h, panelAspect, box, t, cx, cy)
  }
  if (full.w >= box.w - 1e-3 && full.h >= box.h - 1e-3) return box
  const x0 = Math.min(...faces.map((f) => f.x - 0.5 * f.w))
  const x1 = Math.max(...faces.map((f) => f.x + 1.5 * f.w))
  const y0 = Math.min(...faces.map((f) => f.y))
  const y1 = Math.max(...faces.map((f) => f.y + f.h))
  let cx: number
  let cy: number
  if (x1 - x0 <= full.w) {
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
  } else {
    const p = faces[0]
    cx = p.x + p.w / 2
    cy = p.y + p.h / 2
  }
  return cropAt(cx, cy + full.h * 0.08, full.h, panelAspect, box)
}

function facecamRegion(signals: T6Signals, edits: ClipEditsV2): FacecamBox | null {
  const boxes = edits.layout.template?.boxes as Record<string, FacecamBox | undefined> | undefined
  const b = boxes?.facecam_box ?? boxes?.facecam
  if (b) return b
  if (edits.layout.facecam?.box) return edits.layout.facecam.box
  return signals.facecam_box ?? null
}

function resolveSrc(
  name: string,
  signals: T6Signals,
  edits: ClipEditsV2,
  panelAspect: number,
  role: string,
  topInset = 0,
  panelHFrac = 0.55,
): { src: FacecamBox; fit?: string } {
  const boxes = edits.layout.template?.boxes as Record<string, FacecamBox | undefined> | undefined
  const faces = signals.faces ?? []
  if (boxes?.[name] && (FACE_SRCS.has(name) || name.startsWith('person:'))) return { src: boxes[name]! }
  if (FACE_SRCS.has(name)) {
    const region = facecamRegion(signals, edits)
    const cands = faces.filter((f) => !region || centerIn(f, region))
    if (cands.length) {
      // Face ~34% of a half-height panel; a taller panel (C1 full screen) shows head+shoulders.
      const ff = 0.34 * Math.min(1, 0.55 / Math.max(0.2, panelHFrac))
      return { src: faceCrop(cands[0], panelAspect, region ?? DEFAULT_FULL, ff, topInset) }
    }
    if (region) return { src: widenToAspectWithin(region, panelAspect) }
    return { src: { ...DEFAULT_FULL }, fit: 'contain_blur' }
  }
  if (name.startsWith('person:')) {
    const idx = Number.parseInt(name.split(':')[1] ?? '0', 10) || 0
    const pb = (signals as unknown as Record<string, FacecamBox | undefined>)[name]
    if (pb && typeof pb === 'object') return { src: pb }
    if (idx < faces.length) return { src: faceCrop(faces[idx], panelAspect, DEFAULT_FULL, 0.2, topInset) }
    return { src: { ...DEFAULT_FULL }, fit: 'contain_blur' }
  }
  if (name === 'facecam_box' && (role === 'face' || role === '')) {
    if (!facecamRegion(signals, edits)) return resolveSrc('face_tight', signals, edits, panelAspect, role, topInset, panelHFrac)
    const box = srcBox(name, signals, edits, panelAspect)
    const inside = faces.filter((f) => centerIn(f, box))
    if (!inside.length) return { src: box }
    return { src: coverOnFaces(box, inside, panelAspect, topInset) }
  }
  return { src: srcBox(name, signals, edits, panelAspect) }
}

function gameplayRegion(signals: T6Signals, edits: ClipEditsV2): FacecamBox | null {
  const boxes = edits.layout.template?.boxes as Record<string, FacecamBox | undefined> | undefined
  for (const b of [boxes?.gameplay, edits.layout.facecam?.gameplay, signals.gameplay_box ?? undefined]) {
    if (b && b.w > 0 && b.h > 0) return b
  }
  return null
}

function srcBox(
  name: string,
  signals: T6Signals,
  edits: ClipEditsV2,
  panelAspect: number,
): FacecamBox {
  const boxes = edits.layout.template?.boxes
  if (name === 'facecam_box' && (boxes?.facecam_box ?? boxes?.facecam)) {
    return (boxes.facecam_box ?? boxes.facecam)!
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
    // T6.3 parity: no action box -> detected/user game region (excludes the cam/HUD strip).
    const base = edits.layout.cropBox ?? signals.action_box ?? gameplayRegion(signals, edits) ?? DEFAULT_FULL
    return name === 'action_box_widened' ? widenToAspect(base, panelAspect) : base
  }
  if (name === 'gameplay_box') {
    // T6.2 parity with t6_geometry._src_box: whole game region, never a zoomed crop.
    return gameplayRegion(signals, edits) ?? DEFAULT_FULL
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
  const src = srcBox(String(pip.src ?? 'facecam_box'), signals, edits, 1)
  // T6.2 parity with t6_geometry._pip_size: wide cam boxes keep aspect (rect).
  const srcAspect = (Math.max(0.01, src.w) * (16 / 9)) / Math.max(0.01, src.h)
  const wide = srcAspect > 1.3
  const size = wide ? even(playW * Math.max(frac, 0.6)) : even(playW * frac)
  const pipH = wide ? Math.max(2, even(size / srcAspect)) : size
  const hb = edits.exportTemplate?.headlineBar
  const headlineOn = Boolean(hb?.enabled && String(hb?.text ?? '').trim())
  const action = srcBox('action_box', signals, edits, 1)
  const ax = action.x + action.w / 2
  const ay = action.y + action.h / 2
  const margin = Math.round(playW * 0.04)
  const allCorners: [number, number][] = [
    [margin, margin],
    [playW - size - margin, margin],
    [margin, playH - pipH - margin],
    [playW - size - margin, playH - pipH - margin],
  ]
  const corners = headlineOn ? allCorners.slice(2) : allCorners
  const dist = (c: [number, number]) => {
    const cx = c[0] + size / 2
    const cy = c[1] + pipH / 2
    return (cx / playW - ax) ** 2 + (cy / playH - ay) ** 2
  }
  const [x, y] = corners.reduce((best, c) => (dist(c) > dist(best) ? c : best))
  return {
    dest: { x, y, w: size, h: pipH },
    src,
    shape: wide ? 'rect' : String(pip.shape ?? 'circle'),
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

/** T6.3 parity with t6_geometry._title_band (fallback bar = exportBar.barFrac 0.20). */
function titleBandSpan(
  t: TemplateDef,
  bandsOut: TemplateBandSpec[],
  edits: ClipEditsV2,
  playW: number,
  playH: number,
): [number, number] | null {
  const hb = edits.exportTemplate?.headlineBar
  if (!(hb?.enabled && String(hb?.text ?? '').trim())) return null
  const r = titleRect(t, bandsOut, playW, playH)
  if (r && r.h >= 8) return [r.y, r.y + r.h]
  return [0, Math.round(playH * 0.2)]
}

export function resolveTemplateGeometry(
  t: TemplateDef,
  s: T6Signals,
  edits: ClipEditsV2,
  playW = 1080,
  playH = 1920,
): TemplateSpecV2 {
  const bandsPre: TemplateBandSpec[] = (t.bands ?? []).map((b) => ({
    dest: { x: 0, y: even(playH * b.y), w: playW, h: even(playH * b.h) },
    fill: b.fill,
  }))
  const titleBand = titleBandSpan(t, bandsPre, edits, playW, playH)
  const panels = t.panels.map((p, idx) => {
    const destY = even(playH * p.y)
    let destH = even(playH * p.h)
    if (idx === t.panels.length - 1 && Math.abs(p.y + p.h - 1) < 0.005) {
      destH = playH - destY
    }
    const destW = even(playW * (p.w ?? 1))
    const destX = even(playW * (p.x ?? 0))
    const panelAspect = destH > 0 ? destW / destH : 9 / 16
    let inset = 0
    if (titleBand && destH > 0) {
      const [ty0, ty1] = titleBand
      const ov = Math.min(ty1, destY + destH) - Math.max(ty0, destY)
      if (ov > 0 && ty0 <= destY + 1) inset = ov / destH
    }
    const r = resolveSrc(p.src, s, edits, panelAspect, p.role ?? '', inset, playH ? destH / playH : 0.55)
    return {
      dest: { x: destX, y: destY, w: destW, h: destH },
      src: r.src,
      fit: r.fit ?? p.fit,
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
