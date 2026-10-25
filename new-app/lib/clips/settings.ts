import { z } from 'zod'

export const CLIP_SETTINGS_VERSION = 2

export const clipLayoutModes = ['speaker_follow', 'split', 'fill', 'fit'] as const
export const clipModes = ['talking', 'anything', 'captions'] as const
export const clipLengthBuckets = ['auto', 'lt30', '30_60', '60_90'] as const
export const clipAspectRatios = ['9:16', '1:1', '16:9'] as const
export const clipGenres = [
  'podcast',
  'interview',
  'talk',
  'vlog',
  'gaming',
  'sports',
  'education',
  'other',
] as const

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

export const CAPTION_PRESETS = [
  { id: 'bold_pop', label: 'Bold Pop', description: 'UPPER · pop highlight' },
  { id: 'clean_white', label: 'Clean White', description: 'Sentence case · sapphire active' },
  { id: 'boxed', label: 'Boxed', description: 'Active word box' },
  { id: 'karaoke', label: 'Karaoke', description: 'Fill animation' },
  { id: 'minimal', label: 'Minimal', description: 'Small bottom third' },
  { id: 'neon', label: 'Neon', description: 'Glow pulse' },
] as const

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
