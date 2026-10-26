import { z } from 'zod'

export const streamerSettingsSchema = z.object({
  clipCount: z.number().int().min(1).max(30).default(12),
  minClipS: z.number().min(10).max(120).default(15),
  maxClipS: z.number().min(15).max(180).default(60),
  language: z.string().nullable().default(null),
})

export type StreamerSettings = z.infer<typeof streamerSettingsSchema>

export function defaultStreamerSettings(): StreamerSettings {
  return streamerSettingsSchema.parse({})
}
