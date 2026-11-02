import {
  brandTemplateSettingsSchema,
  type BrandTemplateSettings,
  type ClipBrandEdits,
} from '@/lib/clips/brand'
import type { BrandKitColumns } from '@/lib/clips/brand-kit'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { applyTemplateV3ToEdits } from '@/lib/clips/layers-template'
import { parseTemplateV3 } from '@/lib/clips/layers'

export type BrandTemplatePayload = {
  id?: string
  logoKey?: string | null
  introVideoKey?: string | null
  outroVideoKey?: string | null
  settings: BrandTemplateSettings
} & Partial<BrandKitColumns>

export function applyBrandTemplateToEdits(
  edits: ClipEditsV2,
  template: BrandTemplatePayload,
): ClipEditsV2 {
  const settings = brandTemplateSettingsSchema.parse(template.settings)
  const kitBrand: Partial<ClipBrandEdits> = {
    headingFont: template.headingFont ?? undefined,
    captionFont: template.captionFont ?? undefined,
    palette: template.palette ?? undefined,
    watermarkKey: template.watermarkKey ?? undefined,
    watermarkPosition: template.watermarkPosition ?? undefined,
    watermarkOpacity: template.watermarkOpacity ?? undefined,
    watermarkSizePct: template.watermarkSizePct ?? undefined,
    aspectOverrides: template.aspectOverrides ?? undefined,
  }
  const t3 = settings.templateV3 ?? parseTemplateV3(settings)
  if (t3) {
    // E1fix: the v3 path used to return the layers only, so `brand.templateId` was never written
    // (Brand dropdown snapped back to "Select template…"), and the row's logo / intro / outro were
    // dropped. Keep the layers result and stamp the brand kit on top of it.
    const applied = applyTemplateV3ToEdits(edits, t3)
    const prev = (applied.brand && typeof applied.brand === 'object' ? applied.brand : {}) as ClipBrandEdits
    const hasLogoLayer = t3.layers.some((l) => l.type === 'logo')
    const rowLogo = template.logoKey ?? undefined
    const brand: ClipBrandEdits = {
      ...prev,
      ...kitBrand,
      templateId: template.id ?? prev.templateId,
      ...(!hasLogoLayer && rowLogo
        ? {
            logoKey: rowLogo,
            logoPosition: settings.logoPosition,
            logoSizePct: settings.logoSizePct,
            logoOpacity: settings.logoOpacity,
          }
        : {}),
      primaryColor: settings.primaryColor ?? prev.primaryColor,
      introVideoKey: template.introVideoKey ?? undefined,
      outroVideoKey: template.outroVideoKey ?? undefined,
      useIntro: Boolean(template.introVideoKey),
      useOutro: Boolean(template.outroVideoKey),
    }
    return {
      ...applied,
      brand,
      aspectRatio: settings.defaultAspectRatio ?? applied.aspectRatio,
    }
  }
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
    ...kitBrand,
  }
  const captions = {
    ...edits.captions,
    enabled: edits.captions?.enabled !== false,
    ...settings.captionPreset,
    ...(kitBrand.captionFont ? { font: kitBrand.captionFont } : {}),
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

/**
 * E1fix: human summary of what applying a template changed, so "Template applied" is never a
 * silent no-op. Returns [] when the clip already matches the template.
 */
export function describeTemplateChange(before: ClipEditsV2, after: ClipEditsV2): string[] {
  const out: string[] = []
  const j = (v: unknown) => JSON.stringify(v ?? null)
  if (before.layout?.mode !== after.layout?.mode) out.push(`layout → ${String(after.layout?.mode).replace(/_/g, ' ')}`)
  if (before.aspectRatio !== after.aspectRatio && after.aspectRatio) out.push(`aspect → ${after.aspectRatio}`)
  if (j(before.captions) !== j(after.captions)) out.push('captions')
  const hb = (e: ClipEditsV2) => e.exportTemplate?.headlineBar
  if (j(hb(before)) !== j(hb(after)) || j(before.exportTemplate?.headlineStyle) !== j(after.exportTemplate?.headlineStyle)) {
    out.push('headline')
  }
  if (
    j(before.exportTemplate?.platformBadge) !== j(after.exportTemplate?.platformBadge) ||
    j(before.exportTemplate?.channelLink) !== j(after.exportTemplate?.channelLink)
  ) {
    out.push('badge')
  }
  const b0 = (before.brand ?? {}) as ClipBrandEdits
  const b1 = (after.brand ?? {}) as ClipBrandEdits
  if (b0.logoKey !== b1.logoKey || b0.logoPosition !== b1.logoPosition || b0.logoSizePct !== b1.logoSizePct) {
    out.push(b1.logoKey ? 'logo' : 'logo removed')
  }
  if (Boolean(b0.useIntro) !== Boolean(b1.useIntro) || Boolean(b0.useOutro) !== Boolean(b1.useOutro)) out.push('intro/outro')
  if (j(before.hookOverlay) !== j(after.hookOverlay)) out.push('hook')
  if (j(before.chatOverlay) !== j(after.chatOverlay)) out.push('chat')
  return out
}

/** Toast text for an applied template. */
export function templateAppliedMessage(name: string | undefined, changes: string[]): string {
  const label = name?.trim() ? `“${name.trim()}”` : 'Template'
  return changes.length
    ? `${label} applied: ${changes.join(', ')}`
    : `${label} applied — this clip already matches it`
}
