import {
  brandTemplateSettingsSchema,
  type BrandTemplateSettings,
  type ClipBrandEdits,
} from '@/lib/clips/brand'
import type { ClipEditsV2 } from '@/lib/clips/edits'

export type BrandTemplatePayload = {
  id?: string
  logoKey?: string | null
  introVideoKey?: string | null
  outroVideoKey?: string | null
  settings: BrandTemplateSettings
}

export function applyBrandTemplateToEdits(
  edits: ClipEditsV2,
  template: BrandTemplatePayload,
): ClipEditsV2 {
  const settings = brandTemplateSettingsSchema.parse(template.settings)
  const brand: ClipBrandEdits = {
    templateId: template.id,
    logoKey: template.logoKey ?? undefined,
    logoPosition: settings.logoPosition,
    logoSizePct: settings.logoSizePct,
    logoOpacity: settings.logoOpacity,
    primaryColor: settings.primaryColor,
    introVideoKey: template.introVideoKey ?? undefined,
    outroVideoKey: template.outroVideoKey ?? undefined,
    useIntro: Boolean(template.introVideoKey),
    useOutro: Boolean(template.outroVideoKey),
  }
  const captions = {
    ...edits.captions,
    enabled: edits.captions?.enabled !== false,
    ...settings.captionPreset,
    colors: {
      ...edits.captions?.colors,
      a: settings.primaryColor,
      ...settings.captionPreset.colors,
    },
  }
  const layout = {
    ...edits.layout,
    mode: settings.defaultLayoutMode ?? edits.layout.mode,
  }
  const aspectRatio = settings.defaultAspectRatio ?? edits.aspectRatio
  return { ...edits, captions, brand, layout, aspectRatio }
}
