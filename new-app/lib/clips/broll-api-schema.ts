import { z } from 'zod'
import { coerceIntMs } from '@/lib/clips/broll'

/**
 * E1fix: integer, non-negative output ms for B-roll API bodies. The editor playhead is
 * `video.currentTime * 1000` (fractional), so floats / numeric strings are rounded here instead of
 * failing with "Expected integer, received float".
 */
export const intMsSchema = z.preprocess(coerceIntMs, z.number().int().min(0))

/** POST /api/clips/clips/[id]/broll (stock "Insert at playhead"). */
export const stockBrollInsertBodySchema = z
  .object({
    providerId: z.string().min(1),
    startMs: intMsSchema,
    endMs: intMsSchema,
  })
  .transform((b) => ({ ...b, endMs: Math.max(b.startMs, b.endMs) }))
