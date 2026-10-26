import type { FormatSpec } from '@/lib/screenwriting/formats/types'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'

export const TV_HOUR_DRAMA_SPEC: FormatSpec = {
  ...FEATURE_FORMAT_SPEC,
  key: 'tv-hour',
  name: 'TV One-Hour Drama',
  elements: {
    ...FEATURE_FORMAT_SPEC.elements,
    actBreak: { left: 1.5, right: 7.5, spaceBefore: 1, caps: true, align: 'center' },
  },
}

export const MULTICAM_SITCOM_SPEC: FormatSpec = {
  ...FEATURE_FORMAT_SPEC,
  key: 'multicam',
  name: 'Multi-Cam Sitcom',
  elements: {
    ...FEATURE_FORMAT_SPEC.elements,
    action: { left: 1.5, right: 7.5, spaceBefore: 2, caps: true },
    dialogue: { left: 2.38, right: 6.25, spaceBefore: 1, caps: false },
  },
}

export const BUILT_IN_TEMPLATES: Record<string, FormatSpec> = {
  feature: FEATURE_FORMAT_SPEC,
  'tv-hour': TV_HOUR_DRAMA_SPEC,
  multicam: MULTICAM_SITCOM_SPEC,
}

export function getTemplateSpec(key: string): FormatSpec {
  return BUILT_IN_TEMPLATES[key] ?? FEATURE_FORMAT_SPEC
}
