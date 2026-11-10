import { z } from 'zod'
import type { AdProductInput, AdMode } from './types'
import { AdStudioError } from './errors'

const id = z.string().trim().min(1).max(150)
export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  url: z.string().trim().url().max(2000).refine((s) => /^https?:\/\//i.test(s), 'Only HTTP(S) URLs are supported').optional(),
  sellingPoints: z.array(z.string().trim().min(1).max(300)).min(1).max(12),
  audience: z.string().trim().max(240).optional(),
  brandNotes: z.string().trim().max(1500).optional(),
  aspect: z.enum(['9:16', '16:9', '1:1']),
  durationSec: z.union([z.literal(15), z.literal(30)]),
  imageAssetIds: z.array(id).max(12),
  logoAssetId: id.optional(),
}).strict()

const modeSchema = z.enum(['storyline', 'image_to_ad'])
const keySchema = z.string().trim().min(8).max(180)
export const createSchema = z.object({
  mode: modeSchema, input: productSchema, idempotencyKey: keySchema.optional(),
}).strict()
export const confirmSchema = z.object({ idempotencyKey: keySchema.optional() }).strict()
export const patchSchema = productSchema.partial().strict()

function parseOrThrow<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    console.warn('[ad-studio:validation] invalid_input', { fields: result.error.issues.map((i) => i.path.join('.')) })
    throw new AdStudioError('INVALID_PARAMS', 'Please review the ad brief and required fields.')
  }
  return result.data
}

export function parseCreate(raw: unknown, headerKey: string | null): { mode: AdMode; input: AdProductInput; key: string } {
  console.info('[ad-studio:validation] create_begin')
  const body = parseOrThrow(createSchema, raw)
  const key = parseIdempotencyKey(headerKey, body.idempotencyKey)
  if (body.mode === 'image_to_ad' && body.input.imageAssetIds.length === 0) {
    throw new AdStudioError('INVALID_PARAMS', 'Image-to-ad requires at least one product image.')
  }
  console.info('[ad-studio:validation] create_validated', { mode: body.mode, durationSec: body.input.durationSec, assetCount: body.input.imageAssetIds.length })
  return { mode: body.mode, input: body.input, key }
}

export function parseIdempotencyKey(headerKey: string | null, bodyKey: string | undefined): string {
  const header = headerKey?.trim()
  if (header && bodyKey && header !== bodyKey) throw new AdStudioError('INVALID_PARAMS', 'Idempotency keys must match.')
  return parseOrThrow(keySchema, header || bodyKey)
}

export function parseConfirm(raw: unknown, headerKey: string | null): string {
  console.info('[ad-studio:validation] confirm_begin')
  const body = parseOrThrow(confirmSchema, raw)
  return parseIdempotencyKey(headerKey, body.idempotencyKey)
}

export function parseBriefPatch(raw: unknown, prior: AdProductInput, mode: AdMode): AdProductInput {
  console.info('[ad-studio:validation] replan_begin')
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) && 'input' in raw
    ? (raw as { input: unknown }).input : raw
  const patch = parseOrThrow(patchSchema, source ?? {})
  const input = parseOrThrow(productSchema, { ...prior, ...patch })
  if (mode === 'image_to_ad' && !input.imageAssetIds.length)
    throw new AdStudioError('INVALID_PARAMS', 'Image-to-ad requires a product image.')
  console.info('[ad-studio:validation] replan_validated', { durationSec: input.durationSec, assetCount: input.imageAssetIds.length })
  return input
}

export function parseListQuery(url: URL): { limit: number; cursor?: string; status?: string } {
  const rawLimit = url.searchParams.get('limit')
  const limit = rawLimit === null ? 20 : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new AdStudioError('INVALID_PARAMS', 'limit must be between 1 and 100.')
  const cursor = url.searchParams.get('cursor')?.trim() || undefined
  if (cursor && cursor.length > 150) throw new AdStudioError('INVALID_PARAMS', 'Invalid cursor.')
  const status = url.searchParams.get('status')?.trim() || undefined
  const accepted = ['draft','planning','plan_ready','confirming','generating','stitching','done','failed','cancelled']
  if (status && !accepted.includes(status)) throw new AdStudioError('INVALID_PARAMS', 'Invalid run status.')
  return { limit, cursor, status }
}
