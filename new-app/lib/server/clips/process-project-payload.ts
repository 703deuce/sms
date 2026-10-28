import { targetClipLenSForJobPayload } from '@/lib/clips/clip-length'
import {
  CLIP_CONTENT_GENRE_AUTO,
  CLIP_CONTENT_MODE_AUTO,
  contentModeForJobPayload,
} from '@/lib/clips/content-detection'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'

/** Merge worker-facing PROCESS_PROJECT fields from project settings. */
export function buildProcessProjectJobPayload(
  settings: unknown,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const target_clip_len_s = targetClipLenSForJobPayload(settings)
  const parsed = clipProjectSettingsSchema.safeParse(settings)
  const mode = parsed.success ? contentModeForJobPayload(parsed.data) : CLIP_CONTENT_MODE_AUTO
  const genre = CLIP_CONTENT_GENRE_AUTO
  return {
    ...(extra ?? {}),
    target_clip_len_s,
    mode,
    genre,
  }
}
