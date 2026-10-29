import { describe, expect, it } from 'vitest'
import { shouldApplyVocabulary, vocabularyFingerprint } from '@/lib/clips/editor/vocab-apply'

describe('vocab apply fingerprint', () => {
  it('prevents re-apply when fingerprint matches', () => {
    const vocab = [{ from: 'transovo', to: 'Transovo' }]
    const fp = vocabularyFingerprint(vocab)
    expect(shouldApplyVocabulary(true, fp, fp)).toBe(false)
    expect(shouldApplyVocabulary(true, undefined, fp)).toBe(true)
  })
})
