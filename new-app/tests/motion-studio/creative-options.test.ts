import { describe, expect, it } from 'vitest'
import { MS_VIDEO_TYPES, sanitizeBrandProfile, sanitizeCreativeBrief, directorCategoryGuidance } from '../../lib/motion-studio/creative-options'
describe('Motion Studio creative contract', () => {
  it('ships a broad category catalog and preserves an open-ended mode', () => {
    expect(MS_VIDEO_TYPES.length).toBeGreaterThanOrEqual(20)
    expect(MS_VIDEO_TYPES.some(x => x.id === 'anything')).toBe(true)
    expect(directorCategoryGuidance('documentary')).toContain('verify')
  })
  it('sanitizes prompt metadata and brand colors', () => {
    const creative = sanitizeCreativeBrief({ videoType: 'animated_ad', style: 'modern', brandMode: 'project',
      instructions: 'Use dramatic pacing', brand: { primaryColor: '#aabbcc', secondaryColor: 'red',
        logoPlacement: 'outro', consistency: 'strict' }, referenceUploadIds: ['one', 'one', 42] })
    expect(creative.videoType).toBe('animated_ad')
    expect(creative.brand?.primaryColor).toBe('#AABBCC')
    expect(creative.brand?.secondaryColor).toBeUndefined()
    expect(creative.referenceUploadIds).toEqual(['one'])
    expect(creative.brand?.consistency).toBe('strict')
  })
  it('falls back safely for unknown category and untrusted fields', () => {
    expect(sanitizeCreativeBrief({ videoType: 'invalid', style: 'unknown', brandMode: 'weird' }))
      .toMatchObject({ videoType: 'anything', style: 'automatic', brandMode: 'none' })
    expect(sanitizeBrandProfile({ logoPlacement: 'delete_everything' }).logoPlacement).toBe('ai_decides')
  })
})
