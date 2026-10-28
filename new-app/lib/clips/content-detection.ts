import { clipProjectSettingsSchema, type ClipProjectSettings } from '@/lib/clips/settings'

/** Worker + picker: AI detects content per section; users do not pick mode/genre. */
export const CLIP_CONTENT_MODE_AUTO = 'auto'
export const CLIP_CONTENT_GENRE_AUTO = 'auto'

/** Captions-only tool flows keep `mode: captions`; everything else is worker-detected. */
export function withAutoContentDetection(settings: ClipProjectSettings): ClipProjectSettings {
  const mode = settings.mode === 'captions' ? 'captions' : CLIP_CONTENT_MODE_AUTO
  return clipProjectSettingsSchema.parse({
    ...settings,
    mode,
    genre: CLIP_CONTENT_GENRE_AUTO,
  })
}

export function contentModeForJobPayload(settings: ClipProjectSettings): string {
  return settings.mode === 'captions' ? 'captions' : CLIP_CONTENT_MODE_AUTO
}
