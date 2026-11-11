import { describe, expect, it } from 'vitest'
import { createTypographyTreatment, TYPOGRAPHY_TREATMENTS } from '@/lib/clips/editor/typography-treatments'
import { buildTextItemsAss } from '@/lib/clips/render-plan/text-items-ass'

describe('opt-in paired typography', () => {
  it.each(['9:16', '1:1', '16:9'] as const)('creates two editable layers with matching ASS families at %s', (aspectRatio) => {
    for (const treatment of TYPOGRAPHY_TREATMENTS) {
      const items = createTypographyTreatment({ id: 'fresh', headline: 'THE POINT', subtitle: 'One clear idea',
        startMs: 100, endMs: 4000, aspectRatio, treatmentId: treatment.id })
      expect(items.map(i => i.id)).toEqual(['type_fresh_h', 'type_fresh_s'])
      expect(items.every(i => i.x >= 6 && i.x <= 94 && i.y >= 6 && i.y <= 94)).toBe(true)
      expect(items[0]!.style.font).toBe(treatment.headline.font)
      expect(items[1]!.style.font).toBe(treatment.subtitle.font)
      expect(items[0]!.anim).toEqual(treatment.anim)
      const ass = buildTextItemsAss({ textItems: items }, aspectRatio === '9:16' ? 1080 : aspectRatio === '1:1' ? 1920 : 3413, 1920)
      expect(ass).toContain('Style: T0')
      expect(ass).toContain('Style: T1')
    }
  })
  it('rejects unknown treatments and unsafe content rather than overwriting existing documents', () => {
    const base = { id: 'new', headline: 'A', subtitle: 'B', startMs: 0, endMs: 3000, aspectRatio: '9:16' as const }
    expect(() => createTypographyTreatment({ ...base, treatmentId: 'not-found' })).toThrow()
    expect(() => createTypographyTreatment({ ...base, headline: '', treatmentId: 'neon-signal' })).toThrow()
    expect(() => createTypographyTreatment({ ...base, endMs: 200, treatmentId: 'neon-signal' })).toThrow()
  })
})
