import { z } from 'zod'

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
