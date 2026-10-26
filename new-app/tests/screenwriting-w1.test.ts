import { describe, expect, it } from 'vitest'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { cellWidthForElement, formatSpecSchema } from '@/lib/screenwriting/formats/types'
import { validateScreenplayDocJson } from '@/lib/screenwriting/schema/validate'

describe('FormatSpec feature template', () => {
  it('parses built-in JSON schema', () => {
    expect(formatSpecSchema.parse(FEATURE_FORMAT_SPEC).key).toBe('feature')
  })

  it('action line is 60 cells wide', () => {
    expect(cellWidthForElement(FEATURE_FORMAT_SPEC, 'action')).toBe(60)
  })
})

describe('screenplay doc schema', () => {
  it('accepts dual dialogue with two columns', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'dualDialogue',
          content: [{ type: 'dialogueColumn', content: [] }, { type: 'dialogueColumn', content: [] }],
        },
      ],
    }
    expect(validateScreenplayDocJson(doc)).toEqual({ ok: true })
  })

  it('rejects dual dialogue without exactly 2 columns', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'dualDialogue', content: [{ type: 'dialogueColumn', content: [] }] }],
    }
    expect(validateScreenplayDocJson(doc).ok).toBe(false)
  })
})
