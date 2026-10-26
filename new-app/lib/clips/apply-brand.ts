import {
  brandTemplateSettingsSchema,
  type BrandTemplateSettings,
  type ClipBrandEdits,
} from '@/lib/clips/brand'
import type { ClipEditsV2 } from '@/lib/clips/edits'

export type BrandTemplatePayload = {
  logoKey?: string | null
  settings: BrandTemplateSettings
}

export function applyBrandTemplateToEdits(
  edits: ClipEditsV2,
  template: BrandTemplatePayload,
): ClipEditsV2 {
  const settings = brandTemplateSettingsSchema.parse(template.settings)
  const brand: ClipBrandEdits = {
    logoKey: template.logoKey ?? undefined,
    logoPosition: settings.logoPosition,
    logoSizePct: settings.logoSizePct,
    logoOpacity: settings.logoOpacity,
    primaryColor: settings.primaryColor,
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
  return { ...edits, captions, brand }
}
