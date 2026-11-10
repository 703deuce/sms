import type { AdProductInput } from './types'

export function adVariantCopy(input: AdProductInput, index: number): { headline: string; cta: string } {
  const claim = input.sellingPoints[index % Math.max(1, input.sellingPoints.length)]
  const headline = index === 0 ? `Meet ${input.name}` : index === 1 && claim ? claim : `Discover ${input.name}`
  const cta = `Explore ${input.name}`
  console.info('[ad-studio:b3] image_variant_copy', { index, hasClaim: Boolean(claim) })
  return { headline, cta }
}
export function adVariantPrompt(input: AdProductInput, index: number): string {
  const { headline, cta } = adVariantCopy(input, index)
  const parts = [
    `Create a finished static product advertisement for ${input.name}.`,
    `Headline, exact legible words: "${headline}". CTA, exact legible words: "${cta}".`,
    `Approved claims only: ${input.sellingPoints.join('; ') || 'the product name'}.`,
    input.brandNotes ? `Brand notes: ${input.brandNotes}.` : '',
    'Use the supplied reference photo when available. Preserve actual product, logos, packaging and colors.',
    input.imageAssetIds[0] ? 'keep the exact product from the reference image: same shape, colors, materials and branding; do not add or invent logos or text' : '',
    'Do not invent prices, features, discounts, claims, endorsements or new branding.',
    `Visual variation ${index + 1} of 3.`,
  ]
  const prompt = parts.filter(Boolean).join(' ')
  console.info('[ad-studio:b3] image_variant_prompt_built', { index, length: prompt.length })
  return prompt
}
