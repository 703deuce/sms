import { describe, expect, it, vi } from 'vitest'
import { parseCreate, parseReplan } from '@/lib/ad-studio/validate'
import { writeAdStoryline } from '@/lib/ad-studio/storyline-agent'
import { planAdScenes } from '@/lib/ad-studio/planner-agent'
import { chooseStockHit, stockTrim } from '@/lib/ad-studio/stock'
import { AD_STUDIO_COSTS } from '@/lib/ad-studio/costs'
import type { AdProductInput } from '@/lib/ad-studio/types'

const input: AdProductInput = {
  name: 'Aurora Lamp',
  sellingPoints: ['Warm adjustable glow', 'Rechargeable battery'],
  aspect: '9:16', durationSec: 15, imageAssetIds: ['stast_owned'],
}
const fixtures = [{ providerId: 'stock-123', durationS: 18, width: 1080, height: 1920, tags: 'home lights' }]

describe('Ad Studio B2 contract', () => {
  it('accepts only validated modes, durations and idempotency keys', () => {
    const parsed = parseCreate({ mode: 'storyline', input, idempotencyKey: 'request-0001' })
    expect(parsed.mode).toBe('storyline')
    expect(parsed.input.durationSec).toBe(15)
    expect(() => parseCreate({ mode: 'image_to_ad', input: { ...input, imageAssetIds: [] }, idempotencyKey: 'request-0002' }))
      .toThrow(/requires at least one/)
    expect(() => parseCreate({ mode: 'storyline', input: { ...input, durationSec: 60 }, idempotencyKey: 'request-0003' }))
      .toThrow(/15 or 30/)
    expect(() => parseCreate({ mode: 'storyline', input, idempotencyKey: 'request-0004' }, 'request-different'))
      .toThrow(/must match/)
    expect(() => parseCreate({ mode: 'storyline', input, idempotencyKey: 'x' })).toThrow(/idempotency/)
    const revised = parseReplan({ audience: 'desk workers' }, input, 'storyline')
    expect(revised.audience).toBe('desk workers')
    expect(revised.name).toBe(input.name)
  })

  it('keeps claims grounded in supplied brief; credits remain TBD', () => {
    const result = writeAdStoryline(input, 'storyline')
    expect(result.solution).toContain('Warm adjustable glow')
    expect(result.voiceover).toContain('Rechargeable battery')
    expect(result.cta).toContain('Aurora Lamp')
    expect(result.voiceover).not.toMatch(/guaranteed|free shipping|best price/i)
    expect(Object.values(AD_STUDIO_COSTS)).toEqual([null,null,null,null])
  })

  it('selects stock with adequate duration and correct aspect', () => {
    const picked = chooseStockHit([
      { providerId: 'wide', durationS: 10, width: 1920, height: 1080, tags: '' },
      { providerId: 'short', durationS: 2, width: 1080, height: 1920, tags: '' },
      ...fixtures,
    ], 4, '9:16')
    expect(picked?.providerId).toBe('stock-123')
    expect(stockTrim({ durationSec: 4, sourceInMs: 2000, sourceOutMs: 6000 }, picked!))
      .toEqual({ sourceInMs: 2000, sourceOutMs: 6000 })
    expect(() => stockTrim({ durationSec: 4, sourceInMs: 16000, sourceOutMs: 20000 }, picked!))
      .toThrow(/does not cover/)
  })

  it('plans a 15s story with stock preferred and product shots generated only after confirmation', async () => {
    const search = vi.fn(async () => fixtures)
    const plan = await planAdScenes({
      runId: 'adrun_test', mode: 'storyline', input,
      script: writeAdStoryline(input, 'storyline'), search,
    })
    expect(search).toHaveBeenCalled()
    expect(plan.scenes.some(s => s.source === 'stock')).toBe(true)
    expect(plan.scenes.some(s => s.source === 'generated')).toBe(true)
    expect(plan.scenes.every(s => s.reason.length > 5)).toBe(true)
    expect(plan.scenes.every(s => s.endMs - s.startMs === s.durationSec * 1000)).toBe(true)
    expect(plan.scenes.at(-1)?.endMs).toBe(15000)
    expect(plan.scenes.every((s,i) => s.index === i)).toBe(true)
    expect(plan.imagery.imageJobIds).toEqual([])
    expect(plan.imagery.preservedSourceAssetIds).toContain('stast_owned')
    expect(plan.creditEstimate).toBeNull()
  })

  it('plans a 30s image-to-ad with short generated shots using only existing model IDs', async () => {
    const search = vi.fn(async () => fixtures)
    const imageInput = { ...input, aspect: '1:1' as const, durationSec: 30 as const }
    const plan = await planAdScenes({
      runId: 'adrun_image', mode: 'image_to_ad', input: imageInput,
      script: writeAdStoryline(imageInput, 'image_to_ad'), search,
    })
    expect(search).not.toHaveBeenCalled()
    expect(plan.scenes.at(-1)?.endMs).toBe(30000)
    expect(plan.scenes.every(s => s.source === 'generated' && s.durationSec >= 2 && s.durationSec <= 5)).toBe(true)
    expect(plan.scenes.every(s => s.modelId === 'seedance-2.0-mini')).toBe(true)
    expect(plan.scenes.every(s => s.referenceAssetId === 'stast_owned')).toBe(true)
  })
})
