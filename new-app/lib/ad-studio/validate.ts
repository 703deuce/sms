import { z } from 'zod'
import type { AdMode, AdProductInput } from './types'
import { adInvalid } from './errors'

const asset = z.string().trim().min(1).max(160)
export const adBriefSchema = z.object({
  name: z.string().trim().min(1).max(180),
  url: z.string().trim().url().max(2048).optional(),
  sellingPoints: z.array(z.string().trim().min(1).max(240)).max(12),
  audience: z.string().trim().max(400).optional(),
  brandNotes: z.string().trim().max(1000).optional(),
  aspect: z.enum(['9:16', '16:9', '1:1']),
  durationSec: z.union([z.literal(15), z.literal(30)]),
  imageAssetIds: z.array(asset).max(15),
  logoAssetId: asset.optional(),
  voiceId: asset.optional(),
  voiceoverEnabled: z.boolean().optional(),
}).strict()
export const adModeSchema = z.enum(['storyline','image_to_ad'])
export const adKeySchema = z.string().trim().min(8).max(160)
export const adCreateSchema = z.object({
  mode: adModeSchema, input: adBriefSchema, idempotencyKey: adKeySchema.optional(),
}).strict()
export const adReplanSchema = adBriefSchema.partial().strict()

export function parseCreate(body: unknown, headerKey?: string | null): { mode: AdMode; input: AdProductInput; key: string } {
  console.info('[ad-studio:validate] create_begin')
  const parsed = adCreateSchema.safeParse(body)
  if (!parsed.success) throw adInvalid('Provide a valid product brief, 15 or 30 seconds, and a supported aspect.')
  const key = adKeySchema.safeParse(headerKey || parsed.data.idempotencyKey)
  if (!key.success) throw adInvalid('An idempotency key is required for this request.')
  if (headerKey && parsed.data.idempotencyKey && headerKey !== parsed.data.idempotencyKey) throw adInvalid('The idempotency keys must match.')
  if (parsed.data.mode === 'image_to_ad' && parsed.data.input.imageAssetIds.length === 0)
    throw adInvalid('Image-to-ad requires at least one product image.')
  if (parsed.data.mode === 'storyline' && !parsed.data.input.sellingPoints.length)
    throw adInvalid('Add at least one factual selling point for a storyline ad.')
  console.info('[ad-studio:validate] create_valid', { mode: parsed.data.mode, durationSec: parsed.data.input.durationSec })
  return { mode: parsed.data.mode, input: parsed.data.input, key: key.data }
}

export function parseReplan(body: unknown, previous: AdProductInput, mode: AdMode): AdProductInput {
  console.info('[ad-studio:validate] replan_begin')
  const patch = adReplanSchema.safeParse(body)
  if (!patch.success) throw adInvalid('Invalid brief updates.')
  const merged = adBriefSchema.safeParse({ ...previous, ...patch.data })
  if (!merged.success) throw adInvalid('Revised brief must include a valid product, duration and aspect.')
  const input = merged.data
  if (mode === 'image_to_ad' && !input.imageAssetIds.length) throw adInvalid('Image-to-ad requires an image.')
  if (mode === 'storyline' && !input.sellingPoints.length) throw adInvalid('Add at least one selling point.')
  console.info('[ad-studio:validate] replan_valid', { durationSec: input.durationSec })
  return input
}
