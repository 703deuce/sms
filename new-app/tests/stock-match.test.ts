import { describe, expect, it, afterEach } from 'vitest'
import {
  extractSceneKeywords,
  scoreCandidate,
  trimWindow,
  type StockCandidate,
} from '@/lib/server/t2v/stock-match'
import { pexelsConfigured } from '@/lib/server/ai/pexels'

describe('extractSceneKeywords', () => {
  it('uses explicit keywords when present', () => {
    expect(extractSceneKeywords('solar panels roof', ['solar', 'energy'])).toEqual(['solar', 'energy'])
  })

  it('derives from visual query when keywords empty', () => {
    const kw = extractSceneKeywords('Solar panels on rooftop', [])
    expect(kw).toContain('solar')
    expect(kw).toContain('panels')
  })
})

describe('scoreCandidate', () => {
  const base: StockCandidate = {
    provider: 'pixabay',
    providerId: '1',
    width: 1920,
    height: 1080,
    durationS: 12,
    thumbUrl: '',
    previewUrl: '',
    srcUrl: 'https://example.com/v.mp4',
    pageUrl: '',
    author: 'a',
    tags: ['solar', 'roof'],
    score: 0,
  }

  it('prefers portrait for 9:16', () => {
    const land = { ...base, width: 1920, height: 1080 }
    const port = { ...base, width: 1080, height: 1920 }
    const sLand = scoreCandidate(land, { keywords: ['solar'], aspect: '9:16', needS: 5 })
    const sPort = scoreCandidate(port, { keywords: ['solar'], aspect: '9:16', needS: 5 })
    expect(sPort).toBeGreaterThan(sLand)
  })
})

describe('trimWindow', () => {
  it('centers trim when clip is longer than need', () => {
    const { srcInMs, loops } = trimWindow(20, 5)
    expect(loops).toBe(false)
    expect(srcInMs).toBeGreaterThanOrEqual(500)
  })

  it('loops when clip shorter than scene', () => {
    expect(trimWindow(3, 8).loops).toBe(true)
  })
})

describe('pexelsConfigured', () => {
  const prev = process.env.PEXELS_API_KEY
  afterEach(() => {
    process.env.PEXELS_API_KEY = prev
  })

  it('is false without key', () => {
    delete process.env.PEXELS_API_KEY
    expect(pexelsConfigured()).toBe(false)
  })

  it('is true with key', () => {
    process.env.PEXELS_API_KEY = 'test-key'
    expect(pexelsConfigured()).toBe(true)
  })
})
