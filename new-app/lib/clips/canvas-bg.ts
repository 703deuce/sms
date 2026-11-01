import type { ClipEditsV2 } from '@/lib/clips/edits'
import { aspectRatioParts, type ExportAspect } from '@/lib/clips/export-aspect'
import {
  DEFAULT_FIT_BLUR_STRENGTH,
  type FitBlurStrength,
  normalizeFitBlurStrength,
} from '@/lib/clips/fit-blur'

export type CanvasBgType = 'none' | 'color' | 'blur' | 'image'

export type CanvasBg = {
  type: CanvasBgType
  color?: string
  imageId?: string
  blur?: FitBlurStrength
}

export const CANVAS_BG_TYPES: CanvasBgType[] = ['none', 'color', 'blur', 'image']
export const CANVAS_BG_LABELS: Record<CanvasBgType, string> = {
  none: 'None',
  color: 'Color',
  blur: 'Blur',
  image: 'Image',
}
export const CANVAS_BG_SWATCHES = [
  '#000000',
  '#FFFFFF',
  '#1F2937',
  '#9CA3AF',
  '#EF4444',
  '#F97316',
  '#FACC15',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
] as const
export const DEFAULT_CANVAS_COLOR = '#000000'

const UPLOAD_ID_RE = /^[A-Za-z0-9_-]{1,120}$/
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export type ResolvedCanvasBg =
  | { kind: 'legacy' }
  | { kind: 'blur'; strength: FitBlurStrength }
  | { kind: 'color'; hex: string }
  | { kind: 'image'; imageId: string }

export function normalizeCanvasBg(raw: unknown): CanvasBg | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const type = o.type
  if (type !== 'none' && type !== 'color' && type !== 'blur' && type !== 'image') return undefined
  if (type === 'none') return { type: 'none' }
  if (type === 'color') {
    const c = typeof o.color === 'string' && HEX_RE.test(o.color) ? o.color.toUpperCase() : DEFAULT_CANVAS_COLOR
    return { type: 'color', color: c }
  }
  if (type === 'blur') {
    const blur = normalizeFitBlurStrength(o.blur) ?? DEFAULT_FIT_BLUR_STRENGTH
    return { type: 'blur', blur }
  }
  const imageId = typeof o.imageId === 'string' && UPLOAD_ID_RE.test(o.imageId) ? o.imageId : undefined
  if (!imageId) return undefined
  return { type: 'image', imageId }
}

export function resolveCanvasBg(edits: Pick<ClipEditsV2, 'canvasBg' | 'layout'>): ResolvedCanvasBg {
  const cb = edits.canvasBg
  if (!cb) return { kind: 'legacy' }
  if (cb.type === 'none') return { kind: 'color', hex: DEFAULT_CANVAS_COLOR }
  if (cb.type === 'color') return { kind: 'color', hex: cb.color ?? DEFAULT_CANVAS_COLOR }
  if (cb.type === 'image' && cb.imageId) return { kind: 'image', imageId: cb.imageId }
  if (cb.type === 'blur') {
    return { kind: 'blur', strength: cb.blur ?? normalizeFitBlurStrength(edits.layout?.blurStrength) ?? DEFAULT_FIT_BLUR_STRENGTH }
  }
  return { kind: 'legacy' }
}

/** True when export frames differ from legacy default preview (incl. non-strong blur). */
export function canvasBgChangesFrames(edits: Pick<ClipEditsV2, 'canvasBg' | 'layout'>): boolean {
  const resolved = resolveCanvasBg(edits)
  if (resolved.kind === 'legacy') {
    const st = normalizeFitBlurStrength(edits.layout?.blurStrength)
    return st !== undefined && st !== DEFAULT_FIT_BLUR_STRENGTH
  }
  if (resolved.kind === 'blur') return resolved.strength !== DEFAULT_FIT_BLUR_STRENGTH
  return true
}

export function withCanvasBg(edits: ClipEditsV2, next: CanvasBg): ClipEditsV2 {
  const out: ClipEditsV2 = { ...edits, canvasBg: next }
  if (next.type === 'blur' && next.blur) {
    out.layout = { ...edits.layout, blurStrength: next.blur }
  }
  return out
}

export function canvasBgRelevant(
  edits: ClipEditsV2,
  previewAspect: string,
  mainWidth?: number,
  mainHeight?: number,
): boolean {
  const mode = edits.layout.mode
  if (mode === 'fit_blur' || mode === 'fit_top' || mode === 'full_frame') return true
  if (mainWidth && mainHeight && mainWidth > 0 && mainHeight > 0) {
    const src = mainWidth / mainHeight
    const { aw, ah } = aspectRatioParts(previewAspect as ExportAspect)
    if (aw > 0 && ah > 0) {
      const canvas = aw / ah
      if (Math.abs(src - canvas) / canvas > 0.02) return true
    }
  }
  const tpl = edits.layout.template?.id
  if (tpl) return true
  return false
}

export function displayCanvasBgType(edits: ClipEditsV2): CanvasBgType {
  if (!edits.canvasBg) return 'blur'
  return edits.canvasBg.type
}
