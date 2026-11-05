import { describe, expect, it } from 'vitest'
import { allStockAudioEntries, CC0_MUSIC, searchStockAudio } from '@/lib/clips/stock-audio-catalog'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('stock-audio-catalog', () => {
  it('Kenney files exist under public/stock-audio/sfx', () => {
    for (const e of allStockAudioEntries().filter(entry => entry.source === 'kenney-sfx')) {
      expect(existsSync(join(process.cwd(), 'public', e.src!.replace(/^\//, '')))).toBe(true)
    }
  })

  it('F19 exposes actual verified CC0 music loops rather than an empty placeholder', () => {
    expect(CC0_MUSIC).toHaveLength(2)
    for (const e of CC0_MUSIC) {
      expect(e.kind).toBe('music')
      expect(e.license).toBe('cc0')
      expect(e.src).toMatch(/^https:\/\/raw\.githubusercontent\.com\/blancmathis\/Super_Bash_Folds\/[0-9a-f]{40}\/public\/assets\/audio\/open\/music\/.+\.ogg$/)
    }
    expect(searchStockAudio(allStockAudioEntries(), 'battle', { kind: 'music' }).map(e => e.id)).toContain('cc0-battle-loop')
    expect(searchStockAudio(allStockAudioEntries(), 'menu', { kind: 'music' }).map(e => e.id)).toContain('cc0-menu-loop')
    expect(searchStockAudio(allStockAudioEntries(), 'music', { kind: 'sfx' })).toEqual([])
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
