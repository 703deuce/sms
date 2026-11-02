import { z } from 'zod'

/** Curated Google fonts (installed in worker image + web caption stacks). */
export const BRAND_FONTS = [
  'Inter',
  'Poppins',
  'Montserrat',
  'Bebas Neue',
  'Bangers',
  'Luckiest Guy',
  'Archivo Black',
  'Lato',
  'Oswald',
  'Anton',
  'Roboto',
  'Playfair Display',
] as const
export const BRAND_ASPECTS = ['9:16', '1:1', '16:9'] as const
const corner = z.enum(['TL', 'TR', 'BL', 'BR'])
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const aspectOverrideSchema = z.object({
  logoPosition: corner.optional(),
  captionY: z.number().min(0.05).max(0.95).optional(),
})
export const brandKitColumnsSchema = z.object({
  headingFont: z.string().max(60).nullable().optional(),
  captionFont: z.string().max(60).nullable().optional(),
  palette: z.array(hex).max(5).nullable().optional(),
  watermarkKey: z.string().max(300).nullable().optional(),
  watermarkPosition: z.enum(['TL', 'TR', 'BL', 'BR', 'C']).nullable().optional(),
  watermarkOpacity: z.number().min(0.05).max(1).nullable().optional(),
  watermarkSizePct: z.number().min(3).max(40).nullable().optional(),
  aspectOverrides: z.record(z.enum(BRAND_ASPECTS), aspectOverrideSchema).nullable().optional(),
})
export type BrandKitColumns = z.infer<typeof brandKitColumnsSchema>
