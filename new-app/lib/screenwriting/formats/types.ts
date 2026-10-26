import { z } from 'zod'

export const elementTypeSchema = z.enum([
  'sceneHeading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
  'general',
  'lyrics',
  'castList',
  'centered',
  'actBreak',
])

export type ScreenplayElementType = z.infer<typeof elementTypeSchema>

export const elementIndentSchema = z.object({
  left: z.number(),
  right: z.number(),
  firstLineAdjust: z.number().optional(),
  spaceBefore: z.number().default(1),
  caps: z.boolean().default(false),
  align: z.enum(['left', 'right', 'center']).optional(),
})

export const formatSpecSchema = z.object({
  key: z.string(),
  name: z.string(),
  page: z.object({
    widthIn: z.number(),
    heightIn: z.number(),
    marginTop: z.number(),
    marginBottom: z.number(),
    marginLeft: z.number(),
    marginRight: z.number(),
    headerOffset: z.number(),
    bodyLines: z.number(),
    linesPerInch: z.number(),
    charsPerInch: z.number(),
  }),
  elements: z.record(elementTypeSchema, elementIndentSchema),
})

export type FormatSpec = z.infer<typeof formatSpecSchema>

export function cellWidthForElement(spec: FormatSpec, type: ScreenplayElementType): number {
  const el = spec.elements[type]
  if (!el) return 60
  const widthIn = el.right - el.left + (el.firstLineAdjust ?? 0)
  return Math.round(widthIn * spec.page.charsPerInch)
}
