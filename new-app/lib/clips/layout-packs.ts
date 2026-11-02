import { z } from 'zod'
import type { ClipEditsV2 } from '@/lib/clips/edits'

export const layoutPackPayloadSchema = z.object({
  v: z.literal(1).default(1),
  aspect: z.enum(['9:16', '4:5', '1:1', '16:9']),
  layout: z.record(z.unknown()),
  captions: z.record(z.unknown()).optional(),
  textPositions: z
    .array(
      z.object({
        presetId: z.string().optional(),
        x: z.number(),
        y: z.number(),
        w: z.number().optional(),
      }),
    )
    .max(20)
    .optional(),
})
export type LayoutPackPayload = z.infer<typeof layoutPackPayloadSchema>

export const layoutPackCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  payload: layoutPackPayloadSchema,
})

const CAPTION_STYLE_KEYS = [
  'presetId',
  'preset',
  'animation',
  'size',
  'position',
  'case',
  'wordsPerLine',
  'colors',
  'font',
] as const

export function layoutPackFromEdits(edits: ClipEditsV2, aspect: LayoutPackPayload['aspect']): LayoutPackPayload {
  const e = edits as unknown as Record<string, unknown>
  const cap = (e.captions ?? {}) as Record<string, unknown>
  const captions = Object.fromEntries(CAPTION_STYLE_KEYS.filter((k) => k in cap).map((k) => [k, cap[k]]))
  const textPositions = Array.isArray(e.textItems)
    ? e.textItems.slice(0, 20).map((t: { presetId?: string; x?: number; y?: number; w?: number }) => ({
        presetId: t.presetId,
        x: Number(t.x ?? 0.5),
        y: Number(t.y ?? 0.5),
        w: t.w,
      }))
    : undefined
  return layoutPackPayloadSchema.parse({
    v: 1,
    aspect,
    layout: structuredClone(e.layout ?? {}),
    captions: Object.keys(captions).length ? captions : undefined,
    textPositions,
  })
}

/** Pure merge. Never touches words, cuts or media. */
export function applyLayoutPack(edits: ClipEditsV2, payload: LayoutPackPayload): ClipEditsV2 {
  const e = edits as unknown as Record<string, unknown>
  const next: Record<string, unknown> = { ...e, layout: structuredClone(payload.layout) }
  if (payload.captions) next.captions = { ...(e.captions as object), ...payload.captions }
  if (payload.textPositions && Array.isArray(e.textItems)) {
    next.textItems = (e.textItems as Array<Record<string, unknown>>).map((t, i) => {
      const p =
        payload.textPositions!.find((q) => q.presetId && q.presetId === t.presetId) ?? payload.textPositions![i]
      return p ? { ...t, x: p.x, y: p.y, ...(p.w != null ? { w: p.w } : {}) } : t
    })
  }
  if (e.aspectRatio !== undefined || payload.aspect) next.aspectRatio = payload.aspect
  return next as unknown as ClipEditsV2
}
