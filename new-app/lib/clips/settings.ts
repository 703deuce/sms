import { z } from 'zod'
import { CAPTION_PRESETS as CAPTION_PRESET_DEFS, presetSlugToId } from '@/lib/clips/caption-presets'

export const CLIP_SETTINGS_VERSION = 2

export const clipLayoutModes = [
  'auto',
  'speaker_follow',
  'dynamic',
  'split_debate',
  'grid',
  'locked_off',
  'split',
  'fill',
  'fit',
] as const
export const clipModes = ['talking', 'anything', 'captions'] as const
export const clipLengthBuckets = ['auto', 'lt30', '30_60', '60_90'] as const
export const clipAspectRatios = ['9:16', '1:1', '16:9'] as const
export const clipGenres = [
  'podcast',
  'interview',
  'education',
  'comedy',
  'business',
  'motivational',
  'gaming',
  'sports',
  'news',
  'howto',
  'talk',
  'vlog',
  'other',
] as const

export const clipGenreLabels: Record<(typeof clipGenres)[number], string> = {
  podcast: 'Podcast / interview',
  interview: 'Interview',
  education: 'Education / solo',
  comedy: 'Comedy / stand-up',
  business: 'Business / marketing',
  motivational: 'Motivational / keynote',
  gaming: 'Gaming / stream',
  sports: 'Sports / TV',
  news: 'News / debate',
  howto: 'How-to / tutorial',
  talk: 'Talk show',
  vlog: 'Vlog',
  other: 'Other',
}

export const clipProjectSettingsSchema = z.object({
  v: z.literal(CLIP_SETTINGS_VERSION),
  mode: z.enum(clipModes).default('talking'),
  genre: z.enum(clipGenres).default('podcast'),
  clipLength: z.enum(clipLengthBuckets).default('auto'),
  rangeStartMs: z.number().int().min(0).default(0),
  rangeEndMs: z.number().int().min(0).default(0),
  prompt: z.string().max(2000).optional(),
  layout: z.enum(clipLayoutModes).default('speaker_follow'),
  aspectRatio: z.enum(clipAspectRatios).default('9:16'),
  captions: z.object({
    enabled: z.boolean().default(true),
    presetId: z.string().default('bold_pop'),
    language: z.string().default('en'),
  }),
  brandTemplateId: z.string().nullable().optional(),
  brand: z.record(z.unknown()).optional(),
  autoStockBroll: z.boolean().default(false),
  extras: z
    .object({
      music: z.boolean().default(false),
      thumbnails: z.boolean().default(false),
      dubLang: z.string().nullable().optional(),
    })
    .default({ music: false, thumbnails: false, dubLang: null }),
})

export type ClipProjectSettings = z.infer<typeof clipProjectSettingsSchema>

export function defaultClipSettings(overrides?: Partial<ClipProjectSettings>): ClipProjectSettings {
  return clipProjectSettingsSchema.parse({
    v: CLIP_SETTINGS_VERSION,
    mode: 'talking',
    genre: 'podcast',
    clipLength: 'auto',
    rangeStartMs: 0,
    rangeEndMs: 0,
    layout: 'speaker_follow',
    aspectRatio: '9:16',
    captions: { enabled: true, presetId: 'bold_pop', language: 'en' },
    autoStockBroll: false,
    extras: { music: false, thumbnails: false, dubLang: null },
    ...overrides,
  })
}

export const CAPTION_PRESETS = CAPTION_PRESET_DEFS.map((p) => ({
  id: presetSlugToId(p.slug),
  label: p.name,
  description: `${p.case} · ${p.animation}`,
}))

export const TOOL_PRESET_MAP: Record<string, Partial<ClipProjectSettings>> = {
  'ai-clip-maker': { mode: 'talking' },
  'podcast-to-shorts': { mode: 'talking', genre: 'podcast' },
  'video-to-shorts': { mode: 'anything' },
  'auto-reframe-video': { mode: 'captions', layout: 'speaker_follow' },
  'add-captions-to-video': { mode: 'captions' },
  'tiktok-captions': { mode: 'captions', captions: { enabled: true, presetId: 'bold_pop', language: 'en' } },
  'interview-clips': { mode: 'talking', genre: 'interview' },
  'long-video-to-short-video': { mode: 'talking', clipLength: '30_60' },
}
