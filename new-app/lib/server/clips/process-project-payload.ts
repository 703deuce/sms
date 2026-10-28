import { targetClipLenSForJobPayload } from '@/lib/clips/clip-length'

/** Merge worker-facing PROCESS_PROJECT fields from project settings. */
export function buildProcessProjectJobPayload(
  settings: unknown,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const target_clip_len_s = targetClipLenSForJobPayload(settings)
  return {
    ...(extra ?? {}),
    target_clip_len_s,
  }
}
