import { describe, expect, it, vi } from 'vitest'
import { parseCreate } from '@/lib/ad-studio/validate'
import { planAdScenes } from '@/lib/ad-studio/planner-agent'
import { writeAdStoryline } from '@/lib/ad-studio/storyline-agent'
import { adCommercialReferenceId } from '@/lib/ad-studio/commercial'
import type { AdProductInput } from '@/lib/ad-studio/types'

const input: AdProductInput = {
  name: 'Aurora Lamp', sellingPoints: ['Adjustable warmth'], aspect: '9:16',
  durationSec: 15, imageAssetIds: ['stast_ad_123'], imageVariantId: 'adiv_123',
}
describe('Ad Studio B3f chosen-image commercial', () => {
  it('requires a selected source and supports the additive commercial mode', () => {
    expect(parseCreate({ mode: 'image_ad_to_commercial', input, idempotencyKey: 'commercial-0001' }).mode)
      .toBe('image_ad_to_commercial')
    expect(() => parseCreate({ mode: 'image_ad_to_commercial',
      input: { ...input, imageVariantId: undefined }, idempotencyKey: 'commercial-0002' })).toThrow(/Choose a completed/)
    expect(adCommercialReferenceId('run-a','variant-a')).toBe(adCommercialReferenceId('run-a','variant-a'))
    expect(adCommercialReferenceId('run-a','variant-a')).not.toBe(adCommercialReferenceId('run-a','variant-b'))
  })
  it('plans animated reference shots without stock or any paid provider call', async () => {
    const search = vi.fn(async () => [])
    const plan = await planAdScenes({ runId: 'commercial-run', mode: 'image_ad_to_commercial',
      input, script: writeAdStoryline(input, 'image_ad_to_commercial'), search })
    expect(search).not.toHaveBeenCalled()
    expect(plan.scenes.every(s => s.source === 'generated' && s.referenceAssetId === input.imageAssetIds[0]))
      .toBe(true)
    expect(plan.scenes.every(s => s.prompt?.includes('Transovo commercial director'))).toBe(true)
    expect(plan.creditEstimate).toBeNull()
  })
})
