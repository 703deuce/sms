import { describe, expect, it } from 'vitest'
import { allStockAudioEntries, searchStockAudio } from '@/lib/clips/stock-audio-catalog'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('stock-audio-catalog', () => {
  it('Kenney files exist under public/stock-audio/sfx', () => {
    for (const e of allStockAudioEntries()) {
      expect(existsSync(join(process.cwd(), 'public', e.src!.replace(/^\//, '')))).toBe(true)
    }
  })

  it('search ranks click/pop for sfx', () => {
    const hits = searchStockAudio(allStockAudioEntries(), 'click', { kind: 'sfx' })
    expect(hits[0]?.title.toLowerCase()).toContain('pop')
  })

  it('unique ids', () => {
    const ids = allStockAudioEntries().map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
