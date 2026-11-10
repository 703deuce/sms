import { describe, expect, it } from 'vitest'
import { adVariantCopy, adVariantPrompt } from '@/lib/ad-studio/image-variants'
import type { AdProductInput } from '@/lib/ad-studio/types'

const input: AdProductInput = {
  name: 'Aurora Lamp', sellingPoints: ['Adjustable warmth', 'Rechargeable battery'],
  aspect: '9:16', durationSec: 15, imageAssetIds: ['product_1'],
}
describe('Ad Studio B3c static ad creatives', () => {
  it('produces three distinct, claim-grounded headline and CTA prompts', () => {
    const copies = [0,1,2].map(n => adVariantCopy(input,n))
    expect(new Set(copies.map(c => c.headline)).size).toBe(3)
    expect(copies.every(c => c.cta.includes('Aurora Lamp'))).toBe(true)
    expect([0,1,2].map(n => adVariantPrompt(input,n)).every(p => p.includes('Do not invent'))).toBe(true)
  })
})
