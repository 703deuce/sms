import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import prompts from '@/lib/clips/music-library-prompts.json'

const DENY = /\b(taylor swift|drake|beyonce|in the style of|sound like)\b/i

describe('music-library-prompts', () => {
  it('has ~300 unique ids and valid lengths', () => {
    expect(prompts.length).toBe(300)
    const ids = prompts.map((p) => p.id)
    expect(new Set(ids).size).toBe(300)
    for (const p of prompts) {
      expect([30, 60, 120]).toContain(p.lengthS)
      expect(p.prompt.toLowerCase()).toContain('instrumental')
      expect(DENY.test(p.prompt)).toBe(false)
    }
  })
})
