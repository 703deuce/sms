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
  headline: z.string().trim().max(180).optional(),
  subHeadline: z.string().trim().max(300).optional(),
  cta: z.string().trim().max(80).optional(),
  brandColors: z.object({
    primary: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
    secondary: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }).strict().optional(),
  aspect: z.enum(['9:16', '16:9', '1:1', '3:4']),
  durationSec: z.union([z.literal(15), z.literal(30)]),
  imageAssetIds: z.array(asset).max(15),
  logoAssetId: asset.optional(),
  voiceId: asset.optional(),
  voiceoverEnabled: z.boolean().optional(),
  imageVariantId: asset.optional(),
  commercialModelId: z.enum(['wan-3.0','seedance-2.5','seedance-2.0-mini','veo-3.1-lite']).optional(),
}).strict()
export const adModeSchema = z.enum(['storyline','image_to_ad','image_ad_to_commercial'])
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
  if (parsed.data.mode === 'image_to_ad') {
    if (!parsed.data.input.imageAssetIds.length) throw adInvalid('Image-to-ad requires at least one product image.')
    if (!parsed.data.input.headline || !parsed.data.input.subHeadline || !parsed.data.input.cta || !parsed.data.input.brandColors?.primary)
      throw adInvalid('Image-to-ad requires headline, sub-headline, CTA, and a primary brand color.')
    if (!parsed.data.input.sellingPoints.length) throw adInvalid('Add product or offer information for the image ad.')
    if (parsed.data.input.durationSec !== 15) throw adInvalid('Photo-ad commercial flow uses a 15 second target.')
  }
  if (parsed.data.mode === 'image_ad_to_commercial') {
    if (!parsed.data.input.imageAssetIds.length) throw adInvalid('Choose or upload a finished ad still.')
    if (parsed.data.input.durationSec !== 15) throw adInvalid('Image-ad commercials are 15 seconds.')
  }
  if (parsed.data.mode === 'storyline') {
    if (!parsed.data.input.sellingPoints.length) throw adInvalid('Add at least one factual selling point for a storyline ad.')
    if (parsed.data.input.aspect === '3:4') throw adInvalid('Storyline supports 9:16, 16:9, and 1:1.')
  }
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
  if (mode === 'image_to_ad') {
    if (!input.imageAssetIds.length) throw adInvalid('Image-to-ad requires an image.')
    if (!input.headline || !input.subHeadline || !input.cta || !input.brandColors?.primary)
      throw adInvalid('Image-to-ad requires headline, sub-headline, CTA, and a primary brand color.')
    if (!input.sellingPoints.length) throw adInvalid('Add product or offer information.')
    if (input.durationSec !== 15) throw adInvalid('Photo-ad commercial flow uses a 15 second target.')
  }
  if (mode === 'image_ad_to_commercial') {
    if (!input.imageAssetIds.length) throw adInvalid('Choose or upload a finished ad still.')
    if (input.durationSec !== 15) throw adInvalid('Image-ad commercials are 15 seconds.')
  }
  if (mode === 'storyline') {
    if (!input.sellingPoints.length) throw adInvalid('Add at least one selling point.')
    if (input.aspect === '3:4') throw adInvalid('Storyline supports 9:16, 16:9, and 1:1.')
  }
  console.info('[ad-studio:validate] replan_valid', { durationSec: input.durationSec })
  return input
}
