import { z } from 'zod'

/** Reliable data-channel packets on topic `rec-control` (livekit-api-brief §4.6). */
const startShape = z.object({
  takeId: z.string().min(8),
  startAtHostMs: z.number().int().nonnegative(),
})
const stopShape = z.object({
  takeId: z.string().min(8),
  stopAtHostMs: z.number().int().nonnegative(),
})

export const recControlMessageSchema = z.union([
  z.object({ t: z.literal('start'), ...startShape.shape }),
  z.object({ t: z.literal('stop'), ...stopShape.shape }),
  z.object({ t: z.literal('sync'), ...startShape.shape }),
  z.object({ type: z.literal('start'), ...startShape.shape }),
  z.object({ type: z.literal('stop'), ...stopShape.shape }),
  z.object({ type: z.literal('sync'), ...startShape.shape }),
])

export type RecControlMessage = z.infer<typeof recControlMessageSchema>

export type RecordingRoomMetadataV1 = {
  v: 1
  recState: 'idle' | 'countdown' | 'recording' | 'stopping'
  takeId?: string
  startAtHostMs?: number
  spotlightIdentity?: string | null
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
