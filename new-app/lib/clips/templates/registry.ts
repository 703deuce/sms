import templatesJson from '@/lib/clips/templates/template-registry.json'
import captionV2 from '@/lib/clips/templates/caption-presets-v2.json'
import titleStyles from '@/lib/clips/templates/title-styles.json'

export type TemplateLane = 'gaming' | 'irl' | 'just_chatting' | 'podcast'

export type TemplatePanel = {
  role: string
  y: number
  h: number
  src: string
  fit: 'cover' | 'contain_blur' | 'contain_black'
  x?: number
  w?: number
  focus?: string
  adjust?: { param: string; min: number; max: number }
  track?: string
}

export type TemplateDef = {
  id: string
  lane: TemplateLane
  name: string
  fallbackMode: string
  requires: {
    facecam?: boolean
    maxPersons?: number | null
    noBackgroundAction?: boolean
    contentBox?: boolean
    personCountMin?: number | null
    maxDurationSec?: number | null
  }
  panels: TemplatePanel[]
  bands?: { y: number; h: number; fill: string }[]
  title?: { slot: string; allowed: string[] }
  captions?: { anchor: string; y: number }
  pip?: Record<string, unknown> | null
  motion?: Record<string, unknown> | null
  pickWeights?: Record<string, number>
}

export const T6_TEMPLATES: TemplateDef[] = templatesJson as TemplateDef[]
export const T6_TEMPLATES_BY_ID: Record<string, TemplateDef> = Object.fromEntries(
  T6_TEMPLATES.map((t) => [t.id, t]),
)

export const CAPTION_PRESETS_V2 = captionV2 as Record<string, Record<string, unknown>>
export const TITLE_STYLES = titleStyles as Record<string, Record<string, unknown>>

export const LEGACY_LAYOUT_MODES = new Set([
  'speaker_follow',
  'fit_blur',
  'fit_top',
  'full_frame',
  'center_crop',
  'fill',
  'facecam_stack',
  'facecam_pip',
  'screen_pip',
  'split',
  'grid3',
  'grid4',
])

export function verticalCoverage(t: TemplateDef): number {
  const spans: [number, number][] = []
  for (const p of t.panels) spans.push([p.y, p.y + p.h])
  for (const b of t.bands ?? []) spans.push([b.y, b.y + b.h])
  if (!spans.length) return 0
  spans.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = [[spans[0][0], spans[0][1]]]
  for (let i = 1; i < spans.length; i++) {
    const [s, e] = spans[i]
    const last = merged[merged.length - 1]
    if (s <= last[1] + 0.001) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  return merged.reduce((acc, [s, e]) => acc + (e - s), 0)
}
