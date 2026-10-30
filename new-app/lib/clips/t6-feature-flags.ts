/** T6 feature flags — all default OFF in production until explicitly enabled. */
export type T6ProjectSettings = {
  templates?: boolean
  captions?: boolean
  titles?: boolean
}

export function t6ProjectOverride(
  settings: { t6?: T6ProjectSettings } | null | undefined,
  key: keyof T6ProjectSettings,
): boolean | undefined {
  const v = settings?.t6?.[key]
  return typeof v === 'boolean' ? v : undefined
}

export function t6SignalsEnabled(settings?: { t6?: T6ProjectSettings } | null): boolean {
  const o = t6ProjectOverride(settings, 'templates')
  if (o === true) return true
  if (o === false) return false
  return process.env.NEXT_PUBLIC_T6_SIGNALS === '1'
}

export function t6TemplatesEnabled(settings?: { t6?: T6ProjectSettings } | null): boolean {
  const o = t6ProjectOverride(settings, 'templates')
  if (o === true) return true
  if (o === false) return false
  return process.env.NEXT_PUBLIC_T6_TEMPLATES === '1'
}

export function t6CaptionPresetsEnabled(settings?: { t6?: T6ProjectSettings } | null): boolean {
  const o = t6ProjectOverride(settings, 'captions')
  if (o === true) return true
  if (o === false) return false
  return process.env.NEXT_PUBLIC_T6_CAPTION_PRESETS === '1'
}

export function t6TitleAutoEnabled(settings?: { t6?: T6ProjectSettings } | null): boolean {
  const o = t6ProjectOverride(settings, 'titles')
  if (o === true) return true
  if (o === false) return false
  return process.env.NEXT_PUBLIC_T6_TITLE_AUTO === '1'
}
