import { z } from 'zod'

export const pttPacketSchema = z.object({
  t: z.literal('ptt'),
  fromIdentity: z.string(),
  toIdentity: z.string(),
  active: z.boolean(),
})

export type PttPacket = z.infer<typeof pttPacketSchema>

export const spotlightPacketSchema = z.object({
  t: z.literal('spotlight'),
  identity: z.string().nullable(),
})

export type SpotlightPacket = z.infer<typeof spotlightPacketSchema>

export function encodeDataPacket(payload: object): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return Uint8Array.from(bytes)
}

/** LiveKit publishData expects Uint8Array backed by ArrayBuffer (not SharedArrayBuffer). */
export function encodeDataPacketForLiveKit(payload: object): Uint8Array<ArrayBuffer> {
  const copy = encodeDataPacket(payload)
  const buf = new ArrayBuffer(copy.byteLength)
  new Uint8Array(buf).set(copy)
  return new Uint8Array(buf)
}

export function parseDataPacket<T>(bytes: Uint8Array, schema: z.ZodType<T>): T | null {
  try {
    const json = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    const parsed = schema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
