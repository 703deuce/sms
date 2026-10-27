import { z } from 'zod'

const chatOverlaySchema = z.object({
  enabled: z.boolean().default(false),
  position: z.enum(['gameplay_right', 'gameplay_left', 'bottom']).default('gameplay_right'),
  opacity: z.number().min(0.2).max(1).default(0.6),
})

const notifySchema = z.object({
  inApp: z.boolean().default(true),
  email: z.boolean().default(true),
})

export const streamerSettingsSchema = z.object({
  /** Connected marathon: publish highlight batches every N hours (rolling mode). */
  marathonBatchHours: z.number().min(1).max(24).default(6),
  /** UTC hour 0–23 for daily recap clip batch during long streams. */
  marathonDailyRecapUtcHour: z.number().int().min(0).max(23).default(0),
  clipCount: z.number().int().min(1).max(30).default(12),
  minClipS: z.number().min(10).max(120).default(15),
  maxClipS: z.number().min(15).max(180).default(60),
  language: z.string().nullable().default(null),
  captionPosition: z.enum(['seam', 'gameplay_bottom', 'top']).default('seam'),
  gameBadge: z.boolean().default(false),
  /** Full-VOD Deepgram diarization + caption speaker labels (collab streams). */
  alwaysDetectSpeakers: z.boolean().default(false),
  chatOverlay: chatOverlaySchema.default({}),
  notify: notifySchema.default({}),
})

export type StreamerSettings = z.infer<typeof streamerSettingsSchema>

export function defaultStreamerSettings(): StreamerSettings {
  return streamerSettingsSchema.parse({})
}
