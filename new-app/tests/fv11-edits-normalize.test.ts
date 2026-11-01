import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60000 }

describe('FV-11 normalizeEdits aspect', () => {
  it('keeps new presets and custom, drops junk', () => {
    const base = defaultEdits(bounds)
    expect(normalizeEdits({ ...base, aspectRatio: '4:3' }, bounds).aspectRatio).toBe('4:3')
    expect(normalizeEdits({ ...base, aspectRatio: '21:9' }, bounds).aspectRatio).toBe('21:9')
    expect(normalizeEdits({ ...base, aspectRatio: 'custom:1440x1080' }, bounds).aspectRatio).toBe('custom:1440x1080')
    expect(normalizeEdits({ ...base, aspectRatio: 'custom:9x9999' }, bounds).aspectRatio).toBeUndefined()
    expect(normalizeEdits({ ...base, aspectRatio: '2:1' }, bounds).aspectRatio).toBeUndefined()
  })
})
