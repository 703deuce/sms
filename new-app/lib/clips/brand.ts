import { z } from 'zod'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ExportAspect } from '@/lib/clips/export-aspect'

const LAYOUT_MODE_IDS = [
  'speaker_follow',
  'fit_blur',
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
})

export type BrandTemplateSettings = z.infer<typeof brandTemplateSettingsSchema>

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
  }
  if (!out.logoKey && !out.introVideoKey && !out.outroVideoKey && !out.templateId) return undefined
  return out
}

export function brandOverlayExpr(
  brand: ClipBrandEdits,
  videoW: number,
  videoH: number,
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
