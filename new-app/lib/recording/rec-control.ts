import { z } from 'zod'

/** Reliable data-channel packets on topic `rec-control` (livekit-api-brief §4.6). */
export const recControlMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    takeId: z.string().min(8),
    startAtHostMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('stop'),
    takeId: z.string().min(8),
    stopAtHostMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('sync'),
    takeId: z.string().min(8),
    startAtHostMs: z.number().int().nonnegative(),
  }),
])

export type RecControlMessage = z.infer<typeof recControlMessageSchema>

export type RecordingRoomMetadataV1 = {
  v: 1
  recState: 'idle' | 'recording' | 'stopping'
  takeId?: string
  startAtHostMs?: number
}

export function parseRecControlPayload(bytes: Uint8Array): RecControlMessage | null {
  try {
    const text = new TextDecoder().decode(bytes)
    const json = JSON.parse(text) as unknown
    const parsed = recControlMessageSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function parseRecordingRoomMetadata(raw: string | undefined | null): RecordingRoomMetadataV1 | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as RecordingRoomMetadataV1
    if (data?.v !== 1 || !data.recState) return null
    return data
  } catch {
    return null
  }
}
