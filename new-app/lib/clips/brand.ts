import { z } from 'zod'
import type { CSSProperties } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import { templateV3Schema } from '@/lib/clips/layers'

const LAYOUT_MODE_IDS = [
  'speaker_follow',
  'fit_blur',
  'fit_top',
  'full_frame',
  'center_crop',
  'subject_follow',
  'split',
  'fill',
  'fit',
  'grid3',
  'grid4',
  'dynamic',
  'auto',
  'screen_pip',
  'facecam_stack',
  'facecam_pip',
] as const

export const brandTemplateSettingsSchema = z.object({
  logoPosition: z.enum(['TL', 'TR', 'BL', 'BR']).default('TR'),
  logoSizePct: z.number().min(5).max(25).default(12),
  logoOpacity: z.number().min(0.1).max(1).default(0.9),
  primaryColor: z.string().default('#FACC15'),
  defaultMusicMood: z.string().default('upbeat lo-fi instrumental'),
  captionPreset: z
    .object({
      presetId: z.string().optional(),
      animation: z.string().optional(),
      size: z.number().optional(),
      position: z.string().optional(),
      case: z.string().optional(),
      wordsPerLine: z.number().optional(),
      colors: z.object({ a: z.string().optional(), b: z.string().optional() }).optional(),
    })
    .default({}),
  defaultLayoutMode: z.enum(LAYOUT_MODE_IDS).default('speaker_follow'),
  defaultAspectRatio: z.enum(['9:16', '4:5', '1:1', '16:9']).optional(),
  templateV3: templateV3Schema.optional(),
})

export type BrandTemplateSettings = z.infer<typeof brandTemplateSettingsSchema>

export type BrandWatermarkPosition = 'TL' | 'TC' | 'TR' | 'ML' | 'C' | 'MR' | 'BL' | 'BC' | 'BR'

export type ClipBrandEdits = {
  templateId?: string
  logoKey?: string
  logoPosition?: 'TL' | 'TR' | 'BL' | 'BR'
  logoSizePct?: number
  logoOpacity?: number
  primaryColor?: string
  introVideoKey?: string
  outroVideoKey?: string
  useIntro?: boolean
  useOutro?: boolean
  headingFont?: string
  captionFont?: string
  palette?: string[]
  watermarkKey?: string
  watermarkPosition?: BrandWatermarkPosition
  watermarkOpacity?: number
  watermarkSizePct?: number
  aspectOverrides?: Record<string, { logoPosition?: string; captionY?: number }>
}

export function defaultBrandSettings(): BrandTemplateSettings {
  return brandTemplateSettingsSchema.parse({})
}

/** Build reusable template settings from current clip editor state (captions + layout + aspect). */
export function clipStyleSettingsFromEdits(edits: ClipEditsV2): BrandTemplateSettings {
  const cap = edits.captions || {}
  return brandTemplateSettingsSchema.parse({
    captionPreset: {
      presetId: cap.presetId,
      animation: cap.animation,
      size: cap.size,
      position: cap.position,
      case: cap.case,
      wordsPerLine: cap.wordsPerLine,
      colors: cap.colors,
    },
    primaryColor: cap.colors?.a ?? '#FACC15',
    defaultLayoutMode: edits.layout?.mode ?? 'speaker_follow',
    defaultAspectRatio: edits.aspectRatio,
  })
}

/** Map project `settings.brand` blob into clip `edits.brand` for export/render. */
export function brandEditsFromProjectBrand(brand: Record<string, unknown> | null | undefined): ClipBrandEdits | undefined {
  if (!brand || typeof brand !== 'object') return undefined
  const out: ClipBrandEdits = {
    templateId: brand.templateId as string | undefined,
    logoKey: brand.logoKey as string | undefined,
    logoPosition: brand.logoPosition as ClipBrandEdits['logoPosition'],
    logoSizePct: typeof brand.logoSizePct === 'number' ? brand.logoSizePct : undefined,
    logoOpacity: typeof brand.logoOpacity === 'number' ? brand.logoOpacity : undefined,
    primaryColor: typeof brand.primaryColor === 'string' ? brand.primaryColor : undefined,
    introVideoKey: brand.introVideoKey as string | undefined,
    outroVideoKey: brand.outroVideoKey as string | undefined,
    useIntro: brand.useIntro !== false && Boolean(brand.introVideoKey),
    useOutro: brand.useOutro !== false && Boolean(brand.outroVideoKey),
    headingFont: typeof brand.headingFont === 'string' ? brand.headingFont : undefined,
    captionFont: typeof brand.captionFont === 'string' ? brand.captionFont : undefined,
    palette: Array.isArray(brand.palette) ? (brand.palette as string[]) : undefined,
    watermarkKey: brand.watermarkKey as string | undefined,
    watermarkPosition: brand.watermarkPosition as ClipBrandEdits['watermarkPosition'],
    watermarkOpacity: typeof brand.watermarkOpacity === 'number' ? brand.watermarkOpacity : undefined,
    watermarkSizePct: typeof brand.watermarkSizePct === 'number' ? brand.watermarkSizePct : undefined,
    aspectOverrides: brand.aspectOverrides as ClipBrandEdits['aspectOverrides'],
  }
  if (
    !out.logoKey &&
    !out.introVideoKey &&
    !out.outroVideoKey &&
    !out.templateId &&
    !out.watermarkKey
  )
    return undefined
  return out
}

export function brandOverlayExpr(
  brand: ClipBrandEdits,
  videoW: number,
  _videoH: number,
): { x: string; y: string; scale: string; opacity: number } {
  const margin = 24
  const sizePct = (brand.logoSizePct ?? 12) / 100
  const scaleW = Math.round(videoW * sizePct)
  const pos = brand.logoPosition ?? 'TR'
  const x =
    pos === 'TL' || pos === 'BL'
      ? `${margin}`
      : `main_w-overlay_w-${margin}`
  const y =
    pos === 'TL' || pos === 'TR'
      ? `${margin}`
      : `main_h-overlay_h-${margin}`
  return {
    x,
    y,
    scale: `${scaleW}:-1`,
    opacity: brand.logoOpacity ?? 0.9,
  }
}

const PREVIEW_MARGIN_PX = 12

/** CSS overlay for brand logo / watermark in the editor preview (matches brand_render margin + width %). */
export function brandImageOverlayPreviewStyle(
  pos: string | undefined,
  sizePct: number | undefined,
  opacity: number | undefined,
): CSSProperties {
  const p = (pos ?? 'BR') as BrandWatermarkPosition
  const m = PREVIEW_MARGIN_PX
  const style: CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    opacity: opacity ?? 0.8,
    width: `${sizePct ?? 12}%`,
    maxWidth: '45%',
    pointerEvents: 'none',
  }
  let tx = ''
  let ty = ''
  if (p === 'TL' || p === 'ML' || p === 'BL') style.left = m
  if (p === 'TR' || p === 'MR' || p === 'BR') style.right = m
  if (p === 'TC' || p === 'C' || p === 'BC') {
    style.left = '50%'
    tx = '-50%'
  }
  if (p === 'TL' || p === 'TC' || p === 'TR') style.top = m
  if (p === 'BL' || p === 'BC' || p === 'BR') style.bottom = m
  if (p === 'ML' || p === 'C' || p === 'MR') {
    style.top = '50%'
    ty = '-50%'
  }
  if (tx || ty) {
    style.transform = `translate(${tx || '0'}, ${ty || '0'})`
  }
  return style
}
